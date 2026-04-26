// ===== main.js — application entry point =====

import { initDB, migrateFromLocalStorage } from './db.js';
import { loadConfig, saveConfig, showSettingsModal } from './config.js';
import { loadDashboardData, scheduleSave } from './data-sync.js';
import { initTheme, applyTheme } from './theme.js';
import { showStatus, setSyncStatus, switchMainTab, closeModal, onSettingsSaveRef } from './ui.js';
import { showCyberLoader, hideCyberLoader } from './loader.js';

import { initAnalytics, getAnalytics } from './analytics.js';
import { initHabits, getHabits, getHabitLog } from './habits.js';
import { initBadges, checkBadges, getBadgesUnlocked, setBadgesJournalCountFn } from './badges.js';
import { initPomodoro, pomoToggle, pomoReset, pomoSkip, getPomoLog } from './pomodoro.js';
import { renderFocusTab } from './focus.js';
import { renderJournalDay, initJournal, loadJournalFromHackMD, getJournalCount } from './journal.js';

import { initTasks, loadTasksFromAPI, renderTasks } from './tasks.js';
import { initMemory, loadMemoryFromAPI, openMemorySectionEditor, openFileModal, openNewFileModal, filterMemoryDirectory, saveMemoryModal } from './memory.js';
import { initArticles, loadArticlesFromAPI } from './articles.js';

import { initCmdPalette, buildCmdList, openCmdPalette, closeCmdPalette } from './cmdpalette.js';
import { initCapture, toggleQC, closeQC } from './capture.js';
import { initKeyboard, showKbHelp, closeKbModal } from './keyboard.js';
import { initSpeech, toggleSpeech, cycleLangMode } from './speech.js';
import { initArticleChat, renderArticleChat } from './article-chat.js';
import { initMorningBriefing, generateBriefing, speakBriefing } from './morning-briefing.js';
import { initBrainstorm, loadBrainstormFromHackMD, saveBrainstormToHackMD, renderBrainstorm } from './brainstorm.js';
import { loadAIConfig, saveAIConfig } from './ai-config.js';

// ── Data consolidation ────────────────────────────────────────────
// Central getter for the current in-memory data snapshot (for saveDashboardData)
function getCurrentData() {
  return {
    habits:          getHabits(),
    habit_log:       getHabitLog(),
    badges_unlocked: getBadgesUnlocked(),
    pomo_log:        getPomoLog(),
    analytics:       getAnalytics(),
    freeze_tokens:   JSON.parse(localStorage.getItem('freeze_tokens') || 'null') || { count: 2, lastReset: '' },
  };
}

// ── Entry point ───────────────────────────────────────────────────
async function initDashboard() {
  // Foundation
  await initDB();
  await migrateFromLocalStorage();
  const config = await loadConfig();
  await initTheme();

  // Load AI config (API keys, provider selection)
  const aiConfig = await loadAIConfig();

  // Load dashboard data from HackMD (falls back to defaults silently)
  const data = await loadDashboardData(config);

  // Debounced save callback
  const onDataChange = () => scheduleSave(config, getCurrentData);

  // Feature module init
  initAnalytics(data, onDataChange);
  initHabits(data, onDataChange);
  initBadges(data, onDataChange);
  initPomodoro(data, onDataChange);
  initJournal(config);
  setBadgesJournalCountFn(getJournalCount);

  // Build switchMainTab context
  const tabContext = {
    renderTasks,
    renderFocusTab,
    renderJournalDay,
    renderArticleChat,
    renderBrainstorm,
  };

  // Tab button wiring (use closure over tabContext)
  const bindTab = (id, tab) => document.getElementById(id)?.addEventListener('click', () => switchMainTab(tab, tabContext));
  bindTab('tasksTabBtn',    'tasks');
  bindTab('memoryTabBtn',   'memory');
  bindTab('articlesTabBtn', 'articles');
  bindTab('focusTabBtn',    'focus');
  bindTab('journalTabBtn',  'journal');
  bindTab('chatTabBtn',      'chat');
  bindTab('briefingTabBtn',  'briefing');
  bindTab('brainstormTabBtn','brainstorm');

  // Build command list (needs live function refs)
  buildCmdList({
    switchMainTab: (tab) => switchMainTab(tab, tabContext),
    applyTheme,
    showSettingsModal: () => showSettingsModal(config, saveConfig),
    showKbHelp,
    toggleQC,
    pomoToggle,
    pomoReset,
    pomoSkip,
    toggleSpeech,
    cycleLangMode,
  });

  initCmdPalette();
  initCapture();
  initSpeech();
  initKeyboard({
    switchMainTab:    (tab) => switchMainTab(tab, tabContext),
    openCmdPalette,
    closeCmdPalette,
    closeModal,
    closeQC,
    toggleQC,
    pomoToggle,
    toggleSpeech,
    cycleLangMode,
  });

  // Tasks, memory, articles
  initTasks(config);
  initMemory(config);
  initArticles(config);
  initArticleChat(aiConfig);
  initMorningBriefing(aiConfig);
  initBrainstorm(config);

  // Settings button
  document.getElementById('settingsBtn')?.addEventListener('click', () => showSettingsModal(config, saveConfig));

  // Modal wiring (shared)
  document.getElementById('modalClose')?.addEventListener('click',  closeModal);
  document.getElementById('modalCancel')?.addEventListener('click', closeModal);
  document.getElementById('modalSave')?.addEventListener('click',   handleModalSave);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Initial badge check
  checkBadges();

  // Load from HackMD or show settings
  if (config.API_TOKEN && config.TASKS_NOTE_ID) {
    await Promise.all([
      loadTasksFromAPI(config),
      loadMemoryFromAPI(config),
      loadArticlesFromAPI(config),
      loadJournalFromHackMD(config),
      loadBrainstormFromHackMD(config),
    ]);
  } else {
    showStatus('Please configure your HackMD settings');
    showSettingsModal(config, saveConfig);
  }
}

// ── Modal save dispatcher ─────────────────────────────────────────
async function handleModalSave() {
  const overlay = document.getElementById('modalOverlay');
  const type    = overlay?.dataset.type;

  if (type === 'settings') {
    if (onSettingsSaveRef.fn) await onSettingsSaveRef.fn();
    return;
  }

  // Memory section / file edits
  await saveMemoryModal();
}

// ── Window exposures (for legacy inline HTML onclick still present in memory.js templates) ──
window.openFileModal            = openFileModal;
window.openNewFileModal         = openNewFileModal;
window.openMemorySectionEditor  = openMemorySectionEditor;
window.filterMemoryDirectory    = filterMemoryDirectory;
window.closeKbModal             = closeKbModal;
window.showKbHelp               = showKbHelp;
window.showCyberLoader          = showCyberLoader;
window.hideCyberLoader          = hideCyberLoader;

// Start
initDashboard().catch(err => {
  console.error('initDashboard failed:', err);
});
