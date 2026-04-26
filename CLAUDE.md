# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Static single-page app. No build step, no bundler, no framework. ES modules loaded natively in the browser.

**Cannot open `index.html` via `file://`** — ES modules require an HTTP server. Run `npx serve .` or `python3 -m http.server 4242` from the repo root.

Source is split across `index.html` (HTML structure only, ~460 lines), `js/` (27 modules, ~4200 lines total), and `css/` (14 files, ~2900 lines total). Entry point: `js/main.js`.

## Commands

```bash
npm run worker:dev      # Cloudflare Worker dev server (CORS proxy)
npm run worker:deploy   # Deploy Worker to Cloudflare
```

No build, test, lint, or typecheck commands exist. There are no tests.

## Data Flow

- **IndexedDB** (`productive-board` database, `config` store): API token, note IDs, CORS proxy URL, theme choice, AI provider config (AI provider selection, TTS provider, Google TTS key, ElevenLabs key)
- **localStorage**: `pomo_state` (timer state), `freeze_tokens`
- **HackMD notes**: Tasks, Memory, Articles, Journal, Dashboard Data, Brainstorm — all synced via the Cloudflare Worker CORS proxy
- **Browser Cache API**: Whisper ONNX model weights (~244MB) cached after first download by Transformers.js

All HackMD API calls go through `getFullApiUrl(path)` in `js/api.js`, which prepends the configured CORS proxy URL.

`js/db.js` handles IndexedDB. On first load after upgrade, `migrateFromLocalStorage()` moves old `hackmd_*` keys to IndexedDB and deletes the old keys.

## Module Wiring

`initDashboard()` in `js/main.js` is the boot sequence. It awaits `initDB()` → `migrateFromLocalStorage()` → `loadConfig()` → `initTheme()`, then loads dashboard data, then inits all feature modules. Each module gets a `onDataChange` callback that triggers debounced saves back to HackMD via `scheduleSave()`.

Tab switching: `switchMainTab(tabName)` in `js/ui.js`. Valid names: `'tasks'`, `'memory'`, `'articles'`, `'focus'`, `'journal'`, `'chat'`, `'briefing'`, `'brainstorm'`. Keyboard shortcuts: `1`–`5` for the first five tabs, `6` = Chat, `7` = Briefing, `8` = Brainstorm.

## Conventions

- No TypeScript, no bundler — vanilla ES modules with `import`/`export`
- External dependencies: `marked@9.1.6` loaded via CDN in `index.html`; `@huggingface/transformers@3` loaded lazily via dynamic `import()` on first voice input click
- Module pattern: each `js/*.js` file exports `init*` + domain functions; `main.js` wires them together
- CSS is per-feature (one file per tab/panel), loaded via `<link>` in `index.html`
- Perplexity and Anthropic APIs are called via the Cloudflare Worker (`/perplexity/...` and `/anthropic/...` routes); Google Cloud TTS calls go through the proxy too if needed
- Task format: `## Section` headers + `- [ ]`/`- [x]` checkboxes, parsed by `parseTaskMarkdown()` in `js/tasks.js`
- Article format: pipe-delimited table in HackMD note with `| id | name | link | status | progress |` header
- Journal format: entries delimited by `<!-- journal:YYYY-MM-DD -->` start and `<!-- /journal:YYYY-MM-DD -->` end markers; older start-only and `## YYYY-MM-DD` formats are also parsed on load
- Dashboard Data note: sections with JSON blocks inside triple-backtick fences
- Brainstorm note: `## Title` sections containing free-form markdown, parsed by `parseBrainstormMarkdown()` in `js/brainstorm.js`

## AI Features

- **Article Chat** (`js/article-chat.js`): Chat about an article using Perplexity or Claude. Fetches article HTML via the Worker's `/proxy?url=` route, strips boilerplate, and sends up to 12,000 chars as context.
- **Morning Briefing** (`js/morning-briefing.js`): AI-generated spoken morning briefing. Uses dashboard context (tasks, habits, journal) and speaks via Web Speech API, Google Cloud TTS, or ElevenLabs. Falls back to the next provider on error.
- **Brainstorm** (`js/brainstorm.js`): Brainstorming sessions stored as `## Title` sections in a HackMD note, with per-session AI expansion via `callAI()`.
- **AI Config** (`js/ai-config.js`): Manages AI provider keys and selection in IndexedDB. `callAI(messages, options)` routes to `callPerplexity()` or `callAnthropic()` based on the `ai_provider` key (`'perplexity'` | `'anthropic'`). Also renders the AI settings modal sections. API keys (Perplexity, Anthropic) are stored as **Cloudflare Worker secrets** (`wrangler secret put`), not in IndexedDB.

## Voice Input (Speech-to-Text)

- `js/speech.js` — browser-based STT using `onnx-community/whisper-small` via `@huggingface/transformers@3`
- Model is lazy-loaded on first mic click (~244MB, cached in browser Cache API after first download)
- Tries WebGPU first, falls back to WASM
- Microphone audio captured at 16kHz via `ScriptProcessorNode`, chunked every ~5s for transcription
- Three language modes cycled via `speechLangBtn` button or `Ctrl+Shift+L`:
  - **AR** (`language: 'arabic'`) — default, writes Arabic script, handles English insertions
  - **EN** (`language: 'english'`) — English only
  - **MIX** (`language: null`) — auto-detect per segment (may default to English if Whisper can't decide)
- Transcribed text is inserted into the currently focused input (Quick Capture, Journal textarea, etc.)
- A cyber-themed full-screen overlay shows download progress (MB loaded, total, %, ETA, current file) while the model loads
- Exports: `initSpeech()`, `toggleSpeech()`, `cycleLangMode()`

## Worker

`worker/index.js` is a Cloudflare Worker that proxies browser requests to the HackMD API, Perplexity API, Anthropic API, and generic URLs. Deployed via `npx wrangler deploy` using `wrangler.toml`. Routes:

- `/hackmd/*` → HackMD API (proxy URL must end with `/hackmd/` in settings)
- `/perplexity/*` → Perplexity chat completions
- `/anthropic/*` → Anthropic messages API
- `/proxy?url=<encoded>` → generic URL proxy for article text fetching

API keys for Perplexity and Anthropic are set as Worker secrets: `npx wrangler secret put PERPLEXITY_KEY` and `npx wrangler secret put ANTHROPIC_KEY`.

## Gotchas

- Config is in IndexedDB, not localStorage. Inspect via DevTools → Application → IndexedDB → `productive-board` → `config`. To wipe: `indexedDB.deleteDatabase('productive-board')` in console.
- Theme is stored in IndexedDB as `theme` (not the old `dashboard_theme` localStorage key).
- Without a Dashboard Data Note ID configured, habits/badges/analytics/pomo-log are session-only and lost on reload.
- The pomodoro timer intentionally resets on page reload to avoid counting idle time.
- Transformers.js model download only happens once — subsequent visits load from browser cache in seconds. The overlay only appears on first download.
- Whisper defaults to English when `language` is not specified (`language: ''` or omitted). Always pass `language: 'arabic'` or `language: 'english'` explicitly for reliable results.
- AI API keys (Perplexity, Anthropic) live as Cloudflare Worker secrets — they are never stored in IndexedDB or sent from the browser. Google TTS and ElevenLabs keys *are* stored in IndexedDB (user-entered in Settings).
