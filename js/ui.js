// ===== ui.js — shared UI utilities =====
// IMPORTANT: must not import from feature modules to avoid circular deps.

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    return '#';
  } catch { return '#'; }
}

// ── Status bar ────────────────────────────────────────────────────
export function showStatus(msg) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2500);
}

export function setSyncStatus(msg, color) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color || 'var(--text-muted)';
}

// ── Modal helpers ─────────────────────────────────────────────────
// Mutable ref so config.js can set the save callback without creating a circular dep
export const onSettingsSaveRef = { fn: null };

export function closeModal() {
  document.getElementById('modalOverlay')?.classList.remove('visible');
}

export function openModal() {
  document.getElementById('modalOverlay')?.classList.add('visible');
}

// ── Active tab state ──────────────────────────────────────────────
let _activeMainTab = 'tasks';

export function getActiveMainTab() { return _activeMainTab; }

// switchMainTab — pass a context object with renderFocusTab and renderJournalDay refs
export function switchMainTab(tab, context = {}) {
  _activeMainTab = tab;
  const ALL_TABS = ['tasks', 'memory', 'articles', 'focus', 'journal', 'chat', 'briefing', 'brainstorm'];
  ALL_TABS.forEach(t => {
    document.getElementById(t + 'TabBtn')?.classList.toggle('active', t === tab);
    document.getElementById(t + 'Panel')?.classList.toggle('active', t === tab);
  });

  const taskViewToggle = document.getElementById('taskViewToggle');
  const saveBtn        = document.getElementById('saveBtn');
  const articlesSaveBtn = document.getElementById('articlesSaveBtn');
  if (taskViewToggle) taskViewToggle.style.display = tab === 'tasks' ? 'flex' : 'none';
  if (saveBtn)        saveBtn.style.display         = tab === 'tasks' ? 'inline-flex' : 'none';
  if (articlesSaveBtn) articlesSaveBtn.style.display = tab === 'articles' ? 'inline-flex' : 'none';

  if (tab === 'tasks'   && context.renderTasks)      setTimeout(context.renderTasks, 0);
  if (tab === 'focus'   && context.renderFocusTab)   setTimeout(context.renderFocusTab, 50);
  if (tab === 'journal' && context.renderJournalDay) setTimeout(context.renderJournalDay, 50);
}
