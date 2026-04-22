// ===== journal.js — daily journal with localStorage + optional HackMD sync =====

import { showStatus } from './ui.js';
import { getFullApiUrl, fetchWithRetry } from './api.js';
import { showCyberLoader, hideCyberLoader } from './loader.js';
import { checkBadges } from './badges.js';

export const JOURNAL_PROMPTS = [
  'What is one thing you want to accomplish today?',
  'What went well yesterday? What would you change?',
  'What are you grateful for right now?',
  'What is the one task that would make today successful?',
  'What is on your mind that you want to get out of your head?',
  'What is something you learned recently?',
  'What are you looking forward to?',
  'Describe your current energy level and why.',
];

let journalDate       = new Date();
let journalHasChanges = false;
let _config           = null;

// Cached DOM refs — populated once in initJournal()
let _ta      = null;
let _preview = null;
let _editBtn = null;
let _saveBtn = null;

const escapeHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/**
 * Sanitize rendered HTML using the browser's own DOM parser.
 * Removes <script>/<iframe>/etc., strips event-handler attributes,
 * and neutralises javascript: URLs.  Adds noopener to external links.
 */
function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if ((attr.name === 'href' || attr.name === 'src' || attr.name === 'action') &&
          /^\s*javascript:/i.test(attr.value)) {
        el.setAttribute(attr.name, '#');
      }
    }
    if (el.tagName === 'A' && el.getAttribute('href')) {
      const href = el.getAttribute('href');
      if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
        el.setAttribute('rel', 'noopener noreferrer');
        el.setAttribute('target', '_blank');
      }
    }
  });
  return doc.body.innerHTML;
}

function renderMarkdown(md) {
  if (typeof marked === 'undefined') return escapeHtml(md);
  try {
    return sanitizeHtml(marked.parse(md, { breaks: true, gfm: true }));
  } catch {
    return escapeHtml(md);
  }
}

function showPreview(content) {
  if (!_ta || !_preview) return;
  _preview.innerHTML    = renderMarkdown(content);
  _preview.style.display = 'block';
  _ta.style.display      = 'none';
  if (_editBtn) _editBtn.style.display = '';
  if (_saveBtn) _saveBtn.style.display = 'none';
}

function showEditor() {
  if (!_ta || !_preview) return;
  _preview.style.display = 'none';
  _ta.style.display      = '';
  _ta.focus();
  if (_editBtn) _editBtn.style.display = 'none';
  if (_saveBtn) _saveBtn.style.display = '';
}

export function initJournal(config) {
  _config = config;

  _ta      = document.getElementById('journalTa');
  _saveBtn = document.getElementById('journalSaveBtn');
  _editBtn = document.getElementById('journalEditBtn');
  _preview = document.getElementById('journalPreview');

  const prevBtn   = document.getElementById('journalPrevBtn');
  const nextBtn   = document.getElementById('journalNextBtn');
  const todayBtn  = document.getElementById('journalTodayBtn');

  _ta?.addEventListener('input', () => {
    journalHasChanges = true;
    if (_saveBtn) _saveBtn.disabled = false;
  });

  _saveBtn?.addEventListener('click', async () => {
    const content = _ta?.value || '';
    saveJournalEntry(journalDate, content);
    journalHasChanges = false;
    if (_saveBtn) _saveBtn.disabled = true;
    if (content.trim()) {
      showPreview(content);
    } else {
      showEditor();
    }
    showStatus('Journal saved ✓');
    showCyberLoader('Saving Journal');
    await saveJournalToHackMD(content);
    hideCyberLoader();
  });

  _editBtn?.addEventListener('click', () => {
    showEditor();
  });

  prevBtn?.addEventListener('click', () => {
    if (journalHasChanges) saveJournalEntry(journalDate, _ta?.value || '');
    journalDate.setDate(journalDate.getDate() - 1);
    renderJournalDay();
  });

  nextBtn?.addEventListener('click', () => {
    if (journalHasChanges) saveJournalEntry(journalDate, _ta?.value || '');
    if (journalDate < new Date()) {
      journalDate.setDate(journalDate.getDate() + 1);
      renderJournalDay();
    }
  });

  todayBtn?.addEventListener('click', () => {
    if (journalHasChanges) saveJournalEntry(journalDate, _ta?.value || '');
    journalDate = new Date();
    renderJournalDay();
  });
}

