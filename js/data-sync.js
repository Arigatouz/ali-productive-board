// ===== data-sync.js — Dashboard Data HackMD note =====

import { getFullApiUrl, fetchWithRetry } from './api.js';

// Default empty data structure
const DEFAULTS = {
  habits: [],
  habit_log: {},
  badges_unlocked: {},
  pomo_log: {},
  analytics: {},
  freeze_tokens: { count: 2, lastReset: '' },
};

// Parse the Dashboard Data note markdown into a JS object
export function parseDataNote(markdown) {
  const data = structuredClone(DEFAULTS);
  if (!markdown) return data;

  const sectionRe = /^## (\w[\w_]*)\s*\n```json\s*\n([\s\S]*?)\n```/gm;
  let match;
  while ((match = sectionRe.exec(markdown)) !== null) {
    const key = match[1];
    const json = match[2].trim();
    if (key in data) {
      try { data[key] = JSON.parse(json); } catch { /* keep default */ }
    }
  }
  return data;
}

// Serialize a data object back to the Dashboard Data markdown format
export function serializeDataNote(data) {
  const keys = ['habits', 'habit_log', 'badges_unlocked', 'pomo_log', 'analytics', 'freeze_tokens'];
  let md = '# Dashboard Data\n';
  for (const key of keys) {
    const val = data[key] !== undefined ? data[key] : DEFAULTS[key];
    md += `\n## ${key}\n\`\`\`json\n${JSON.stringify(val, null, 2)}\n\`\`\`\n`;
  }
  return md;
}

// Fetch Dashboard Data from HackMD (silently returns defaults on failure)
export async function loadDashboardData(config) {
  if (!config.DATA_NOTE_ID || !config.API_TOKEN) {
    return structuredClone(DEFAULTS);
  }
  try {
    const res = await fetch(getFullApiUrl(`/notes/${config.DATA_NOTE_ID}`, config), {
      headers: { 'Authorization': 'Bearer ' + config.API_TOKEN }
    });
    if (!res.ok) return structuredClone(DEFAULTS);
    const json = await res.json();
    return parseDataNote(json.content);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

// PATCH Dashboard Data to HackMD (silently no-ops if data_id not set)
export async function saveDashboardData(config, data) {
  if (!config.DATA_NOTE_ID || !config.API_TOKEN) return;
  try {
    await fetchWithRetry(getFullApiUrl(`/notes/${config.DATA_NOTE_ID}`, config), {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + config.API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: serializeDataNote(data) }),
    });
  } catch { /* silent fail */ }
}

// Debounced save — call scheduleSave(config, getData) whenever data changes
let _saveTimer = null;
export function scheduleSave(config, getData) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveDashboardData(config, getData());
  }, 2000);
}
