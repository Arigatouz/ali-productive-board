// ===== morning-briefing.js — AI-powered voice morning briefing =====

import { callAI, getAIConfig } from './ai-config.js';
import { showStatus } from './ui.js';
import { toggleSpeech } from './speech.js';
import { showCyberLoader, hideCyberLoader } from './loader.js';

let briefingText = '';
let isSpeaking = false;
let briefingHistory = [];

// ── TTS via Web Speech API ──────────────────────────────────────────
function speakText(text) {
  return new Promise((resolve) => {
    const config = getAIConfig();
    const ttsProvider = config.tts_provider || 'web_speech';

    if (ttsProvider === 'google') {
      speakGoogle(text).then(resolve).catch(() => {
        speakWebSpeech(text).then(resolve);
      });
      return;
    }

    if (ttsProvider === 'elevenlabs') {
      speakElevenLabs(text).then(resolve).catch(() => {
        speakWebSpeech(text).then(resolve);
      });
      return;
    }

    speakWebSpeech(text).then(resolve);
  });
}

function speakWebSpeech(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return; }

    const utterance = new SpeechSynthesisUtterance(text);
    const lang = (document.getElementById('speechLangBtn')?.textContent || 'ع').trim();

    if (lang === 'ع') utterance.lang = 'ar-SA';
    else if (lang === 'EN') utterance.lang = 'en-US';
    else utterance.lang = 'en-US';

    const voices = speechSynthesis.getVoices();
    const preferred = lang === 'ع'
      ? voices.find(v => v.lang.startsWith('ar'))
      : voices.find(v => v.lang.startsWith('en'));

    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.05;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    isSpeaking = true;
    speechSynthesis.speak(utterance);

    setTimeout(() => { if (isSpeaking) resolve(); }, text.length * 200);
  });
}

async function speakGoogle(text) {
  const config = getAIConfig();
  const key = config.google_tts_key;
  if (!key) throw new Error('No Google TTS key');

  const lang = document.getElementById('speechLangBtn')?.textContent || 'ع';
  const voice = lang === 'ع' ? 'ar-XA-Standard-A' : 'en-US-Standard-A';

  // Google TTS supports browser CORS with a key param — call directly without proxy
  const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`;

  const res = await fetch(ttsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: lang === 'ع' ? 'ar-XA' : 'en-US', name: voice },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });

  if (!res.ok) throw new Error('Google TTS error');

  const data = await res.json();
  return new Promise((resolve) => {
    const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
    isSpeaking = true;
    audio.onended = () => { isSpeaking = false; resolve(); };
    audio.onerror = () => { isSpeaking = false; resolve(); };
    setTimeout(() => { isSpeaking = false; resolve(); }, text.length * 150);
    audio.play();
  });
}

async function speakElevenLabs(text) {
  const config = getAIConfig();
  const key = config.elevenlabs_key;
  if (!key) throw new Error('No ElevenLabs API key');

  const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel — good multilingual voice
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) throw new Error('ElevenLabs API error (' + res.status + ')');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const audio = new Audio(url);
    isSpeaking = true;
    audio.onended = () => { isSpeaking = false; URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { isSpeaking = false; URL.revokeObjectURL(url); resolve(); };
    setTimeout(() => { isSpeaking = false; URL.revokeObjectURL(url); resolve(); }, text.length * 150);
    audio.play();
  });
}

function stopSpeaking() {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  isSpeaking = false;
}

// ── Generate briefing content ────────────────────────────────────────
function gatherBriefingContext() {
  const parts = [];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  parts.push(`Today is ${today}.`);

  const taskPanel = document.getElementById('tasksPanel');
  if (taskPanel) {
    const unchecked = taskPanel.querySelectorAll('.checkbox:not(.checked)');
    const checked = taskPanel.querySelectorAll('.checkbox.checked');
    parts.push(`Tasks: ${unchecked.length} pending, ${checked.length} completed.`);
  }

  const habitList = document.getElementById('habitList');
  if (habitList) {
    const habits = habitList.querySelectorAll('.habit-item');
    parts.push(`Habits: ${habits.length} tracked.`);
  }

  const journalTa = document.getElementById('journalTa');
  if (journalTa && journalTa.value.trim()) {
    const preview = journalTa.value.trim().slice(0, 200);
    parts.push(`Today's journal (preview): "${preview}"`);
  }

  return parts.join('\n');
}

