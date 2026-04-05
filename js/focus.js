// ===== focus.js — renderFocusTab orchestrator =====

import { renderHabits, renderHeatmap } from './habits.js';
import { renderStats } from './analytics.js';
import { renderBadges, checkBadges } from './badges.js';
import { getTodayPomoSessions } from './pomodoro.js';

export function renderFocusTab() {
  renderHabits(checkBadges, () => renderStats(getTodayPomoSessions), renderHeatmap);
  renderStats(getTodayPomoSessions);
  renderHeatmap();
  renderBadges();
}
