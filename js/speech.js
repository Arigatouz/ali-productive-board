// ===== speech.js — browser-based speech-to-text (Whisper via Transformers.js) =====

import { showStatus } from './ui.js';

const MODEL_ID = 'onnx-community/whisper-small';
const CHUNK_SECONDS = 5;
const SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = CHUNK_SECONDS * SAMPLE_RATE;

let transcriber = null;
let isRecording = false;
let audioContext = null;
let mediaStream = null;
let scriptProcessor = null;
let audioBuffer = [];
let isLoading = false;

// ── Language modes ──────────────────────────────────────────────────
// AR = Arabic (handles code-switching with English insertions)
// EN = English only
// MIX = Auto-detect per segment
const LANG_MODES = [
  { lang: 'arabic',  label: 'AR',  shortLabel: 'ع', tip: 'Arabic — handles Arabic+English mix' },
  { lang: 'english', label: 'EN',  shortLabel: 'EN', tip: 'English only' },
  { lang: null,      label: 'MIX', shortLabel: '↔',  tip: 'Auto-detect language' },
];
let langModeIdx = 0;

function currentLangMode() { return LANG_MODES[langModeIdx]; }

export function cycleLangMode() {
  langModeIdx = (langModeIdx + 1) % LANG_MODES.length;
  const mode = currentLangMode();
  const btn = document.getElementById('speechLangBtn');
  if (btn) {
    btn.textContent = mode.shortLabel;
    btn.title = mode.tip;
  }
  showStatus(`🎙 Language: ${mode.tip}`);
}

const getOnTextTarget = () => {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.id) return el;
  const qcText = document.getElementById('qcText');
  if (qcText) return qcText;
  const journalTa = document.getElementById('journalTa');
  if (journalTa) return journalTa;
  return null;
};

// ── Format helpers ──────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatETA(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

// ── Download tracker ────────────────────────────────────────────────
// Transformers.js fires progress_callback per-file with:
//   status: 'initiate' | 'progress' | 'done' | 'ready'
//   file: string, loaded: number, total: number (bytes)
// We aggregate across all files to compute overall progress.

const dlState = {
  files: new Map(),       // file -> { loaded, total }
  startTime: 0,
  totalLoaded: 0,
  totalSize: 0,
  lastSpeed: 0,           // bytes/sec smoothed
};

function resetDlState() {
  dlState.files.clear();
  dlState.startTime = 0;
  dlState.totalLoaded = 0;
  dlState.totalSize = 0;
  dlState.lastSpeed = 0;
}

function handleProgress(p) {
  if (p.status === 'initiate') {
    if (!dlState.startTime) dlState.startTime = Date.now();
    if (p.file && p.total) {
      dlState.files.set(p.file, { loaded: 0, total: p.total });
    }
    return;
  }

  if (p.status === 'progress' && p.file) {
    if (!dlState.startTime) dlState.startTime = Date.now();
    dlState.files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
  }

  if (p.status === 'done' && p.file) {
    const entry = dlState.files.get(p.file);
    if (entry) entry.loaded = entry.total;
  }

  // Recompute totals
  let loaded = 0, total = 0;
  for (const [, f] of dlState.files) {
    loaded += f.loaded;
    total += f.total;
  }
  dlState.totalLoaded = loaded;
  dlState.totalSize = total;

  // Speed estimate (exponential moving average)
  const elapsed = (Date.now() - dlState.startTime) / 1000;
  if (elapsed > 0) {
    const instantSpeed = loaded / elapsed;
    dlState.lastSpeed = dlState.lastSpeed === 0 ? instantSpeed : dlState.lastSpeed * 0.7 + instantSpeed * 0.3;
  }

  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const remaining = total - loaded;
  const eta = dlState.lastSpeed > 0 ? remaining / dlState.lastSpeed : NaN;

  updateOverlayProgress(pct, loaded, total, eta, p.file);
}

