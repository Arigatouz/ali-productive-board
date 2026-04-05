// ===== capture.js — quick capture =====

import { showStatus, getActiveMainTab } from './ui.js';
import { addCapturedTask, renderTasks } from './tasks.js';

export function toggleQC() {
  const modal = document.getElementById('qcModal');
  modal?.classList.toggle('open');
  if (modal?.classList.contains('open')) {
    document.getElementById('qcText')?.focus();
  }
}

export function closeQC() {
  document.getElementById('qcModal')?.classList.remove('open');
}

function saveQC() {
  const text = document.getElementById('qcText')?.value.trim();
  if (!text) return;
  addCapturedTask(text);
  if (getActiveMainTab() === 'tasks') renderTasks();
  const qcText = document.getElementById('qcText');
  if (qcText) qcText.value = '';
  closeQC();
  showStatus('Task captured ✓');
}

export function initCapture() {
  document.getElementById('qcBtn')?.addEventListener('click', toggleQC);
  document.getElementById('qcSaveBtn')?.addEventListener('click', saveQC);
  document.getElementById('qcText')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveQC(); }
    if (e.key === 'Escape') closeQC();
  });
}
