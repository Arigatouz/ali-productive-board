// ===== brainstorm.js — Brainstorming sessions synced to HackMD =====

import { callAI, extractUrls, openInNewTab, getAIConfig } from './ai-config.js';
import { getFullApiUrl } from './api.js';
import { showStatus } from './ui.js';
import { dbGet } from './db.js';

let brainstormData = [];
let isModified = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function parseBrainstormMarkdown(md) {
  if (!md) return [];
  const sections = md.split(/^## /m).filter(Boolean);
  return sections.map(section => {
    const lines = section.trim().split('\n');
    const title = lines[0].replace(/^##\s*/, '').trim();
    const content = lines.slice(1).join('\n').trim();
    return { title, content, expanded: false, editing: false };
  });
}

function renderMarkdown(content) {
  if (!content) return '<em style="opacity:0.4">No content yet — click ✎ to edit</em>';
  return window.marked ? window.marked.parse(content) : escapeHtml(content);
}

function toBrainstormMarkdown(sessions) {
  return sessions.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');
}

function renderSessions() {
  const container = document.getElementById('bsSessions');
  if (!container) return;

  if (brainstormData.length === 0) {
    container.innerHTML = '<div class="bs-empty">No sessions yet. Click + New Session to start.</div>';
    return;
  }

  container.innerHTML = brainstormData.map((s, i) => `
    <div class="bs-session ${s.expanded ? 'expanded' : ''}" data-idx="${i}">
      <div class="bs-session-header" data-idx="${i}">
        <span class="bs-session-expand">${s.expanded ? '▾' : '▸'}</span>
        <span class="bs-session-title">${escapeHtml(s.title)}</span>
        <div class="bs-session-actions">
          ${s.expanded ? `<button class="bs-action-btn" data-action="${s.editing ? 'done-editing' : 'edit'}" data-idx="${i}" title="${s.editing ? 'Done' : 'Edit'}">${s.editing ? '✓' : '✎'}</button>` : ''}
          <button class="bs-action-btn" data-action="brainstorm-ai" data-idx="${i}" title="AI brainstorm on this topic">🧠</button>
          <button class="bs-action-btn" data-action="delete" data-idx="${i}" title="Delete session">✕</button>
        </div>
      </div>
      ${s.expanded ? `<div class="bs-session-content">${
        s.editing
          ? `<textarea class="bs-textarea" data-idx="${i}">${escapeHtml(s.content)}</textarea>`
          : `<div class="bs-content-rendered" data-idx="${i}">${renderMarkdown(s.content)}</div>`
      }</div>` : ''}
    </div>
  `).join('');

  // Wire events
  container.querySelectorAll('.bs-session-header').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.bs-action-btn')) return;
      const idx = parseInt(el.dataset.idx);
      brainstormData[idx].expanded = !brainstormData[idx].expanded;
      renderSessions();
    });
  });

  container.querySelectorAll('.bs-action-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(el.dataset.idx);
      const action = el.dataset.action;
      if (action === 'delete') {
        brainstormData.splice(idx, 1);
        isModified = true;
        renderSessions();
      } else if (action === 'edit') {
        brainstormData[idx].editing = true;
        renderSessions();
        const ta = container.querySelector(`.bs-textarea[data-idx="${idx}"]`);
        if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      } else if (action === 'done-editing') {
        brainstormData[idx].editing = false;
        renderSessions();
      } else if (action === 'brainstorm-ai') {
        brainstormWithAI(idx);
      }
    });
  });

  container.querySelectorAll('.bs-textarea').forEach(el => {
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx);
      brainstormData[idx].content = el.value;
      isModified = true;
    });
  });
}

async function brainstormWithAI(idx) {
  const config = getAIConfig();
  if (!config.cors_proxy) {
    showStatus('Configure the CORS proxy (worker URL) in Settings to use AI');
    return;
  }

  const session = brainstormData[idx];
  if (!session) return;

  showStatus('Brainstorming with AI…');
  try {
    const messages = [
      { role: 'system', content: 'You are a creative brainstorming partner. Help explore ideas, suggest alternatives, and ask probing questions. Respond in markdown. Be concise but insightful. Support both Arabic and English.' },
      { role: 'user', content: `I'm brainstorming about: "${session.title}"\n\nCurrent notes:\n${session.content || '(empty)'}\n\nHelp me expand on this topic. Suggest new angles and ideas.` },
    ];
    const response = await callAI(messages, { maxTokens: 512 });
    session.content = (session.content ? session.content + '\n\n---\n\n### AI Suggestions\n\n' : '### AI Suggestions\n\n') + response;
    session.expanded = true;
    isModified = true;
    renderSessions();
    showStatus('AI suggestions added');
  } catch (err) {
    showStatus('Brainstorm failed: ' + err.message);
  }
}

export async function loadBrainstormFromHackMD(config) {
  if (!config.BRAINSTORM_NOTE_ID) return;
  try {
    const res = await fetch(getFullApiUrl(`/notes/${config.BRAINSTORM_NOTE_ID}`, config), {
      headers: { Authorization: `Bearer ${config.API_TOKEN}` },
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    brainstormData = parseBrainstormMarkdown(data.content || '');
    brainstormData.forEach(s => s.expanded = false);
    isModified = false;
  } catch (err) {
    console.warn('Failed to load brainstorm note:', err);
  }
  renderSessions();
}

export async function saveBrainstormToHackMD(config) {
  if (!config.BRAINSTORM_NOTE_ID) {
    showStatus('Set a Brainstorm Note ID in Settings');
    return;
  }
  if (!isModified) {
    showStatus('No changes to save');
    return;
  }
  const md = toBrainstormMarkdown(brainstormData);
  const saveBtn = document.getElementById('bsSaveBtn');
  try {
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    const res = await fetch(getFullApiUrl(`/notes/${config.BRAINSTORM_NOTE_ID}`, config), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${config.API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: md }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    isModified = false;
    showStatus('Brainstorm saved ✓');
  } catch (err) {
    showStatus('Save failed: ' + err.message);
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save to HackMD'; }
  }
}

export function initBrainstorm(config) {
  const addBtn = document.getElementById('bsAddBtn');
  const saveBtn = document.getElementById('bsSaveBtn');

  if (addBtn) addBtn.addEventListener('click', () => {
    const title = prompt('Session topic:');
    if (!title) return;
    brainstormData.unshift({ title, content: '', expanded: true, editing: true });
    isModified = true;
    renderSessions();
  });

  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const freshConfig = await loadFreshConfig();
    await saveBrainstormToHackMD(freshConfig);
  });
}

async function loadFreshConfig() {
  const [API_TOKEN, BRAINSTORM_NOTE_ID, cors_proxy] = await Promise.all([
    dbGet('api_token'),
    dbGet('brainstorm_id'),
    dbGet('cors_proxy'),
  ]);
  return {
    API_TOKEN: API_TOKEN || '',
    BRAINSTORM_NOTE_ID: BRAINSTORM_NOTE_ID || '',
    CORS_PROXY: cors_proxy || '',
  };
}

export function renderBrainstorm() {
  renderSessions();
}