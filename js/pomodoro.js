// ===== pomodoro.js — Pomodoro timer =====

import { trackAnalytics } from './analytics.js';
import { checkBadges, setBadgesPomoLog } from './badges.js';

const POMO_CIRC = 339;

let pomoState = {
  phase: 'focus', remaining: 25 * 60, running: false, sessions: 0,
  focusMins: 25, breakMins: 5, longMins: 15
};
let pomoInterval   = null;
let _pomoLog       = {};
let _onDataChange  = null;

export function initPomodoro(data, onDataChange) {
  _pomoLog      = data.pomo_log || {};
  _onDataChange = onDataChange;

  // Restore timer state from localStorage (volatile — paused on reload)
  const saved = JSON.parse(localStorage.getItem('pomo_state') || 'null');
  if (saved) {
    pomoState = { ...pomoState, ...saved };
    pomoState.running = false; // always paused on reload
    localStorage.setItem('pomo_state', JSON.stringify(pomoState));
  }

  pomoUpdateUI();

  document.getElementById('pomoStartBtn')?.addEventListener('click', pomoToggle);
  document.getElementById('pomoResetBtn')?.addEventListener('click', pomoReset);
  document.getElementById('pomoSkipBtn')?.addEventListener('click',  pomoSkip);
  document.getElementById('pomoWidget')?.addEventListener('click', () => {
    // Navigate to focus tab — handled by main.js wiring if not set here
    document.getElementById('focusTabBtn')?.click();
  });

  document.querySelectorAll('.pomo-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pomo-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      pomoState.focusMins = parseInt(btn.dataset.focus);
      pomoState.breakMins = parseInt(btn.dataset.break);
      pomoState.longMins  = parseInt(btn.dataset.long);
      pomoReset();
    });
  });
}

export function getTodayPomoSessions() {
  const today = new Date().toISOString().slice(0, 10);
  return _pomoLog[today] || 0;
}

function pomoSave() {
  localStorage.setItem('pomo_state', JSON.stringify(pomoState));
}

function pomoFmt(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function pomoTotalSecs() {
  if (pomoState.phase === 'focus')      return pomoState.focusMins * 60;
  if (pomoState.phase === 'long-break') return pomoState.longMins  * 60;
  return pomoState.breakMins * 60;
}

function pomoPhaseLabel() {
  return { focus: 'Focus', break: 'Short Break', 'long-break': 'Long Break' }[pomoState.phase] || 'Focus';
}

function pomoUpdateUI() {
  const timeStr = pomoFmt(pomoState.remaining);
  const lbl     = pomoPhaseLabel();
  const total   = pomoTotalSecs();
  const offset  = POMO_CIRC * (1 - pomoState.remaining / total);

  const ht = document.getElementById('pomoHeaderTime');
  const hl = document.getElementById('pomoHeaderPhase');
  const hw = document.getElementById('pomoWidget');
  if (ht) ht.textContent = timeStr;
  if (hl) hl.textContent = lbl;
  if (hw) hw.classList.toggle('running', pomoState.running);

  const rt = document.getElementById('pomoRingTime');
  const rl = document.getElementById('pomoRingLbl');
  const rp = document.getElementById('pomoRingProg');
  if (rt) rt.textContent = timeStr;
  if (rl) rl.textContent = lbl;
  if (rp) rp.style.strokeDashoffset = offset;

  const sb = document.getElementById('pomoStartBtn');
  if (sb) sb.textContent = pomoState.running ? 'Pause' : 'Start';

  const sr = document.getElementById('pomoSessRow');
  if (sr) {
    const todaySess = getTodayPomoSessions();
    let html = '<span style="margin-right:4px;">Sessions today:</span>';
    for (let i = 0; i < 4; i++) html += `<span class="pomo-sdot${i < todaySess ? ' done' : ''}"></span>`;
    if (todaySess > 4) html += `<span style="font-size:11px;color:var(--accent);margin-left:2px;">+${todaySess - 4}</span>`;
    sr.innerHTML = html;
  }

  if (pomoState.running) { document.title = `${timeStr} ${lbl} — Productivity`; }
  else                    { document.title = 'Productivity'; }
}

function logPomoSession() {
  const today = new Date().toISOString().slice(0, 10);
  _pomoLog[today] = (_pomoLog[today] || 0) + 1;
  setBadgesPomoLog(_pomoLog);
  _onDataChange?.();
  trackAnalytics('focus_mins', pomoState.focusMins);
}

function pomoAdvancePhase() {
  if (pomoState.phase === 'focus') {
    pomoState.sessions++;
    logPomoSession();
    checkBadges();
    const isLong = pomoState.sessions % 4 === 0;
    pomoState.phase = isLong ? 'long-break' : 'break';
  } else {
    pomoState.phase = 'focus';
  }
  pomoState.remaining = pomoTotalSecs();
  pomoState.running   = false;
  clearInterval(pomoInterval);
  pomoSave();
  pomoUpdateUI();
  if (Notification.permission === 'granted') {
    new Notification('Pomodoro', { body: pomoPhaseLabel() + ' time!', icon: '' });
  }
}

export function pomoToggle() {
  if (pomoState.running) {
    clearInterval(pomoInterval);
    pomoState.running = false;
  } else {
    if (Notification.permission === 'default') Notification.requestPermission();
    pomoState.running = true;
    pomoInterval = setInterval(() => {
      if (pomoState.remaining > 0) {
        pomoState.remaining--;
        pomoUpdateUI();
        pomoSave();
      } else {
        pomoAdvancePhase();
      }
    }, 1000);
  }
  pomoUpdateUI();
  pomoSave();
}

export function pomoReset() {
  clearInterval(pomoInterval);
  pomoState.running   = false;
  pomoState.remaining = pomoTotalSecs();
  pomoUpdateUI();
  pomoSave();
}

export function pomoSkip() {
  clearInterval(pomoInterval);
  pomoAdvancePhase();
}

// Expose pomo_log getter for data consolidation in main.js
export function getPomoLog() { return _pomoLog; }
