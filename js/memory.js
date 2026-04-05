// ===== memory.js — Memory viewer / editor =====

import { escapeHtml, safeUrl, showStatus, closeModal } from './ui.js';
import { getFullApiUrl, fetchWithRetry } from './api.js';
import { showCyberLoader, hideCyberLoader } from './loader.js';
import { showAuthError } from './config.js';

let memoryData = { claudeMd: null, memoryFiles: [], memoryDirs: {} };
let _config    = null;

export function initMemory(config) {
  _config = config;
}

// ── Parsing ───────────────────────────────────────────────────────

const MEMORY_SECTION_ORDER = ['Me', 'People', 'Terms', 'Projects', 'Preferences'];

function detectMemorySectionType(title, content) {
  if (title === 'People' || title === 'Terms' || title === 'Projects') return 'table';
  if (title === 'Preferences') return 'list';
  if (/^\s*\|.+\|\s*$/m.test(content)) return 'table';
  if (/^\s*[-*]\s+.+$/m.test(content)) return 'list';
  return 'text';
}

export function parseMemoryMarkdown(content) {
  const parsed = { title: 'Memory', intro: [], sectionOrder: [], sections: {}, rawContent: content };
  const lines  = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h1) { parsed.title = h1[1].trim() || parsed.title; continue; }
    if (h2) {
      currentSection = h2[1].trim();
      if (!parsed.sections[currentSection]) {
        parsed.sectionOrder.push(currentSection);
        parsed.sections[currentSection] = { title: currentSection, rawLines: [] };
      }
      continue;
    }
    if (currentSection) parsed.sections[currentSection].rawLines.push(line);
    else                parsed.intro.push(line);
  }

  for (const sectionName of parsed.sectionOrder) {
    const section     = parsed.sections[sectionName];
    const contentText = section.rawLines.join('\n').trim();
    section.content = contentText;
    section.type    = detectMemorySectionType(sectionName, contentText);
  }

  for (const required of MEMORY_SECTION_ORDER) {
    if (!parsed.sections[required]) {
      parsed.sectionOrder.push(required);
      parsed.sections[required] = { title: required, rawLines: [], content: '', type: detectMemorySectionType(required, '') };
    }
  }

  parsed.sectionOrder.sort((a, b) => {
    const ai = MEMORY_SECTION_ORDER.indexOf(a);
    const bi = MEMORY_SECTION_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return parsed;
}

export function serializeMemoryMarkdown(parsed) {
  const lines = [`# ${parsed.title || 'Memory'}`];
  const intro = (parsed.intro || []).join('\n').trim();
  if (intro) lines.push('', intro);
  for (const sectionName of parsed.sectionOrder) {
    const section = parsed.sections[sectionName];
    lines.push('', `## ${sectionName}`);
    if ((section.content || '').trim()) lines.push(section.content.trim());
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ── Rendering ─────────────────────────────────────────────────────

function renderMarkdownToHtml(md) {
  let html = escapeHtml(md);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g,    '<em>$1</em>');
  html = html.replace(/```[\s\S]*?```/g, match => {
    const code = match.replace(/```\w*\n?/g, '');
    return '<pre><code>' + code + '</code></pre>';
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/(\|.+\|\n\|[-| ]+\|\n(?:\|.+\|\n?)+)/g, match => {
    const lines   = match.trim().split('\n');
    const headers = lines[0].split('|').filter(c => c.trim());
    const rows    = lines.slice(2).map(row => row.split('|').filter(c => c.trim()));
    let table = '<table><thead><tr>';
    headers.forEach(h => table += `<th>${h.trim()}</th>`);
    table += '</tr></thead><tbody>';
    rows.forEach(row => {
      table += '<tr>';
      row.forEach(cell => table += `<td>${cell.trim()}</td>`);
      table += '</tr>';
    });
    table += '</tbody></table>';
    return table;
  });
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^(?!<[hupol]|<li|<table|<pre)(.+)$/gm, '<p>$1</p>');
  html = html.replace(/<p><\/p>/g, '').replace(/<p>\s*<\/p>/g, '');
  return html;
}

function parseMarkdownTable(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
  if (lines.length < 2) return null;
  const headers = lines[0].split('|').map(c => c.trim()).filter(Boolean);
  const rows    = lines.slice(2).map(l => l.split('|').map(c => c.trim()).filter(Boolean));
  return { headers, rows };
}

function renderMemorySectionBody(section) {
  if (!section.content) return '<p style="color: var(--text-muted);">No content yet. Click Edit to add details.</p>';
  if (section.type === 'table') {
    const table = parseMarkdownTable(section.content);
    if (table && table.headers.length) {
      let html = '<table class="memory-flat-table"><thead><tr>';
      table.headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
      html += '</tr></thead><tbody>';
      table.rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => html += `<td>${escapeHtml(cell)}</td>`);
        html += '</tr>';
      });
      html += '</tbody></table>';
      return html;
    }
  }
  if (section.type === 'list') {
    const items = section.content.split('\n').map(l => l.trim()).filter(Boolean);
    if (items.length) return `<ul class="memory-inline-list">${items.map(item => `<li>${escapeHtml(item.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
  }
  return `<div class="markdown-content">${renderMarkdownToHtml(section.content)}</div>`;
}

function renderMemoryOverview() {
  const container = document.getElementById('memoryContentContainer');
  if (!container || !memoryData.claudeMd?.parsed) return;
  const parsed = memoryData.claudeMd.parsed;
  let html = `<h1 class="memory-title" style="margin-bottom: 20px;">${escapeHtml(parsed.title)}</h1>`;
  parsed.sectionOrder.forEach(sectionName => {
    const section = parsed.sections[sectionName];
    html += `
      <div class="memory-section-card">
        <div class="memory-section-header">
          <div class="memory-section-title">${escapeHtml(sectionName)}</div>
          <button class="primary memory-edit-btn" data-section-name="${escapeHtml(sectionName)}">Edit</button>
        </div>
        <div class="memory-section-body">${renderMemorySectionBody(section)}</div>
      </div>
    `;
  });
  container.innerHTML = html;
  container.querySelectorAll('.memory-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openMemorySectionEditor(btn.dataset.sectionName));
  });
}

export function renderMemory() {
  renderMemoryTabs();
  renderMemoryContent();
}

function renderMemoryTabs() {
  const memoryTabsContainer = document.getElementById('memoryTabsContainer');
  if (!memoryTabsContainer) return;
  memoryTabsContainer.innerHTML = memoryData.claudeMd
    ? `<button class="memory-tab active" data-tab="overview">Overview</button>`
    : '';
  memoryTabsContainer.querySelectorAll('.memory-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      memoryTabsContainer.querySelectorAll('.memory-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderMemoryContent();
    });
  });
}

function renderMemoryContent() {
  const memoryTabsContainer = document.getElementById('memoryTabsContainer');
  const activeTab = memoryTabsContainer?.querySelector('.memory-tab.active');
  if (!activeTab) return;
  const tabId = activeTab.dataset.tab;
  if (tabId === 'overview') renderMemoryOverview();
}

// ── Modal actions ─────────────────────────────────────────────────

export function openMemorySectionEditor(sectionName) {
  if (!memoryData.claudeMd?.parsed) return;
  const section = memoryData.claudeMd.parsed.sections[sectionName];
  if (!section) return;
  const modalTitle = document.getElementById('modalTitle');
  const modalBody  = document.getElementById('modalBody');
  const overlay    = document.getElementById('modalOverlay');
  if (modalTitle) modalTitle.textContent = `Edit ${sectionName}`;
  if (modalBody)  modalBody.innerHTML = `
    <div class="form-group">
      <label>${section.type === 'table' ? 'Markdown table' : section.type === 'list' ? 'Bullet list' : 'Content'}</label>
      <textarea id="editContent" style="min-height: 400px;">${escapeHtml(section.content || '')}</textarea>
    </div>
  `;
  if (overlay) { overlay.classList.add('visible'); overlay.dataset.type = 'memorySection'; overlay.dataset.sectionName = sectionName; }
}

export function openFileModal(dirName, fileName) {
  const files = memoryData.memoryDirs[dirName];
  const file  = files?.find(f => f.name === fileName);
  if (!file) return;
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = getDisplayName(fileName);
  document.getElementById('modalBody').innerHTML = `
    <div class="markdown-content" style="margin-bottom: 20px;">${renderMarkdownToHtml(file.content)}</div>
    <div class="form-group">
      <label>Edit Raw Markdown</label>
      <textarea id="editContent">${escapeHtml(file.content)}</textarea>
    </div>
  `;
  if (overlay) { overlay.classList.add('visible'); overlay.dataset.type = 'dirFile'; overlay.dataset.dirName = dirName; overlay.dataset.fileName = fileName; }
}

export function openNewFileModal(dirName) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = `Add to ${dirName}`;
  let template = '# New Entry\n\n';
  const existingFiles = memoryData.memoryDirs[dirName];
  if (existingFiles && existingFiles.length > 0) {
    const sample = existingFiles[0].parsed;
    for (const key of Object.keys(sample.fields || {})) template += `**${key}:** \n`;
    template += '\n';
    for (const section of Object.keys(sample.sections || {})) {
      if (section !== '_intro') template += `## ${section}\n\n`;
    }
  }
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>Filename (without .md)</label>
      <input type="text" id="newFileName" placeholder="my-new-entry" style="width:100%;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text-primary);font-size:14px;font-family:inherit;margin-bottom:16px;">
    </div>
    <div class="form-group">
      <label>Content</label>
      <textarea id="editContent">${escapeHtml(template)}</textarea>
    </div>
  `;
  if (overlay) { overlay.classList.add('visible'); overlay.dataset.type = 'newDirFile'; overlay.dataset.dirName = dirName; }
}

export function filterMemoryDirectory(dirName, searchTerm) {
  const grid  = document.getElementById('dirGrid');
  const items = grid?.querySelectorAll('.memory-card, tr[data-search]');
  const search = searchTerm.toLowerCase();
  items?.forEach(item => {
    const searchData = item.dataset.search || '';
    item.style.display = (!search || searchData.includes(search)) ? '' : 'none';
  });
}

// ── Save modal handler ────────────────────────────────────────────

export async function saveMemoryModal() {
  const overlay  = document.getElementById('modalOverlay');
  const type     = overlay?.dataset.type;
  const content  = document.getElementById('editContent')?.value;

  showCyberLoader('Uploading Memory');
  try {
    if (type === 'memorySection') {
      const sectionName = overlay.dataset.sectionName;
      const parsed      = memoryData.claudeMd?.parsed;
      if (!parsed || !parsed.sections[sectionName]) throw new Error('Section not found');
      parsed.sections[sectionName].content = content.trim();
      memoryData.claudeMd.content = serializeMemoryMarkdown(parsed);
      await saveMemoryNoteContent(memoryData.claudeMd.content);
      memoryData.claudeMd.parsed = parseMemoryMarkdown(memoryData.claudeMd.content);
      showStatus(`Saved ${sectionName} ✓`);
    } else if (type === 'dirFile') {
      const { dirName, fileName } = overlay.dataset;
      const file = memoryData.memoryDirs[dirName]?.find(f => f.name === fileName);
      if (file) { file.content = content; file.parsed = parseMemoryMarkdown(content); showStatus('Saved ' + fileName); }
    }
    closeModal();
    renderMemory();
  } catch (e) {
    showStatus('Error saving: ' + e.message);
  }
  hideCyberLoader();
}

async function saveMemoryNoteContent(content) {
  if (!_config.API_TOKEN)       throw new Error('API Token is not configured');
  if (!_config.MEMORY_NOTE_ID)  throw new Error('Memory Note ID is not configured — check Settings');
  const res = await fetchWithRetry(getFullApiUrl(`/notes/${_config.MEMORY_NOTE_ID}`, _config), {
    method:  'PATCH',
    headers: { 'Authorization': 'Bearer ' + _config.API_TOKEN, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content })
  });
  if (!res.ok) {
    if (res.status === 401) { showAuthError(_config); throw new Error('Unauthorized — check your API token'); }
    if (res.status === 403) throw new Error('Permission denied');
    if (res.status === 404) throw new Error('Memory note not found — check the Note ID in Settings');
    throw new Error(`Save failed (HTTP ${res.status})`);
  }
}

// ── HackMD load ───────────────────────────────────────────────────

export async function loadMemoryFromAPI(config) {
  _config = config;
  if (!config.API_TOKEN) { showStatus('Error: HackMD API Token is not configured'); return; }
  try {
    const res = await fetch(getFullApiUrl(`/notes/${config.MEMORY_NOTE_ID}`, config), {
      headers: { 'Authorization': 'Bearer ' + config.API_TOKEN }
    });
    if (!res.ok) {
      if (res.status === 401) { showAuthError(config); throw new Error('Unauthorized'); }
      throw new Error('Failed to load memory');
    }
    const data   = await res.json();
    const parsed = parseMemoryMarkdown(data.content);
    memoryData   = { claudeMd: { content: data.content, parsed }, memoryFiles: [], memoryDirs: {} };
    renderMemory();
    const emptyEl = document.getElementById('memoryEmptyState');
    if (emptyEl) emptyEl.style.display = 'none';
    const mainEl = document.getElementById('memoryMainContent');
    if (mainEl) mainEl.style.display = 'flex';
    const filePathEl = document.getElementById('filePath');
    if (filePathEl) filePathEl.textContent = 'HackMD';
    showStatus('Memory loaded from HackMD');
  } catch (e) {
    showStatus('Error loading memory: ' + e.message);
  }
}

function getDisplayName(filename) {
  return filename.replace('.md', '').split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