// ── Cyber loading overlay ──────────────────────────────────────────
function createOverlay() {
  if (document.getElementById('speech-overlay')) return document.getElementById('speech-overlay');

  const overlay = document.createElement('div');
  overlay.id = 'speech-overlay';
  overlay.innerHTML = `
    <div class="speech-overlay-backdrop"></div>
    <div class="speech-overlay-panel">
      <span class="speech-overlay-corner speech-ctl"></span>
      <span class="speech-overlay-corner speech-ctr"></span>
      <span class="speech-overlay-corner speech-cbl"></span>
      <span class="speech-overlay-corner speech-cbr"></span>
      <div class="speech-overlay-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </div>
      <div class="speech-overlay-title" id="sot-title">INITIALIZING VOICE</div>
      <div class="speech-overlay-sub" id="sot-sub">PREPARING DOWNLOAD</div>
      <div class="speech-overlay-bar-wrap">
        <div class="speech-overlay-bar" id="sot-bar"></div>
      </div>
      <div class="speech-overlay-stats" id="sot-stats">
        <span class="sot-size" id="sot-size">0 B / --</span>
        <span class="sot-pct" id="sot-pct">0%</span>
        <span class="sot-eta" id="sot-eta"></span>
      </div>
      <div class="speech-overlay-file" id="sot-file"></div>
      <div class="speech-overlay-hex" id="sot-hex">0x00000000</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

let hexInterval = null;
const HEX_CHARS = '0123456789ABCDEF';
function randHex(len) { let s = ''; for (let i = 0; i < len; i++) s += HEX_CHARS[Math.floor(Math.random() * 16)]; return s; }

function showOverlay(title, sub) {
  const overlay = createOverlay();
  const titleEl = overlay.querySelector('#sot-title');
  const subEl = overlay.querySelector('#sot-sub');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  overlay.classList.add('active');
  clearInterval(hexInterval);
  hexInterval = setInterval(() => {
    const hexEl = overlay.querySelector('#sot-hex');
    if (hexEl) hexEl.textContent = `0x${randHex(8)}`;
  }, 80);
}

function hideOverlay() {
  const overlay = document.getElementById('speech-overlay');
  if (overlay) overlay.classList.remove('active');
  clearInterval(hexInterval);
}

function updateOverlayProgress(pct, loaded, total, eta, currentFile) {
  const overlay = document.getElementById('speech-overlay');
  if (!overlay) return;
  const bar = overlay.querySelector('#sot-bar');
  const sizeEl = overlay.querySelector('#sot-size');
  const pctEl = overlay.querySelector('#sot-pct');
  const etaEl = overlay.querySelector('#sot-eta');
  const fileEl = overlay.querySelector('#sot-file');
  const subEl = overlay.querySelector('#sot-sub');
  const titleEl = overlay.querySelector('#sot-title');

  if (bar) bar.style.width = `${Math.max(1, pct)}%`;
  if (sizeEl) sizeEl.textContent = `${formatBytes(loaded)} / ${total > 0 ? formatBytes(total) : '—'}`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (etaEl) etaEl.textContent = eta > 0 ? `~${formatETA(eta)}` : '';

  // Show current file name (trimmed)
  if (fileEl && currentFile) {
    const short = currentFile.split('/').pop();
    fileEl.textContent = short.length > 40 ? short.slice(0, 37) + '...' : short;
  }

  // Phase labels
  if (subEl) {
    if (pct < 5) subEl.textContent = 'CONNECTING';
    else if (pct < 95) subEl.textContent = 'DOWNLOADING MODEL';
    else if (pct < 100) subEl.textContent = 'FINALIZING';
    else subEl.textContent = 'MODEL READY';
  }
  if (titleEl) {
    if (pct >= 100) titleEl.textContent = 'VOICE READY';
  }
}

// ── Model loading ──────────────────────────────────────────────────
async function loadModel() {
  if (transcriber) return transcriber;
  if (isLoading) {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (transcriber) { clearInterval(check); resolve(transcriber); }
      }, 300);
    });
  }
  isLoading = true;
  resetDlState();

  const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');

  const makeCb = () => (p) => handleProgress(p);

  try {
    showOverlay('INITIALIZING VOICE', 'PREPARING DOWNLOAD');
    transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
      device: 'webgpu',
      progress_callback: makeCb(),
    });
  } catch {
    resetDlState();
    showOverlay('INITIALIZING VOICE', 'FALLBACK: WASM MODE');
    transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
      device: 'wasm',
      progress_callback: makeCb(),
    });
  }

  isLoading = false;
  return transcriber;
}

async function transcribeChunk(audioData) {
  if (!transcriber) return '';
  try {
    const opts = {
      return_timestamps: false,
      task: 'transcribe',
    };
    const lang = currentLangMode().lang;
    if (lang) opts.language = lang;
    const result = await transcriber(audioData, opts);
    const text = (result?.text || '').trim();
    if (!text || text === '[BLANK_AUDIO]' || (text.startsWith('(') && text.endsWith(')'))) return '';
    return text;
  } catch (err) {
    console.warn('STT transcription error:', err);
    return '';
  }
}

function insertText(target, text) {
  if (!target || !text) return;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const needsSpace = start > 0 && target.value[start - 1] !== ' ' && target.value[start - 1] !== '\n';
  const insertion = needsSpace ? ' ' + text : text;
  target.setRangeText(insertion, start, end, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function startMicCapture(onAudio) {
  return navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    .then(stream => {
      mediaStream = stream;
      audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(stream);
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (event) => {
        const channelData = event.inputBuffer.getChannelData(0);
        onAudio(new Float32Array(channelData));
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
    });
}

function stopMicCapture() {
  scriptProcessor?.disconnect();
  audioContext?.close();
  mediaStream?.getTracks().forEach(t => t.stop());
  scriptProcessor = null;
  audioContext = null;
  mediaStream = null;
}

function updateBtnState(state) {
  const btn = document.getElementById('speechBtn');
  if (!btn) return;
  btn.classList.remove('recording', 'loading');
  if (state === 'recording') {
    btn.classList.add('recording');
    btn.title = 'Listening… click to stop';
  } else if (state === 'loading') {
    btn.classList.add('loading');
    btn.title = 'Loading voice model…';
  } else if (state === 'error') {
    btn.title = 'Voice input unavailable';
  } else {
    btn.title = 'Voice Input (Arabic + English)';
  }
}

export async function toggleSpeech() {
  const btn = document.getElementById('speechBtn');
  if (!btn) return;

  if (isRecording) {
    isRecording = false;
    stopMicCapture();
    if (audioBuffer.length > 0) {
      const remaining = new Float32Array(audioBuffer);
      audioBuffer = [];
      const text = await transcribeChunk(remaining);
      const target = getOnTextTarget();
      if (text && target) insertText(target, text);
    }
    updateBtnState('idle');
    showStatus('🎙 Stopped listening');
    return;
  }

  try {
    if (!transcriber) {
      updateBtnState('loading');
      showStatus('Loading voice model…');
    }

    await loadModel();

    hideOverlay();

    audioBuffer = [];
    isRecording = true;

    await startMicCapture((chunk) => {
      audioBuffer.push(...chunk);
      if (audioBuffer.length >= CHUNK_SAMPLES) {
        const toProcess = new Float32Array(audioBuffer.splice(0, CHUNK_SAMPLES));
        transcribeChunk(toProcess).then(text => {
          if (!isRecording) return;
          if (!text) return;
          const target = getOnTextTarget();
          if (target) insertText(target, text);
        });
      }
    });

    updateBtnState('recording');
    showStatus('🎙 Listening…');
  } catch (err) {
    console.error('Speech init error:', err);
    isRecording = false;
    hideOverlay();
    updateBtnState('error');
    showStatus('Voice input unavailable — check mic permissions');
  }
}

export function isSpeechReading() {
  return isRecording;
}

export function initSpeech() {
  const btn = document.getElementById('speechBtn');
  if (btn) btn.addEventListener('click', toggleSpeech);
  const langBtn = document.getElementById('speechLangBtn');
  if (langBtn) {
    langBtn.addEventListener('click', (e) => { e.stopPropagation(); cycleLangMode(); });
  }
}