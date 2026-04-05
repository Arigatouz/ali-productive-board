// ===== db.js — IndexedDB wrapper =====
// DB: productive-board v1, store: config, keyPath: key
// Each record: { key: 'api_token', value: '...' }

const DB_NAME = 'productive-board';
const DB_VERSION = 1;
const STORE = 'config';

let _db = null;

export function initDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

export function dbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = (e) => resolve(e.target.result ? e.target.result.value : null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export function dbSet(key, value) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

export function dbDelete(key) {
  return new Promise((resolve, reject) => {
    const tx = _db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

// Migrate config from localStorage to IDB on first run
export async function migrateFromLocalStorage() {
  const existing = await dbGet('api_token');
  if (existing !== null) return; // already migrated

  const mapping = {
    api_token:    'hackmd_api_token',
    tasks_id:     'hackmd_tasks_id',
    memory_id:    'hackmd_memory_id',
    articles_id:  'hackmd_articles_id',
    journal_id:   'hackmd_journal_id',
    cors_proxy:   'hackmd_cors_proxy',
    theme:        'dashboard_theme',
  };

  for (const [idbKey, lsKey] of Object.entries(mapping)) {
    const val = localStorage.getItem(lsKey);
    if (val !== null) {
      await dbSet(idbKey, val);
      localStorage.removeItem(lsKey);
    }
  }
}
