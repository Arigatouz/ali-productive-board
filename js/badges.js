// ===== badges.js — achievements / badge system =====

import { escapeHtml } from './ui.js';
import { getMaxCurrentStreak, hasPerfectDay, getHabits } from './habits.js';
import { getMaxDailyTasks } from './analytics.js';

let _badgesUnlocked = {};
let _pomoLog = {};
let _onDataChange = null;

export const BADGE_DEFS = [
  { id: 'first_pomo',  icon: '⏱️', name: 'First Pomo',    desc: 'Complete your first Pomodoro session',  check: () => getTodayPomoSessions() >= 1 || getWeekPomoTotal() >= 1 },
  { id: 'pomo_5',      icon: '🔥', name: 'On a Roll',     desc: 'Complete 5 Pomodoro sessions total',    check: () => getAllPomoTotal() >= 5 },
  { id: 'pomo_50',     icon: '⚔️', name: 'Focus Knight',  desc: 'Complete 50 Pomodoro sessions total',   check: () => getAllPomoTotal() >= 50 },
  { id: 'streak_3',    icon: '✨', name: '3-Day Streak',   desc: 'Maintain a 3-day habit streak',         check: () => getMaxCurrentStreak() >= 3 },
  { id: 'streak_7',    icon: '🌟', name: '7-Day Blazer',   desc: 'Maintain a 7-day habit streak',         check: () => getMaxCurrentStreak() >= 7 },
  { id: 'streak_30',   icon: '💎', name: '30-Day Legend',  desc: 'Maintain a 30-day habit streak',        check: () => getMaxCurrentStreak() >= 30 },
  { id: 'perfect_day', icon: '🎯', name: 'Perfect Day',    desc: 'Complete all habits in a day',          check: () => hasPerfectDay() },
  { id: 'task_10',     icon: '✅', name: 'Task Master',    desc: 'Complete 10 tasks in one day',          check: () => getMaxDailyTasks() >= 10 },
  { id: 'early_bird',  icon: '🐦', name: 'Early Bird',     desc: 'Log a habit before 8 AM',               check: () => !!_badgesUnlocked['early_bird_flag'] },
  { id: 'night_owl',   icon: '🦉', name: 'Night Owl',      desc: 'Log a habit after 10 PM',               check: () => !!_badgesUnlocked['night_owl_flag'] },
  { id: 'renaissance', icon: '🎨', name: 'Renaissance',    desc: 'Have 4+ different habits',              check: () => getHabits().length >= 4 },
  { id: 'journal_3',   icon: '📓', name: 'Journal Keeper', desc: 'Write 3 journal entries',               check: () => getJournalCount() >= 3 },
];

export function initBadges(data, onDataChange) {
  _badgesUnlocked = data.badges_unlocked || {};
  _pomoLog        = data.pomo_log        || {};
  _onDataChange   = onDataChange;
}

// Sync pomo_log reference when pomodoro module updates it
export function setBadgesPomoLog(log) { _pomoLog = log; }

function getTodayPomoSessions() {
  const today = new Date().toISOString().slice(0, 10);
  return _pomoLog[today] || 0;
}

function getWeekPomoTotal() {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    total += _pomoLog[d.toISOString().slice(0, 10)] || 0;
  }
  return total;
}

function getAllPomoTotal() {
  return Object.values(_pomoLog).reduce((a, b) => a + b, 0);
}

function getJournalCount() {
  return Object.keys(JSON.parse(localStorage.getItem('journal') || '{}')).length;
}

export function checkBadges() {
  let changed = false;
  BADGE_DEFS.forEach(b => {
    if (!_badgesUnlocked[b.id]) {
      // Check time-of-day flags for early bird / night owl
      if (b.id === 'early_bird') {
        const hour = new Date().getHours();
        if (hour < 8) { _badgesUnlocked['early_bird_flag'] = true; }
      }
      if (b.id === 'night_owl') {
        const hour = new Date().getHours();
        if (hour >= 22) { _badgesUnlocked['night_owl_flag'] = true; }
      }
      if (b.check()) {
        _badgesUnlocked[b.id] = new Date().toISOString().slice(0, 10);
        changed = true;
        showBadgeToast(b);
      }
    }
  });
  if (changed) _onDataChange?.();
  renderBadges();
}

export function showBadgeToast(badge) {
  const toast = document.getElementById('badgeToast');
  const icon  = document.getElementById('badgeToastIcon');
  const title = document.getElementById('badgeToastTitle');
  const sub   = document.getElementById('badgeToastSub');
  if (!toast) return;
  if (icon)  icon.textContent  = badge.icon;
  if (title) title.textContent = 'Achievement Unlocked!';
  if (sub)   sub.textContent   = badge.name + ': ' + badge.desc;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

export function renderBadges() {
  const el = document.getElementById('badgesGrid');
  if (!el) return;
  el.innerHTML = BADGE_DEFS.map(b => {
    const isUnlocked = !!_badgesUnlocked[b.id];
    return `<div class="badge-item${isUnlocked ? ' unlocked' : ' locked'}" title="${escapeHtml(b.desc)}">
      <span class="badge-icon">${b.icon}</span>
      <span class="badge-name">${escapeHtml(b.name)}</span>
    </div>`;
  }).join('');
}

export function getBadgesUnlocked() { return _badgesUnlocked; }
