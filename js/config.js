// ===== config.js — app configuration via IndexedDB =====

import { dbGet, dbSet } from './db.js';
import { showStatus, onSettingsSaveRef } from './ui.js';
import { renderAISettingsSection, populateAISettingsFields, collectAISettingsFields, saveAIConfig } from './ai-config.js';

// Load all config keys from IDB; returns a config object
export async function loadConfig() {
  const [
    API_TOKEN,
    TASKS_NOTE_ID,
    MEMORY_NOTE_ID,
    ARTICLES_NOTE_ID,
    JOURNAL_NOTE_ID,
    DATA_NOTE_ID,
    CORS_PROXY,
  ] = await Promise.all([
    dbGet('api_token'),
    dbGet('tasks_id'),
    dbGet('memory_id'),
    dbGet('articles_id'),
    dbGet('journal_id'),
    dbGet('data_id'),
    dbGet('cors_proxy'),
  ]);

  return {
    API_TOKEN:       API_TOKEN       || '',
    TASKS_NOTE_ID:   TASKS_NOTE_ID   || '',
    MEMORY_NOTE_ID:  MEMORY_NOTE_ID  || '',
    ARTICLES_NOTE_ID: ARTICLES_NOTE_ID || '',
    JOURNAL_NOTE_ID: JOURNAL_NOTE_ID || '',
    DATA_NOTE_ID:    DATA_NOTE_ID    || '',
    CORS_PROXY:      CORS_PROXY      || '',
    BRAINSTORM_NOTE_ID: (await dbGet('brainstorm_id')) || '',
  };
}

function normalizeConfigValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  return str === 'NaN' ? '' : str;
}

// Write changed fields to IDB, mutate config object in place
export async function saveConfig(fields, config) {
  const map = {
    apiToken:   'api_token',
    tasksId:    'tasks_id',
    memoryId:   'memory_id',
    articlesId: 'articles_id',
    journalId:  'journal_id',
    dataId:     'data_id',
    corsProxy:  'cors_proxy',
    brainstormId: 'brainstorm_id',
  };
  const cfgKeyMap = {
    apiToken:   'API_TOKEN',
    tasksId:    'TASKS_NOTE_ID',
    memoryId:   'MEMORY_NOTE_ID',
    articlesId: 'ARTICLES_NOTE_ID',
    journalId:  'JOURNAL_NOTE_ID',
    dataId:     'DATA_NOTE_ID',
    corsProxy:  'CORS_PROXY',
  };

  const writes = [];
  for (const [field, idbKey] of Object.entries(map)) {
    if (field in fields) {
      const val = normalizeConfigValue(fields[field]);
      writes.push(dbSet(idbKey, val));
      if (config && cfgKeyMap[field]) config[cfgKeyMap[field]] = val;
    }
  }
  await Promise.all(writes);
}

