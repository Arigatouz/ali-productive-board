// ===== loader.js — Cyber save loader overlay =====

const loader  = document.getElementById('cyber-loader');
const hexEl   = document.getElementById('cl-hex-data');
const labelEl = document.getElementById('cl-label');
let hexInterval = null;

const HEX_CHARS = '0123456789ABCDEF';

function randHex(len) {
  let s = '0x';
  for (let i = 0; i < len; i++) s += HEX_CHARS[Math.floor(Math.random() * 16)];
  return s;
}

function randHexLine() {
  return [8, 8, 4].map(n => randHex(n)).join(' ');
}

export function showCyberLoader(label) {
  if (label && labelEl) labelEl.textContent = label.toUpperCase();
  if (loader) loader.classList.add('active');
  hexInterval = setInterval(() => { if (hexEl) hexEl.textContent = randHexLine(); }, 80);
}

export function hideCyberLoader() {
  if (loader) loader.classList.remove('active');
  clearInterval(hexInterval);
}
