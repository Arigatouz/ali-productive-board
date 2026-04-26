// ===== ai-config.js — AI provider configuration (API keys, provider selection) =====

import { dbGet, dbSet } from './db.js';
import { showStatus } from './ui.js';
import { getFullApiUrl } from './api.js';

// ── Config keys stored in IndexedDB ────────────────────────────────
const AI_KEYS = {
  google_tts_key:  'google_tts_key',
  elevenlabs_key:  'elevenlabs_key',
  ai_provider:     'ai_provider',
  tts_provider:    'tts_provider',
  brainstorm_id:   'brainstorm_id',
  cors_proxy:      'cors_proxy',
};

const DEFAULTS = {
  google_tts_key:  '',
  elevenlabs_key:  '',
  ai_provider:     'perplexity',
  tts_provider:    'web_speech',
  brainstorm_id:   '',
  cors_proxy:      '',
};

let aiConfig = { ...DEFAULTS };

export async function loadAIConfig() {
  const entries = await Promise.all(
    Object.entries(AI_KEYS).map(([cfgKey, dbKey]) =>
      dbGet(dbKey).then(v => [cfgKey, v ?? DEFAULTS[cfgKey]])
    )
  );
  aiConfig = Object.fromEntries(entries);
  // Also pull cors_proxy from the main config key (same IDB store)
  const corsProxy = await dbGet('cors_proxy');
  aiConfig.cors_proxy = corsProxy || '';
  return aiConfig;
}

export function getAIConfig() {
  return { ...aiConfig };
}

export async function saveAIConfig(fields) {
  const writes = [];
  for (const [field, value] of Object.entries(fields)) {
    if (AI_KEYS[field]) {
      const normalized = (value === null || value === undefined) ? '' : String(value).trim();
      aiConfig[field] = normalized;
      writes.push(dbSet(AI_KEYS[field], normalized));
    }
  }
  await Promise.all(writes);
}

// ── API call helpers ────────────────────────────────────────────────

// Returns the worker origin if a workers.dev proxy is configured, otherwise null
function getWorkerOrigin() {
  if (aiConfig.cors_proxy && aiConfig.cors_proxy.includes('workers.dev')) {
    return new URL(aiConfig.cors_proxy).origin;
  }
  return null;
}

