// ===== keyboard.js — global keyboard shortcuts & help modal =====

export function showKbHelp() {
  document.getElementById('kbModal')?.classList.add('open');
}

export function closeKbModal() {
  document.getElementById('kbModal')?.classList.remove('open');
}

export function initKeyboard(context) {
  const {
    switchMainTab, openCmdPalette, closeCmdPalette,
    closeModal, closeQC, toggleQC, pomoToggle,
  } = context;

  // Wire keyboard shortcuts help button
  document.getElementById('helpBtn')?.addEventListener('click', showKbHelp);
  document.getElementById('kbCloseBtn')?.addEventListener('click', closeKbModal);

  // Close kbModal when clicking backdrop
  document.getElementById('kbModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('kbModal')) closeKbModal();
  });

  document.addEventListener('keydown', (e) => {
    // Escape: close overlays in priority order
    if (e.key === 'Escape') {
      if (document.getElementById('cmdOverlay')?.classList.contains('open')) { closeCmdPalette?.(); return; }
      if (document.getElementById('qcModal')?.classList.contains('open'))   { closeQC?.();          return; }
      if (document.getElementById('kbModal')?.classList.contains('open'))   { closeKbModal();       return; }
      closeModal?.();
      return;
    }
    // Cmd/Ctrl+K = command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openCmdPalette?.(); return; }
    // Ctrl+Shift+C = quick capture
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') { e.preventDefault(); toggleQC?.(); return; }
    // ? = keyboard shortcuts help
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      showKbHelp(); return;
    }
    // Ctrl+Alt+T = start/pause pomodoro
    if (e.ctrlKey && e.altKey && e.key === 't') { e.preventDefault(); pomoToggle?.(); return; }
    // Number keys 1-5 for tab switch (no modifier, not in input)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      const tabMap = { '1': 'tasks', '2': 'memory', '3': 'articles', '4': 'focus', '5': 'journal' };
      if (tabMap[e.key]) { switchMainTab(tabMap[e.key]); return; }
    }
  });
}
