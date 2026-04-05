// ===== analytics.js — analytics tracking and stats gauge =====

let _analyticsData = {};
let _onDataChange = null;

export function initAnalytics(data, onDataChange) {
  _analyticsData = data.analytics || {};
  _onDataChange = onDataChange;
}

export function getAnalytics() {
  return _analyticsData;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function trackAnalytics(key, val) {
  const today = todayKey();
  if (!_analyticsData[today]) _analyticsData[today] = {};
  _analyticsData[today][key] = (_analyticsData[today][key] || 0) + val;
  _onDataChange?.();
}

export function getWeekScore(weekOffset = 0) {
  const log       = JSON.parse(localStorage.getItem('habit_log') || '{}');
  const habits    = JSON.parse(localStorage.getItem('habits') || '[]');
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const base      = new Date(today);
  base.setDate(today.getDate() - weekOffset * 7);

  let tasks = 0, focusMins = 0, habitDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(base); d.setDate(base.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = _analyticsData[key] || {};
    tasks    += day.tasks_done || 0;
    focusMins += day.focus_mins || 0;
    if (habits.length > 0) {
      const dayDone = (log[key] || []).length;
      habitDays += dayDone / habits.length;
    }
  }
  const score = Math.min(100, Math.round(tasks * 2 + focusMins / 3 + habitDays / 7 * 30));
  return { score, tasks, focusMins, habitDays: Math.round(habitDays * 100 / Math.max(habits.length * 7, 1)) };
}

export function renderStats(getTodayPomoSessions) {
  const curr  = getWeekScore(0);
  const prev  = getWeekScore(1);
  const score = curr.score;

  const fill    = document.getElementById('gaugeFill');
  const scoreEl = document.getElementById('gaugeScore');
  const deltaEl = document.getElementById('statsDelta');
  if (fill)    fill.style.strokeDashoffset = 226 * (1 - score / 100);
  if (scoreEl) scoreEl.textContent = score;
  if (deltaEl) {
    const diff = score - prev.score;
    if (diff > 0)      { deltaEl.textContent = `↑ +${diff} vs last week`; deltaEl.className = 'stats-delta up'; }
    else if (diff < 0) { deltaEl.textContent = `↓ ${diff} vs last week`; deltaEl.className = 'stats-delta dn'; }
    else               { deltaEl.textContent = '= Same as last week';     deltaEl.className = 'stats-delta'; }
  }

  const metricsEl = document.getElementById('statsMetrics');
  if (metricsEl) {
    const pomosToday = getTodayPomoSessions ? getTodayPomoSessions() : 0;
    const today = todayKey();
    metricsEl.innerHTML = `
      <div class="stat-row"><span class="stat-lbl">Tasks done (week)</span><span class="stat-val">${curr.tasks}</span></div>
      <div class="stat-row"><span class="stat-lbl">Focus time (week)</span><span class="stat-val">${curr.focusMins} min</span></div>
      <div class="stat-row"><span class="stat-lbl">Habit completion</span><span class="stat-val">${curr.habitDays}%</span></div>
      <div class="stat-row"><span class="stat-lbl">Pomodoros today</span><span class="stat-val">${pomosToday}</span></div>
    `;
  }

  const weekBarsEl = document.getElementById('weekBars');
  if (weekBarsEl) {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const bars = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const day = _analyticsData[key] || {};
      const s   = Math.min(100, (day.tasks_done || 0) * 2 + (day.focus_mins || 0) / 3);
      bars.push({ s, isToday: i === 0, label: days[d.getDay() === 0 ? 6 : d.getDay() - 1] });
    }
    const max = Math.max(...bars.map(b => b.s), 1);
    weekBarsEl.innerHTML = bars.map(b => `
      <div class="week-bar-wrap">
        <div class="week-bar${b.isToday ? ' today' : ''}" style="height:${Math.round(b.s / max * 40) + 2}px;"></div>
        <span class="week-bar-lbl">${b.label}</span>
      </div>
    `).join('');
  }
}

export function getMaxDailyTasks() {
  return Math.max(0, ...Object.values(_analyticsData).map(d => d.tasks_done || 0));
}
