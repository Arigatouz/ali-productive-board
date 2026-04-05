// ===== cmdpalette.js — command palette =====

import { escapeHtml } from './ui.js';

// CMD_LIST is built lazily after all modules load (actions need live references)
let CMD_LIST    = [];
let cmdSelectedIdx = 0;
let cmdFiltered    = [];

export function buildCmdList(context) {
  const {
    switchMainTab, applyTheme, showSettingsModal, showKbHelp, toggleQC,
    pomoToggle, pomoReset, pomoSkip,
  } = context;

  CMD_LIST = [
    { icon: '📋', label: 'Go to Tasks',         cat: 'Navigate', action: () => switchMainTab('tasks'),    sc: '1' },
    { icon: '🧠', label: 'Go to Memory',         cat: 'Navigate', action: () => switchMainTab('memory'),   sc: '2' },
    { icon: '📰', label: 'Go to Articles',       cat: 'Navigate', action: () => switchMainTab('articles'), sc: '3' },
    { icon: '🎯', label: 'Go to Focus',          cat: 'Navigate', action: () => switchMainTab('focus'),    sc: '4' },
    { icon: '📓', label: 'Go to Journal',        cat: 'Navigate', action: () => switchMainTab('journal'),  sc: '5' },
    { icon: '⏱️', label: 'Start / Pause Timer',  cat: 'Pomodoro', action: pomoToggle,                     sc: '⌃⌥T' },
    { icon: '↺',  label: 'Reset Timer',          cat: 'Pomodoro', action: pomoReset },
    { icon: '⏭️', label: 'Skip Phase',           cat: 'Pomodoro', action: pomoSkip },
    { icon: '➕', label: 'Add Task (first column)',cat: 'Tasks',   action: () => { switchMainTab('tasks'); setTimeout(() => { const btn = document.querySelector('[data-add]'); btn?.click(); }, 200); } },
    { icon: '🌗', label: 'Toggle Light/Dark',    cat: 'Theme',    action: () => { const t = document.documentElement.getAttribute('data-theme'); applyTheme(t === 'dark' || t === 'neon-dark' ? 'light' : 'dark'); } },
    { icon: '⚡', label: 'Cycle Theme',          cat: 'Theme',    action: () => { const themes = ['light','dark','neon-dark','neon-light']; const t = document.documentElement.getAttribute('data-theme'); applyTheme(themes[(themes.indexOf(t)+1)%themes.length]); } },
    { icon: '⚙️', label: 'Open Settings',        cat: 'Settings', action: showSettingsModal,              sc: ',' },
    { icon: '⌨️', label: 'Keyboard Shortcuts',   cat: 'Help',     action: showKbHelp,                     sc: '?' },
    { icon: '📥', label: 'Quick Capture',        cat: 'Capture',  action: toggleQC,                       sc: 'Ctrl+Shift+C' },
  ];
}

function openCmdPalette() {
  const overlay = document.getElementById('cmdOverlay');
  overlay?.classList.add('open');
  const input = document.getElementById('cmdInput');
  if (input) { input.value = ''; input.focus(); }
  cmdRender('');
}

function closeCmdPalette() {
  document.getElementById('cmdOverlay')?.classList.remove('open');
}

function cmdRender(query) {
  const q       = query.trim().toLowerCase();
  cmdFiltered   = q ? CMD_LIST.filter(c => c.label.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q)) : CMD_LIST;
  cmdSelectedIdx = 0;
  const el = document.getElementById('cmdResults');
  if (!el) return;
  if (!cmdFiltered.length) { el.innerHTML = '<div class="cmd-empty">No commands found</div>'; return; }

  const cats = {};
  cmdFiltered.forEach(c => { if (!cats[c.cat]) cats[c.cat] = []; cats[c.cat].push(c); });
  let html = '', idx = 0;
  Object.entries(cats).forEach(([cat, items]) => {
    html += `<div class="cmd-sec-lbl">${escapeHtml(cat)}</div>`;
    items.forEach(item => {
      html += `<div class="cmd-item${idx === 0 ? ' sel' : ''}" data-idx="${idx}">
        <span class="cmd-item-icon">${item.icon || ''}</span>
        <span class="cmd-item-lbl">${escapeHtml(item.label)}</span>
        ${item.sc ? `<span class="cmd-item-sc">${item.sc}</span>` : ''}
      </div>`;
      idx++;
    });
  });
  el.innerHTML = html;

  el.querySelectorAll('.cmd-item').forEach((el, i) => {
    el.addEventListener('click',      () => { cmdFiltered[i]?.action(); closeCmdPalette(); });
    el.addEventListener('mouseenter', () => { cmdSelectedIdx = i; cmdHighlight(); });
  });
}

function cmdHighlight() {
  const items = document.querySelectorAll('.cmd-item');
  items.forEach((el, i) => el.classList.toggle('sel', i === cmdSelectedIdx));
  items[cmdSelectedIdx]?.scrollIntoView({ block: 'nearest' });
}

export function initCmdPalette() {
  const overlay = document.getElementById('cmdOverlay');
  const input   = document.getElementById('cmdInput');

  overlay?.addEventListener('click', e => { if (e.target === overlay) closeCmdPalette(); });
  input?.addEventListener('input',   e => cmdRender(e.target.value));
  input?.addEventListener('keydown', e => {
    if      (e.key === 'ArrowDown') { e.preventDefault(); cmdSelectedIdx = Math.min(cmdSelectedIdx + 1, cmdFiltered.length - 1); cmdHighlight(); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); cmdSelectedIdx = Math.max(cmdSelectedIdx - 1, 0); cmdHighlight(); }
    else if (e.key === 'Enter')     { cmdFiltered[cmdSelectedIdx]?.action(); closeCmdPalette(); }
    else if (e.key === 'Escape')    { closeCmdPalette(); }
  });
}

export { openCmdPalette, closeCmdPalette };