export async function callPerplexity(messages, options = {}) {
  const workerOrigin = getWorkerOrigin();
  if (!workerOrigin) throw new Error('CORS proxy (worker URL) not configured in Settings');

  const res = await fetch(`${workerOrigin}/perplexity/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || 'sonar',
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = Array.isArray(data.citations) ? data.citations : [];
  if (citations.length) {
    const links = citations.map((u, i) => `[[${i + 1}]](${u})`).join('  ');
    return content + `\n\n---\n*Sources: ${links}*`;
  }
  return content;
}

export async function callAnthropic(messages, options = {}) {
  const workerOrigin = getWorkerOrigin();
  if (!workerOrigin) throw new Error('CORS proxy (worker URL) not configured in Settings');

  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role !== 'system');

  const res = await fetch(`${workerOrigin}/anthropic/messages`, {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens ?? 1024,
      system: systemMsg,
      messages: userMessages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

export async function callAI(messages, options = {}) {
  const provider = aiConfig.ai_provider || 'perplexity';
  if (provider === 'anthropic') return callAnthropic(messages, options);
  return callPerplexity(messages, options);
}

// ── Extract URLs from text ─────────────────────────────────────────
export function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
  return [...new Set((text.match(urlRegex) || []))];
}

// ── Open URL in new tab ────────────────────────────────────────────
export function openInNewTab(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      window.open(parsed.href, '_blank', 'noopener');
    }
  } catch { /* invalid URL */ }
}

// ── AI Settings modal section ──────────────────────────────────────
export function renderAISettingsSection() {
  return `
    <div class="settings-section">
      <div class="settings-section-header">
        <div class="settings-section-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 8 6a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 8 1z"/>
            <path d="M3 14v-1a5 5 0 0 1 10 0v1"/>
            <path d="M10.5 3.5L12 2M12 2l1.5 1.5M12 2v2"/>
            <path d="M5.5 3.5L4 2M4 2L2.5 3.5M4 2v2"/>
          </svg>
        </div>
        <div class="settings-section-meta">
          <div class="settings-section-title">AI Providers</div>
          <div class="settings-section-help">API keys are stored as Cloudflare Worker secrets — not here. Use <code style="font-family:var(--mono);background:var(--bg-secondary);padding:1px 5px;border-radius:3px;">npx wrangler secret put ANTHROPIC_KEY</code> and <code style="font-family:var(--mono);background:var(--bg-secondary);padding:1px 5px;border-radius:3px;">npx wrangler secret put PERPLEXITY_KEY</code> to set them.</div>
        </div>
      </div>
      <div class="settings-fields">
        <div class="settings-field">
          <label for="configAIProvider">Chat Provider</label>
          <select id="configAIProvider" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:3px;font-size:12px;font-family:var(--mono);background:var(--bg-card);color:var(--text-primary);">
            <option value="perplexity">Perplexity (sonar — web-grounded)</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-header">
        <div class="settings-section-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div class="settings-section-meta">
          <div class="settings-section-title">Voice & TTS</div>
          <div class="settings-section-help">Text-to-speech provider for morning briefing voice responses.</div>
        </div>
      </div>
      <div class="settings-fields">
        <div class="settings-field">
          <label for="configTTSProvider">TTS Provider</label>
          <select id="configTTSProvider" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:3px;font-size:12px;font-family:var(--mono);background:var(--bg-card);color:var(--text-primary);">
            <option value="web_speech">Web Speech API (free — no key needed)</option>
            <option value="google">Google Cloud TTS (requires key — high quality Arabic)</option>
            <option value="elevenlabs">ElevenLabs (requires key — premium voices)</option>
          </select>
        </div>
        <div class="settings-field" id="googleTtsKeyField">
          <label for="configGoogleTTSKey">Google Cloud TTS Key</label>
          <input type="password" id="configGoogleTTSKey" placeholder="AIza...">
          <div class="settings-help"><a href="https://cloud.google.com/text-to-speech" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">Enable at cloud.google.com/text-to-speech</a> · <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">Get API key</a> · Free tier: 1M chars/month</div>
        </div>
        <div class="settings-field" id="elevenLabsKeyField" style="display:none;">
          <label for="configElevenLabsKey">ElevenLabs API Key</label>
          <input type="password" id="configElevenLabsKey" placeholder="xi_...">
          <div class="settings-help"><a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">Get your key at elevenlabs.io/app/settings/api-keys</a></div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-header">
        <div class="settings-section-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 4h12M2 8h12M2 12h8"/>
            <circle cx="14" cy="12" r="2"/>
            <path d="M14 10V8"/>
          </svg>
        </div>
        <div class="settings-section-meta">
          <div class="settings-section-title">Brainstorm Note</div>
          <div class="settings-section-help">HackMD note ID for brainstorming sessions (optional).</div>
        </div>
      </div>
      <div class="settings-fields">
        <div class="settings-field">
          <label for="configBrainstormId">Brainstorm Note ID</label>
          <input type="text" id="configBrainstormId" placeholder="AbCDefGhIjKlMnOpQrStUv">
          <div class="settings-help">Create a blank HackMD note and paste the ID here</div>
        </div>
      </div>
    </div>
  `;
}

export function populateAISettingsFields() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('configAIProvider',   aiConfig.ai_provider);
  setVal('configTTSProvider',  aiConfig.tts_provider);
  setVal('configGoogleTTSKey', aiConfig.google_tts_key);
  setVal('configElevenLabsKey', aiConfig.elevenlabs_key || '');
  setVal('configBrainstormId', aiConfig.brainstorm_id);
  updateTTSKeyVisibility();
  const ttsSelect = document.getElementById('configTTSProvider');
  if (ttsSelect) ttsSelect.addEventListener('change', updateTTSKeyVisibility);
}

function updateTTSKeyVisibility() {
  const provider = document.getElementById('configTTSProvider')?.value || 'web_speech';
  const googleField = document.getElementById('googleTtsKeyField');
  const elevenField = document.getElementById('elevenLabsKeyField');
  if (googleField) googleField.style.display = (provider === 'google') ? '' : 'none';
  if (elevenField) elevenField.style.display = (provider === 'elevenlabs') ? '' : 'none';
}

export function collectAISettingsFields() {
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  return {
    ai_provider:    getVal('configAIProvider'),
    tts_provider:   getVal('configTTSProvider'),
    google_tts_key: getVal('configGoogleTTSKey'),
    elevenlabs_key: getVal('configElevenLabsKey'),
    brainstorm_id:  getVal('configBrainstormId'),
  };
}