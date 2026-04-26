# AGENTS.md

## Architecture

Static single-page app. No build step, no bundler, no framework. ES modules loaded natively in the browser.

**Cannot open `index.html` via `file://`** — ES modules require an HTTP server. Run `npx serve .` or `python3 -m http.server 4242`.

Source: `index.html` (~474 lines), `js/` (25 modules, ~4800 lines), `css/` (14 files, ~3800 lines). Entry point: `js/main.js`.

CLAUDE.md is stale — it describes the old monolithic `index.html`. README is current.

## Commands

```bash
npm run worker:dev      # Cloudflare Worker dev server (CORS proxy)
npm run worker:deploy   # Deploy Worker to Cloudflare
```

No build, test, lint, or typecheck commands. No tests exist.

## Data Flow

- **IndexedDB** (`productive-board` → `config` store): API token, note IDs, CORS proxy URL, theme, AI provider config, API keys
- **localStorage**: `pomo_state` (timer state), `freeze_tokens`
- **HackMD notes**: Tasks, Memory, Articles, Journal, Dashboard Data, Brainstorm — all proxied through Cloudflare Worker
- **Browser Cache API**: Whisper model weights (~244MB) cached after first download

All HackMD API calls route through `getFullApiUrl(path)` in `js/api.js`, which prepends the CORS proxy URL. `js/db.js` manages IndexedDB; `migrateFromLocalStorage()` runs once on upgrade.

## Module Wiring

Boot sequence: `initDashboard()` in `js/main.js` → `initDB()` → `migrateFromLocalStorage()` → `loadConfig()` → `loadAIConfig()` → `initTheme()` → load data → init feature modules. Each module gets an `onDataChange` callback that triggers debounced saves via `scheduleSave()`.

Tab names (string literals used in `switchMainTab`): `'tasks'`, `'memory'`, `'articles'`, `'focus'`, `'journal'`, `'chat'`, `'briefing'`, `'brainstorm'`.

Tab shortcuts: 1–5 for original tabs, 6=Chat, 7=Briefing, 8=Brainstorm.

Some `window.*` exposures exist for legacy inline `onclick` handlers in memory.js templates (e.g., `openFileModal`, `filterMemoryDirectory`).

## Conventions

- Vanilla ES modules, no TypeScript, no bundler
- External deps: `marked@9.1.6` via CDN in `index.html`; `@huggingface/transformers` lazy-loaded on first voice input
- Perplexity/Anthropic APIs called directly from browser (no proxy needed for those)
- Module pattern: each `js/*.js` exports `init*` + domain functions; `main.js` wires them
- CSS: one file per feature/tab, loaded via `<link>` in `index.html`
- Task format: `## Section` headers + `- [ ]`/`- [x]` checkboxes
- Article format: pipe-delimited table `| id | name | link | status | progress |`
- Journal format: `<!-- journal:YYYY-MM-DD -->` … `<!-- /journal:YYYY-MM-DD -->` markers (older formats also parsed on load)
- Dashboard Data note: JSON inside triple-backtick fences under `## section` headers

## AI & Voice

- **AI routing**: `callAI()` in `ai-config.js` dispatches to `callPerplexity()` or `callAnthropic()` based on `ai_provider` key (`'perplexity'` or `'anthropic'`)
- **Speech**: `js/speech.js` uses `onnx-community/whisper-small` via `@huggingface/transformers`; WebGPU first, WASM fallback; three language modes (AR/EN/MIX) cycled via button or `Ctrl+Shift+L`
- **Whisper gotcha**: passing no `language` defaults to English. Always pass `language: 'arabic'` or `language: 'english'` explicitly for reliable results.

## Worker

`worker/index.js` — Cloudflare Worker CORS proxy for HackMD API. Proxy URL must end with `/hackmd/` for correct routing.

## Gotchas

- Config lives in **IndexedDB**, not localStorage. DevTools → Application → IndexedDB → `productive-board` → `config`. Wipe: `indexedDB.deleteDatabase('productive-board')` in console.
- Without a Dashboard Data Note ID configured, habits/badges/analytics/pomo-log are session-only and lost on reload.
- Pomodoro timer intentionally resets on reload (avoids counting idle time). Session counts persist in Dashboard Data note.
- Whisper model download (~244MB) only happens once; cached in browser Cache API thereafter.
- `freeze_tokens` is the only dashboard data still in localStorage (not IndexedDB or HackMD).
- Theme is stored in IndexedDB as `theme` — the old `dashboard_theme` localStorage key mentioned in CLAUDE.md is outdated.