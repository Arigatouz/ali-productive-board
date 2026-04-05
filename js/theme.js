// ===== theme.js — theme application and picker =====

import { dbGet, dbSet } from './db.js';

export const THEMES = {
  light:       { label: 'Light',           swatches: ['#faf9f5', '#D97757'] },
  dark:        { label: 'Dark',            swatches: ['#141416', '#ef8b6c'] },
  'neon-dark': { label: 'Green Neon Dark', swatches: ['#080810', '#39ff14'] },
  'neon-light':{ label: 'Neon Light',      swatches: ['#f0ede4', '#cc0077'] },
};

export function applyTheme(name) {
  const safeTheme = THEMES[name] ? name : 'light';
  document.documentElement.setAttribute('data-theme', safeTheme);
  dbSet('theme', safeTheme).catch(() => {});

  const meta         = THEMES[safeTheme];
  const themeLabel   = document.getElementById('themeLabel');
  const swatchRow    = document.getElementById('themeSwatchRow');

  if (themeLabel) themeLabel.textContent = meta.label;
  if (swatchRow) {
    swatchRow.innerHTML = meta.swatches
      .map(c => `<span class="theme-swatch-dot" style="background:${c}"></span>`)
      .join('');
  }
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === safeTheme);
  });
}

export async function initTheme() {
  const saved = (await dbGet('theme')) || 'light';
  applyTheme(saved);

  const btn   = document.getElementById('themePickerBtn');
  const popup = document.getElementById('themePickerPopup');

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    popup?.classList.toggle('open');
  });

  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      applyTheme(opt.dataset.theme);
      popup?.classList.remove('open');
    });
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('themePickerWrap');
    if (wrap && !wrap.contains(e.target)) {
      popup?.classList.remove('open');
    }
  });
}
