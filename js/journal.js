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

function renderMarkdown(md) {
  if (typeof marked === 'undefined') return md.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  return marked.parse(md, { breaks: true, gfm: true });
}

function showPreview(content) {
  const ta      = document.getElementById('journalTa');
  const preview = document.getElementById('journalPreview');
  const editBtn = document.getElementById('journalEditBtn');
  const saveBtn = document.getElementById('journalSaveBtn');
  if (!ta || !preview) return;
  preview.innerHTML = renderMarkdown(content);
  preview.style.display = 'block';
  ta.style.display      = 'none';
  if (editBtn) editBtn.style.display = '';
  if (saveBtn) saveBtn.style.display = 'none';
}

function showEditor() {
  const ta      = document.getElementById('journalTa');
  const preview = document.getElementById('journalPreview');
  const editBtn = document.getElementById('journalEditBtn');
  const saveBtn = document.getElementById('journalSaveBtn');
  if (!ta || !preview) return;
  preview.style.display = 'none';
  ta.style.display      = '';
  ta.focus();
  if (editBtn) editBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = '';
}

export function initJournal(config) {
  _config = config;

  const ta        = document.getElementById('journalTa');
  const saveBtn   = document.getElementById('journalSaveBtn');
  const editBtn   = document.getElementById('journalEditBtn');
  const prevBtn   = document.getElementById('journalPrevBtn');
  const nextBtn   = document.getElementById('journalNextBtn');
  const todayBtn  = document.getElementById('journalTodayBtn');

  ta?.addEventListener('input', () => {
    journalHasChanges = true;
    if (saveBtn) saveBtn.disabled = false;
  });

  saveBtn?.addEventListener('click', async () => {
    const content = ta?.value || '';
    saveJournalEntry(journalDate, content);
    journalHasChanges = false;
    if (saveBtn) saveBtn.disabled = true;
    if (content.trim()) showPreview(content);
    showStatus('Journal saved ✓');
    showCyberLoader('Saving Journal');
    await saveJournalToHackMD(content);
    hideCyberLoader();
  });

  editBtn?.addEventListener('click', () => {
    showEditor();
  });

  prevBtn?.addEventListener('click', () => {
    if (journalHasChanges) saveJournalEntry(journalDate, ta?.value || '');
    journalDate.setDate(journalDate.getDate() - 1);
    renderJournalDay();
  });

  nextBtn?.addEventListener('click', () => {
    if (journalHasChanges) saveJournalEntry(journalDate, ta?.value || '');
    if (journalDate < new Date()) {
      journalDate.setDate(journalDate.getDate() + 1);
      renderJournalDay();
    }
  });

  todayBtn?.addEventListener('click', () => {
    if (journalHasChanges) saveJournalEntry(journalDate, ta?.value || '');
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