function journalDateKey(d) { return (d || journalDate).toISOString().slice(0, 10); }

function loadJournalEntry(d) {
  const journal = JSON.parse(localStorage.getItem('journal') || '{}');
  return journal[journalDateKey(d)] || '';
}

function saveJournalEntry(d, text) {
  const journal = JSON.parse(localStorage.getItem('journal') || '{}');
  const key     = journalDateKey(d);
  if (text.trim()) journal[key] = text;
  else             delete journal[key];
  localStorage.setItem('journal', JSON.stringify(journal));
  checkBadges();
}

function formatJournalDate(d) {
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diff   = Math.round((today - target) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today — ' + d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  if (diff === 1) return 'Yesterday — ' + d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function renderJournalDay() {
  const lblEl    = document.getElementById('journalDateLbl');
  const ta       = document.getElementById('journalTa');
  const promptEl = document.getElementById('journalPrompt');
  const saveBtn  = document.getElementById('journalSaveBtn');
  if (!lblEl || !ta) return;

  const content = loadJournalEntry();
  lblEl.textContent = formatJournalDate(journalDate);
  ta.value          = content;
  journalHasChanges = false;
  if (saveBtn) saveBtn.disabled = true;

  if (content.trim()) {
    showPreview(content);
  } else {
    showEditor();
  }

  if (promptEl) {
    const today  = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(journalDate); target.setHours(0, 0, 0, 0);
    if (today.getTime() === target.getTime()) {
      const idx = Math.floor(Date.now() / 86400000) % JOURNAL_PROMPTS.length;
      promptEl.textContent = '✏️ ' + JOURNAL_PROMPTS[idx];
    } else {
      promptEl.textContent = '';
    }
  }
}

/**
 * Parse a HackMD journal note (markdown) into a {date: text} object.
 * Expected format produced by saveJournalToHackMD:
 *   ## YYYY-MM-DD
 *
 *   <entry text>
 *
 * ---
 */
function parseJournalMarkdown(md) {
  const entries = {};
  if (!md) return entries;
  // Split on section separators and date headers
  const sectionRe = /^## (\d{4}-\d{2}-\d{2})\s*\n([\s\S]*?)(?=\n---\n|\n*$)/gm;
  let match;
  while ((match = sectionRe.exec(md)) !== null) {
    const date = match[1];
    const text = match[2].trim();
    if (date && text) entries[date] = text;
  }
  return entries;
}

/**
 * Fetch journal entries from HackMD and merge them into localStorage.
 * Merge strategy: HackMD entries fill dates not present locally;
 * local entries for the same date are kept (local edits win).
 * After merging, re-render the current journal day.
 */
export async function loadJournalFromHackMD(config) {
  if (!config?.JOURNAL_NOTE_ID || !config?.API_TOKEN) return;
  try {
    const res = await fetch(getFullApiUrl('/notes/' + config.JOURNAL_NOTE_ID, config), {
      headers: { 'Authorization': 'Bearer ' + config.API_TOKEN }
    });
    if (!res.ok) return;
    const json    = await res.json();
    const remote  = parseJournalMarkdown(json.content || '');
    const local   = JSON.parse(localStorage.getItem('journal') || '{}');
    // Merge: remote entries fill gaps; local entries for the same date win
    const merged  = { ...remote, ...local };
    localStorage.setItem('journal', JSON.stringify(merged));
    renderJournalDay();
  } catch (err) {
    console.warn('Failed to load journal from HackMD:', err);
    /* silent fail — local copy is safe */
  }
}

async function saveJournalToHackMD(content) {
  if (!_config?.JOURNAL_NOTE_ID || !_config?.API_TOKEN) return;
  const journal  = JSON.parse(localStorage.getItem('journal') || '{}');
  const entries  = Object.entries(journal).sort((a, b) => b[0].localeCompare(a[0]));
  const md       = '# Journal\n\n' + entries.map(([date, text]) => `## ${date}\n\n${text}\n`).join('\n---\n\n');
  try {
    await fetchWithRetry(getFullApiUrl('/notes/' + _config.JOURNAL_NOTE_ID, _config), {
      method:  'PATCH',
      headers: { 'Authorization': 'Bearer ' + _config.API_TOKEN, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: md })
    });
  } catch { /* silent fail — local copy is safe */ }
}
