// ===== habits.js — habit tracker =====

import { escapeHtml } from './ui.js';
import { trackAnalytics } from './analytics.js';

let _habits   = [];
let _habitLog = {};
let _onDataChange = null;

export function initHabits(data, onDataChange) {
  _habits      = data.habits      || [];
  _habitLog    = data.habit_log   || {};
  _onDataChange = onDataChange;

  document.getElementById('habitAddBtn')?.addEventListener('click', () => {
    const form = document.getElementById('addHabitForm');
    form?.classList.toggle('hidden');
    if (form && !form.classList.contains('hidden')) {
      document.getElementById('habitName')?.focus();
    }
  });

  document.getElementById('habitSubmitBtn')?.addEventListener('click', submitHabit);
  document.getElementById('habitName')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitHabit(); });
}

// Expose for badges.js
export function getHabits()   { return _habits; }
export function getHabitLog() { return _habitLog; }

function todayKey() { return new Date().toISOString().slice(0, 10); }

export function habitStreak(habitId) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key  = d.toISOString().slice(0, 10);
    const done = (_habitLog[key] || []).includes(habitId);
    if (i === 0 && !done) { d.setDate(d.getDate() - 1); continue; }
    if (!done) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function isHabitDoneToday(habitId) {
  return (_habitLog[todayKey()] || []).includes(habitId);
}

export function isAnyHabitDoneToday() {
  return (_habitLog[todayKey()] || []).length > 0;
}

function toggleHabitToday(habitId) {
  const today = todayKey();
  if (!_habitLog[today]) _habitLog[today] = [];
  const idx = _habitLog[today].indexOf(habitId);
  if (idx === -1) { _habitLog[today].push(habitId); trackAnalytics('habit_done', 1); }
  else            { _habitLog[today].splice(idx, 1); }
  _onDataChange?.();
}

// Freeze tokens (still in localStorage for now)
export function getFreezeTokens() {
  const raw = JSON.parse(localStorage.getItem('freeze_tokens') || 'null');
  if (!raw) return { count: 2, lastReset: new Date().toISOString().slice(0, 7) };
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (raw.lastReset !== thisMonth) return { count: 2, lastReset: thisMonth };
  return raw;
}

export function renderHabits(checkBadges, renderStats, renderHeatmap) {
  const listEl = document.getElementById('habitList');
  if (!listEl) return;

  if (_habits.length === 0) {
    listEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">No habits yet. Add one to start tracking!</div>';
  } else {
    listEl.innerHTML = _habits.map(h => {
      const done   = isHabitDoneToday(h.id);
      const streak = habitStreak(h.id);
      const hot    = streak >= 3;
      return `<div class="habit-row" data-hid="${h.id}">
        <span class="habit-emoji">${escapeHtml(h.emoji || '🎯')}</span>
        <span class="habit-name">${escapeHtml(h.name)}</span>
        <span class="habit-streak${hot ? ' hot' : ''}">${streak > 0 ? (hot ? '🔥' : '') + streak + ' day' + (streak !== 1 ? 's' : '') : '—'}</span>
        <button class="habit-check-btn${done ? ' done' : ''}" data-action="toggle" data-hid="${h.id}">${done ? '✓' : ''}</button>
        <button class="habit-del-btn" data-action="del" data-hid="${h.id}" title="Delete">✕</button>
      </div>`;
    }).join('');

    listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', e => {
        toggleHabitToday(e.currentTarget.dataset.hid);
        renderHabits(checkBadges, renderStats, renderHeatmap);
        renderStats?.();
        renderHeatmap?.();
        checkBadges?.();
      });
    });

    listEl.querySelectorAll('[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', e => {
        const hid = e.currentTarget.dataset.hid;
        if (!confirm('Delete this habit and all its data?')) return;
        _habits = _habits.filter(x => x.id !== hid);
        _onDataChange?.();
        renderHabits(checkBadges, renderStats, renderHeatmap);
        renderHeatmap?.();
      });
    });
  }

  // Freeze tokens
  const ft      = getFreezeTokens();
  const iconsEl = document.getElementById('freezeIcons');
  const countEl = document.getElementById('freezeCount');
  if (iconsEl) {
    iconsEl.innerHTML = [0, 1].map(i => `<span class="freeze-icon${i < ft.count ? ' avail' : ''}" title="Freeze token">🧊</span>`).join('');
  }
  if (countEl) countEl.textContent = `(${ft.count}/2 this month)`;
}

function submitHabit() {
  const nameEl  = document.getElementById('habitName');
  const emojiEl = document.getElementById('habitEmoji');
  const name    = nameEl?.value.trim();
  const emoji   = emojiEl?.value.trim() || '🎯';
  if (!name) { nameEl?.focus(); return; }
  _habits.push({ id: Date.now().toString(36), name, emoji });
  _onDataChange?.();
  if (nameEl)  nameEl.value  = '';
  if (emojiEl) emojiEl.value = '';
  document.getElementById('addHabitForm')?.classList.add('hidden');
  renderHabits();
}

export function renderHeatmap() {
  const el = document.getElementById('habitHeatmap');
  if (!el) return;
  const totalHabits = _habits.length || 1;
  const WEEKS = 12;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - ((WEEKS - 1) * 7 + ((dayOfWeek + 6) % 7)));

  const cols = [];
  const d = new Date(startDate);
  while (d <= today) {
    const col = [];
    for (let dow = 0; dow < 7; dow++) {
      if (d > today) { col.push(null); d.setDate(d.getDate() + 1); continue; }
      const key   = d.toISOString().slice(0, 10);
      const count = (_habitLog[key] || []).length;
      const level = count === 0 ? 0 : Math.min(4, Math.ceil(count / totalHabits * 4));
      col.push({ key, level, count, date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
      d.setDate(d.getDate() + 1);
    }
    cols.push(col);
  }

  el.innerHTML = cols.map(col =>
    `<div class="heatmap-col">${col.map(c => c === null
      ? '<div class="heatmap-cell" style="opacity:0;"></div>'
      : `<div class="heatmap-cell${c.level > 0 ? ' l' + c.level : ''}" title="${c.date}: ${c.count} habit${c.count !== 1 ? 's' : ''}"></div>`
    ).join('')}</div>`
  ).join('');
}

export function getMaxCurrentStreak() {
  return Math.max(0, ..._habits.map(h => habitStreak(h.id)));
}

export function hasPerfectDay() {
  if (!_habits.length) return false;
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key  = d.toISOString().slice(0, 10);
    const done = _habitLog[key] || [];
    if (_habits.every(h => done.includes(h.id))) return true;
  }
  return false;
}