export async function generateBriefing() {
  const config = getAIConfig();
  if (!config.cors_proxy) {
    showStatus('Configure the CORS proxy (worker URL) in Settings to use AI');
    return;
  }

  const context = gatherBriefingContext();
  const lang = document.getElementById('speechLangBtn')?.textContent || 'ع';
  const langInstruction = lang === 'ع' ? 'Respond in Arabic.' : lang === 'EN' ? 'Respond in English.' : 'Respond in the language the user speaks.';

  stopSpeaking();

  showStatus('Generating briefing…');
  const briefingEl = document.getElementById('briefingText');
  const speakBtn = document.getElementById('briefingSpeakBtn');
  const genBtn = document.getElementById('briefingGenBtn');

  if (genBtn) { genBtn.disabled = true; genBtn.textContent = 'Generating…'; }
  if (briefingEl) briefingEl.textContent = '';
  showCyberLoader('Generating Briefing');

  try {
    const messages = [
      {
        role: 'system',
        content: `You are a concise morning briefing assistant for a developer's productivity dashboard. ${langInstruction} Give a 2-3 sentence briefing covering: what tasks are pending, any habit reminders, and a motivational note. Be brief and actionable.`,
      },
      {
        role: 'user',
        content: `Give me my morning briefing.\n\n${context}`,
      },
    ];

    briefingText = await callAI(messages, { maxTokens: 256 });

    if (briefingEl) {
      briefingEl.textContent = briefingText;
      briefingEl.style.opacity = '0';
      requestAnimationFrame(() => { briefingEl.style.opacity = '1'; });
    }

    if (speakBtn) speakBtn.disabled = false;
  } catch (err) {
    if (briefingEl) briefingEl.textContent = `Error: ${err.message}`;
    showStatus('Briefing failed — check API key');
  } finally {
    hideCyberLoader();
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = 'Generate Briefing'; }
  }
}

export async function speakBriefing() {
  if (!briefingText) {
    showStatus('Generate a briefing first');
    return;
  }

  const speakBtn = document.getElementById('briefingSpeakBtn');
  if (isSpeaking) {
    stopSpeaking();
    if (speakBtn) speakBtn.textContent = '🔊 Speak';
    return;
  }

  if (speakBtn) speakBtn.textContent = '⏹ Stop';
  await speakText(briefingText);
  if (speakBtn) speakBtn.textContent = '🔊 Speak';
  isSpeaking = false;
}

export async function voiceChat(userInput) {
  const config = getAIConfig();
  if (!config.cors_proxy) {
    showStatus('Configure the CORS proxy (worker URL) in Settings to use AI');
    return;
  }

  const lang = document.getElementById('speechLangBtn')?.textContent || 'ع';
  const langInstruction = lang === 'ع' ? 'Respond in Arabic.' : lang === 'EN' ? 'Respond in English.' : 'Match the language the user speaks.';

  briefingHistory.push({ role: 'user', content: userInput });

  const messages = [
    {
      role: 'system',
      content: `You are a voice breakfast briefing assistant for a developer. Keep responses SHORT (1-3 sentences). ${langInstruction} Context: ${gatherBriefingContext()}`,
    },
    ...briefingHistory.slice(-6),
  ];

  try {
    const response = await callAI(messages, { maxTokens: 128 });
    briefingHistory.push({ role: 'assistant', content: response });

    const textEl = document.getElementById('briefingText');
    if (textEl) textEl.textContent = response;

    await speakText(response);
  } catch (err) {
    showStatus('Voice chat error: ' + err.message);
  }
}

export function initMorningBriefing(config) {
  const genBtn = document.getElementById('briefingGenBtn');
  const speakBtn = document.getElementById('briefingSpeakBtn');
  const voiceBtn = document.getElementById('briefingVoiceBtn');

  if (genBtn) genBtn.addEventListener('click', generateBriefing);
  if (speakBtn) speakBtn.addEventListener('click', speakBriefing);
  if (voiceBtn) voiceBtn.addEventListener('click', () => {
    stopSpeaking();
    toggleSpeech();
  });
}

export function renderMorningBriefing() {
  // Future: render briefing history
}