// Render and show settings modal
export function showSettingsModal(config, onSave) {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle   = document.getElementById('modalTitle');
  const modalBody    = document.getElementById('modalBody');
  if (!modalBody || !modalTitle || !modalOverlay) {
    console.error('Modal elements not found');
    return;
  }

  modalTitle.textContent = 'Settings';
  modalBody.innerHTML = `
    <div class="settings-form">
      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="11" width="12" height="3" rx="1.5"/>
              <circle cx="8" cy="5.5" r="3"/>
            </svg>
          </div>
          <div class="settings-section-meta">
            <div class="settings-section-title">Authentication</div>
            <div class="settings-section-help">Stored only in your browser — never sent anywhere else.</div>
          </div>
        </div>
        <div class="settings-fields">
          <div class="settings-field">
            <label for="configApiToken">HackMD API Token</label>
            <input type="password" id="configApiToken" placeholder="Paste your personal API token">
            <div class="settings-help">HackMD Settings → API → Personal Token</div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="6"/>
              <path d="M8 2c-2 2-2 10 0 12M2 8h12"/>
            </svg>
          </div>
          <div class="settings-section-meta">
            <div class="settings-section-title">Connectivity</div>
            <div class="settings-section-help">GitHub Pages needs a proxy to reach the HackMD API.</div>
          </div>
        </div>
        <div class="settings-fields">
          <div class="settings-field">
            <label for="configCorsProxy">CORS Proxy URL</label>
            <input type="text" id="configCorsProxy" placeholder="https://your-worker.workers.dev/hackmd/">
            <div class="settings-help">Use your own Cloudflare Worker for reliability</div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div class="settings-section-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
              <path d="M5 6h6M5 9h4"/>
            </svg>
          </div>
          <div class="settings-section-meta">
            <div class="settings-section-title">HackMD Note IDs</div>
            <div class="settings-section-help">The ID is the part after hackmd.io/ in your note URL.</div>
          </div>
        </div>
        <div class="settings-fields">
          <div class="settings-field">
            <label for="configTasksId">Tasks Note</label>
            <input type="text" id="configTasksId" placeholder="AbCDefGhIjKlMnOpQrStUv">
          </div>
          <div class="settings-field">
            <label for="configMemoryId">Memory Note</label>
            <input type="text" id="configMemoryId" placeholder="AbCDefGhIjKlMnOpQrStUv">
          </div>
          <div class="settings-field">
            <label for="configArticlesId">Articles Note</label>
            <input type="text" id="configArticlesId" placeholder="AbCDefGhIjKlMnOpQrStUv">
          </div>
          <div class="settings-field">
            <label for="configJournalId">Journal Note</label>
            <input type="text" id="configJournalId" placeholder="AbCDefGhIjKlMnOpQrStUv">
            <div class="settings-help">Optional — journal entries are saved locally even without this</div>
          </div>
          <div class="settings-field">
            <label for="configDataId">Dashboard Data Note</label>
            <input type="text" id="configDataId" placeholder="AbCDefGhIjKlMnOpQrStUv">
            <div class="settings-help">Stores habits, pomo log, badges, analytics — auto-synced</div>
          </div>
        </div>
      </div>

      ${renderAISettingsSection()}
    </div>
  `;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('configApiToken',  config.API_TOKEN);
  setVal('configCorsProxy', config.CORS_PROXY);
  setVal('configTasksId',   config.TASKS_NOTE_ID);
  setVal('configMemoryId',  config.MEMORY_NOTE_ID);
  setVal('configArticlesId',config.ARTICLES_NOTE_ID);
  setVal('configJournalId', config.JOURNAL_NOTE_ID);
  setVal('configDataId',    config.DATA_NOTE_ID);
  populateAISettingsFields();

  modalOverlay.classList.add('visible');
  modalOverlay.dataset.type = 'settings';

  // Attach the save callback so handleModalSave() in main.js can call it
  onSettingsSaveRef.fn = async () => {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    await onSave({
      apiToken:   getVal('configApiToken'),
      corsProxy:  getVal('configCorsProxy'),
      tasksId:    getVal('configTasksId'),
      memoryId:   getVal('configMemoryId'),
      articlesId: getVal('configArticlesId'),
      journalId:  getVal('configJournalId'),
      dataId:     getVal('configDataId'),
    }, config);
    await saveAIConfig(collectAISettingsFields());
    config.BRAINSTORM_NOTE_ID = (await dbGet('brainstorm_id')) || '';
    showStatus('Settings saved. Refreshing…');
    setTimeout(() => location.reload(), 1000);
  };
}

// Show auth error modal
export function showAuthError(config) {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle   = document.getElementById('modalTitle');
  const modalBody    = document.getElementById('modalBody');
  if (!modalBody || !modalTitle || !modalOverlay) return;

  modalTitle.textContent = 'Authentication Error (401)';
  modalBody.innerHTML = `
    <div class="settings-form">
      <p style="color: var(--accent); font-weight: 600; margin-bottom: 12px;">The HackMD API returned a 401 Unauthorized error.</p>
      <div class="settings-field">
        <label>Current API Token</label>
        <input type="password" id="configApiToken" value="${config.API_TOKEN || ''}">
      </div>
      <div style="margin-top: 16px; font-size: 13px; line-height: 1.6; background: var(--bg-secondary); padding: 12px; border-radius: 8px; border-left: 4px solid var(--accent);">
        <strong>Auth Checklist:</strong>
        <ul style="margin-left: 20px; margin-top: 8px;">
          <li>Verify your API token is still valid in HackMD Settings.</li>
          <li>Ensure the token has "read" and "write" permissions.</li>
          <li>Check if your browser or network is blocking the <code>Authorization</code> header.</li>
        </ul>
        <div style="margin-top: 12px;">
          <strong>Test with curl:</strong>
          <pre style="background: var(--bg-card); padding: 8px; border-radius: 4px; border: 1px solid var(--border); overflow-x: auto; font-size: 11px; margin-top: 4px;">curl -H "Authorization: Bearer YOUR_TOKEN" https://api.hackmd.io/v1/notes/${config.TASKS_NOTE_ID || ''}</pre>
        </div>
      </div>
    </div>
  `;

  modalOverlay.classList.add('visible');
  modalOverlay.dataset.type = 'settings';

  onSettingsSaveRef.fn = () => {
    const el = document.getElementById('configApiToken');
    const apiToken = el ? el.value.trim() : '';
    dbSet('api_token', apiToken);
    config.API_TOKEN = apiToken;
    showStatus('Token updated. Refreshing…');
    setTimeout(() => location.reload(), 1000);
  };
}
