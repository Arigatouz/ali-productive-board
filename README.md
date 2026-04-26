# Ali Productive Board

> A developer productivity dashboard. Pure static HTML/CSS/JS. No build step. No framework. Config lives in IndexedDB. Data syncs to HackMD. AI runs through a Cloudflare Worker proxy. Everything runs in the browser.

![Static](https://img.shields.io/badge/Static-HTML%2FCSS%2FJS-orange) ![Storage](https://img.shields.io/badge/Storage-IndexedDB%20%2B%20HackMD-blue) ![Deploy](https://img.shields.io/badge/Deploy-GitHub%20Pages-brightgreen) ![Proxy](https://img.shields.io/badge/Proxy-Cloudflare%20Workers-yellow)

---

## What's Inside

| Tab | What it does |
|-----|-------------|
| **Tasks** | Kanban board with board and list views, drag-and-drop for sections and cards, subtasks |
| **Memory** | Structured notes viewer with editable sections, synced from HackMD |
| **Articles** | Tech reading tracker with status cycle and progress slider |
| **Focus** | Pomodoro timer, habit tracker, weekly stats, achievements, 12-week heatmap |
| **Journal** | Daily writing entries, local-first, optional HackMD cloud sync |
| **Chat** | AI-powered article reader — paste a URL, get a summary, ask follow-up questions |
| **Briefing** | AI-generated spoken morning briefing using your tasks, habits, and journal |
| **Brainstorm** | Freeform sessions synced to a HackMD note, with AI-assisted expansion per session |
| **Voice Input** | Browser-based speech-to-text (Whisper), supports Arabic, English, and auto-detect modes |

---

## File Structure

```
ali-productive-board/
├── index.html              ← HTML structure only (~460 lines)
├── css/
│   ├── themes.css          ← CSS variables for all 4 themes
│   ├── base.css            ← Reset, body, typography, scanlines
│   ├── layout.css          ← Header, tabs, panels, status bar, responsive
│   ├── components.css      ← Buttons, modals, settings form, theme picker
│   ├── tasks.css           ← Kanban board, columns, cards, list view
│   ├── memory.css          ← Memory tabs, grid, file browser
│   ├── articles.css        ← Article cards, progress bars, status badges
│   ├── focus.css           ← Pomodoro ring, habits, heatmap, stats gauge, badges
│   ├── journal.css         ← Journal panel, toolbar, textarea, prompt strip
│   ├── overlays.css        ← Command palette, quick capture, kb modal, cyber loader
│   ├── speech.css          ← Voice input button, recording state, cyber loader overlay
│   ├── article-chat.css    ← Chat panel styles
│   ├── morning-briefing.css← Briefing panel styles
│   └── brainstorm.css      ← Brainstorm panel styles
└── js/
    ├── main.js             ← Entry point — init, imports, window.* exposures
    ├── db.js               ← IndexedDB wrapper (dbGet, dbSet, migrateFromLocalStorage)
    ├── api.js              ← getFullApiUrl, fetchWithRetry
    ├── config.js           ← loadConfig, saveConfig, showSettingsModal
    ├── ai-config.js        ← AI provider config, callAI, callPerplexity, callAnthropic
    ├── theme.js            ← applyTheme, initTheme, THEMES
    ├── ui.js               ← showStatus, setSyncStatus, switchMainTab, modal helpers
    ├── loader.js           ← showCyberLoader, hideCyberLoader
    ├── data-sync.js        ← Dashboard Data note load/save/parse/serialize
    ├── tasks.js            ← Kanban parse/render, drag-drop, HackMD sync
    ├── memory.js           ← Memory parse/render/edit, HackMD sync
    ├── articles.js         ← Articles parse/render, status cycle, HackMD sync
    ├── journal.js          ← Journal entries, date nav, HackMD sync
    ├── article-chat.js     ← Article chat panel — fetch, summarize, Q&A
    ├── morning-briefing.js ← Morning briefing generation and TTS playback
    ├── brainstorm.js       ← Brainstorm sessions, HackMD sync, AI expansion
    ├── pomodoro.js         ← Timer loop, phases, sessions, UI
    ├── habits.js           ← Habit list, daily log, streaks, heatmap, freeze tokens
    ├── badges.js           ← BADGE_DEFS, checkBadges, showBadgeToast
    ├── analytics.js        ← trackAnalytics, getAnalytics, renderStats
    ├── focus.js            ← renderFocusTab orchestrator
    ├── cmdpalette.js       ← buildCmdList, initCmdPalette, open/close
    ├── capture.js          ← Quick capture modal (task-only)
    ├── speech.js           ← Browser speech-to-text (Whisper via Transformers.js), language toggle
    └── keyboard.js         ← Global keydown handler, showKbHelp, closeKbModal
worker/
└── index.js               ← Cloudflare Worker — HackMD proxy + AI proxy routes
wrangler.toml              ← Worker deployment config
```

---

## Quick Start After `git clone`

### 1) Clone and open

```bash
git clone <your-repo-url>
cd ali-productive-board
```

The app uses ES modules, which require an HTTP server. Opening `index.html` directly via `file://` will not work.

**Local dev server options:**

| Option | Command |
|--------|---------|
| npx serve | `npx serve .` |
| Python | `python3 -m http.server 4242` |
| VS Code | Install the **Live Server** extension, right-click `index.html` → Open with Live Server |

Then open `http://localhost:4242` (or whatever port your server uses).

### 2) Deploy the Cloudflare Worker proxy

The Worker handles two things: proxying HackMD API requests (CORS bypass) and proxying AI API calls (key injection from server-side secrets).

| Step | Action |
|------|--------|
| 1 | Create a free Cloudflare account at dash.cloudflare.com/sign-up |
| 2 | Install Node.js 18 or later |
| 3 | Run `npm install` in the repo root |
| 4 | Run `npx wrangler login` and click Allow in the browser window |
| 5 | Open `wrangler.toml` and set your worker name |
| 6 | Run `npm run worker:deploy` |
| 7 | Paste the worker URL into the app settings (keep the trailing `/hackmd/`) |

**Config files:**

| File | Purpose |
|------|---------|
| `worker/index.js` | Worker logic — HackMD proxy, Anthropic proxy, Perplexity proxy, article fetch |
| `wrangler.toml` | Deployment config |

`wrangler.toml` example:

```toml
name = "your-worker-name"
main = "worker/index.js"
compatibility_date = "2024-04-03"
```

**Proxy URL format:**

```
https://<worker-name>.<subdomain>.workers.dev/hackmd/
```

Keep the trailing `/hackmd/`. The Worker uses it to route HackMD requests correctly.

**Worker routes:**

| Path | Proxies to |
|------|-----------|
| `/hackmd/*` | `api.hackmd.io/v1/*` |
| `/anthropic/*` | `api.anthropic.com/v1/*` |
| `/perplexity/*` | `api.perplexity.ai/*` |
| `/proxy?url=...` | Arbitrary URLs (for article HTML fetching) |

### 3) Add AI API keys as Worker secrets

AI keys are stored as Cloudflare Worker secrets — they never appear in the browser, in source code, or in network requests. The Worker injects them server-side before forwarding to the AI provider.

```bash
npx wrangler secret put ANTHROPIC_KEY
# paste your Anthropic key when prompted

npx wrangler secret put PERPLEXITY_KEY
# paste your Perplexity key when prompted
```

To verify they were added: Cloudflare Dashboard → Workers → your worker → Settings → Variables & Secrets.

**Local development with secrets:**

Create `worker/.dev.vars` (this file is gitignored — never commit it):

```ini
ANTHROPIC_KEY=your-key-here
PERPLEXITY_KEY=your-key-here
```

Then run the local worker dev server:

```bash
npm run worker:dev
```

### 4) Create a HackMD API token

1. Go to HackMD, open Settings, then the API tab
2. Create and copy your personal token
3. Do not commit this token to git

### 5) Create your HackMD notes

Create one note per section and grab the ID from the URL:

```
https://hackmd.io/AbCdEfGhIjKlMnOpQrStUv
                  ^^^^^^^^^^^^^^^^^^^^^^
                  this is the note ID
```

| Note | Required | Used for |
|------|----------|---------|
| Tasks | Yes | Kanban board data |
| Memory | Yes | Structured notes |
| Articles | Yes | Reading list |
| Dashboard Data | Recommended | Habits, badges, analytics, pomo log — auto-synced |
| Journal | No | Cloud backup of daily entries, works offline without it |
| Brainstorm | No | Brainstorming sessions — create a blank note and paste the ID in Settings → AI |

**Dashboard Data note:** Create a blank note called "Dashboard Data". The app will write and manage its content automatically. Without it, habits, badges, analytics, and pomo history are session-only and lost on reload.

### 6) Configure the app

Click the gear icon in the top right, open Settings, and fill in:

| Field | Value |
|-------|-------|
| HackMD API Token | Your personal access token from HackMD |
| CORS Proxy URL | Your `...workers.dev/hackmd/` URL |
| Tasks Note ID | ID from the Tasks note URL |
| Memory Note ID | ID from the Memory note URL |
| Articles Note ID | ID from the Articles note URL |
| Journal Note ID | ID from the Journal note URL (optional) |
| Dashboard Data Note ID | ID from the Dashboard Data note URL (recommended) |

Under **AI Providers**, choose Perplexity or Anthropic (Claude) as your chat provider. API keys are not entered here — they live in the Worker as secrets (see step 3).

Under **Voice & TTS**, choose your text-to-speech provider for the Morning Briefing.

Click Save. Config is stored in IndexedDB — it stays in your browser and persists across reloads.

---

## AI Features

All AI features route through your Cloudflare Worker. The Worker injects the API key from its secrets before forwarding to Anthropic or Perplexity. No key is ever sent from the browser.

### Article Chat (Chat tab)

| Feature | Details |
|---------|---------|
| Fetch & summarize | Paste any article URL and click Fetch — the Worker retrieves the HTML, the AI summarizes it |
| Pinned summary | The summary stays visible at the top while you ask follow-up questions below it |
| Contextual Q&A | Follow-up questions include the article content so you get specific answers |
| Citations | Perplexity responses include numbered source links |
| Clear | Resets both the summary and the conversation |

**How fetch works:** The Worker fetches the article HTML server-side (bypassing site CORS restrictions). If the site blocks the request, the AI falls back to answering based on its training data.

### Morning Briefing (Briefing tab)

| Feature | Details |
|---------|---------|
| Generate | Builds a briefing from your current tasks, today's habits, and recent journal entries |
| Spoken | Text-to-speech reads the briefing aloud |
| TTS providers | Web Speech API (free), Google Cloud TTS (high-quality Arabic), ElevenLabs (premium voices) |
| Language | Supports Arabic and English |

**TTS setup:**

| Provider | Where to get key | Setting |
|----------|-----------------|---------|
| Web Speech API | No key needed | Default |
| Google Cloud TTS | cloud.google.com/text-to-speech | Settings → Voice & TTS → Google TTS Key |
| ElevenLabs | elevenlabs.io/app/settings/api-keys | Settings → Voice & TTS → ElevenLabs Key |

### Brainstorm (Brainstorm tab)

| Feature | Details |
|---------|---------|
| Sessions | Create named brainstorm sessions with free-form text |
| AI expand | Click the AI button on a session to expand it with more ideas |
| Markdown render | Content renders as formatted markdown; click edit to go back to raw text |
| HackMD sync | All sessions sync to a single HackMD note (configure the note ID in Settings → AI → Brainstorm Note ID) |

---

## Storage Architecture

| Layer | What it stores | Persists? |
|-------|---------------|-----------|
| **IndexedDB** | HackMD token, note IDs, CORS proxy URL, theme, AI provider choice, TTS provider, TTS keys | Yes — survives reload |
| **Cloudflare Worker secrets** | Anthropic API key, Perplexity API key | Yes — server-side only, never in browser |
| **HackMD** (Dashboard Data note) | Habits, habit log, badges, pomo log, analytics, freeze tokens | Yes — cloud synced |
| **HackMD** (Brainstorm note) | All brainstorm sessions | Yes — cloud synced |
| **HackMD** (individual notes) | Tasks, Memory, Articles, Journal | Yes — your existing notes |
| **localStorage** | Pomodoro timer state | Yes — survives reload |
| **Browser Cache API** | Whisper ONNX model weights (~244MB) | Yes — cached after first download |

### First Load Migration

On the very first load after upgrading from an older version, the app automatically migrates any existing config from `localStorage` to IndexedDB and removes the old keys.

| Old localStorage key | Migrated to IndexedDB key |
|----------------------|--------------------------|
| `hackmd_api_token` | `api_token` |
| `hackmd_tasks_id` | `tasks_id` |
| `hackmd_memory_id` | `memory_id` |
| `hackmd_articles_id` | `articles_id` |
| `hackmd_journal_id` | `journal_id` |
| `hackmd_cors_proxy` | `cors_proxy` |
| `dashboard_theme` | `theme` |

---

## Note Formats

### Tasks Note

```markdown
# Tasks

## Backlog

- [ ] **Task title**
- [ ] **Task with note** - some extra context here
- [x] **Completed task**
  - [ ] subtask one
  - [x] subtask two done

## In Progress

- [ ] **Another task**

## Done

- [x] **Finished item**
```

### Memory Note

```markdown
# Memory

## Me

Your name, role, stack

## People

| Who | Role |
|-----|------|
| John | Backend lead |

## Terms

| Term | Meaning |
|------|---------|
| OKR  | Objectives and Key Results |
```

Built-in sections auto-created if missing: `Me`, `People`, `Terms`, `Projects`, `Preferences`.

### Articles Note

```markdown
# Articles

| id | name | link | status | progress |
| -- | ---- | ---- | ------ | -------- |
| 1 | How the Browser Works | https://example.com | not-read | 0 |
| 2 | CSS Grid Guide | https://css-tricks.com/grid | reading | 60 |
```

| Column | Values |
|--------|--------|
| `status` | `not-read`, `reading`, `read` |
| `progress` | 0 to 100 |

### Dashboard Data Note

The app writes and manages this note automatically. Create a blank note and configure its ID in Settings.

### Journal Note (optional)

```markdown
# Journal

<!-- journal:2026-04-25 -->

Today I shipped the new auth flow.

<!-- /journal:2026-04-25 -->

<!-- journal:2026-04-24 -->

Reviewed three PRs.

<!-- /journal:2026-04-24 -->
```

Entries are delimited by `<!-- journal:YYYY-MM-DD -->` start and `<!-- /journal:YYYY-MM-DD -->` end markers. Newest entry first.

### Brainstorm Note

The app writes and manages this note automatically. Create a blank HackMD note and paste its ID in Settings → AI → Brainstorm Note ID.

---

## Features

### Tasks: Kanban Board

| Feature | How it works |
|---------|-------------|
| View toggle | Switch between Board view and List view using the toggle in the header |
| Drag and drop | Drag cards between columns, drag columns left or right to reorder |
| Inline edit | Click any task title or note to edit it |
| Subtasks | Add nested checkboxes under any task |
| New sections | Use the `+ Add Section` button to create columns |
| Save | Hit **Save** to push changes to HackMD |

### Memory: Notes Viewer

| Feature | How it works |
|---------|-------------|
| Sections | Each `##` header becomes a tab |
| Inline edit | Click any section content to edit it |
| Auto-sections | `Me`, `People`, `Terms`, `Projects`, `Preferences` are created if missing |
| Save | Hit **Save** to push changes to HackMD |

### Articles: Reading Tracker

| Feature | How it works |
|---------|-------------|
| Status cycle | Click the status badge to cycle: `not-read` > `reading` > `read` |
| Progress | Drag the slider to set reading progress from 0 to 100 |
| Add articles | Use the form at the top, link is required |
| Save | Hit **Save** to push changes to HackMD |

### Focus Tab

#### Pomodoro Timer

| Preset | Focus | Break | Long Break |
|--------|-------|-------|------------|
| **25/5** (default) | 25 min | 5 min | 15 min |
| **50/10** | 50 min | 10 min | 20 min |
| **90/20** (deep work) | 90 min | 20 min | 30 min |

The timer widget stays visible in the header across all tabs. Click it to jump back to the Focus tab.

#### Habit Tracker

| Feature | Details |
|---------|---------|
| Add habits | Name and emoji per habit |
| Daily check-off | One check per habit per day |
| Streaks | Flame icon appears at 3+ consecutive days |
| Freeze tokens | 2 per month, each saves a streak on a day you miss |
| Heatmap | 12-week activity grid in GitHub contribution graph style |

#### Weekly Stats

Tracks tasks done, focus minutes, and habit completion. Persists in the Dashboard Data note.

#### Achievements

| Badge | How to unlock |
|-------|--------------|
| ⏱️ First Pomo | Finish your first Pomodoro session |
| 🔥 On a Roll | Complete 5 total Pomodoro sessions |
| ⚔️ Focus Knight | Complete 50 total Pomodoro sessions |
| ✨ 3-Day Streak | Keep a 3-day habit streak |
| 🌟 7-Day Blazer | Keep a 7-day habit streak |
| 💎 30-Day Legend | Keep a 30-day habit streak |
| 🎯 Perfect Day | Complete every habit in a single day |
| ✅ Task Master | Finish 10 tasks in one day |
| 🐦 Early Bird | Log a habit before 8 AM |
| 🦉 Night Owl | Log a habit after 10 PM |
| 🎨 Renaissance | Set up 4 or more habits |
| 📓 Journal Keeper | Write 3 journal entries |

### Voice Input (Speech-to-Text)

| What | Details |
|------|---------|
| Model | `onnx-community/whisper-small` via `@huggingface/transformers` — runs entirely in the browser |
| Languages | Arabic, English, and auto-detect — click `ع`/`EN`/`↔` to cycle |
| First load | Downloads ~244MB model (cached after first load) |
| Shortcut | `Ctrl+Shift+V` to start/stop, `Ctrl+Shift+L` to cycle language |
| Target | Transcribed text inserts into the currently focused input |

### Command Palette

| Feature | Details |
|---------|---------|
| Open | `Cmd/Ctrl + K` from anywhere |
| Search | Searches across every action in the dashboard |
| Navigation | Arrow keys + Enter |

### Quick Capture

| Feature | Details |
|---------|---------|
| Open | `Ctrl + Shift + C` |
| What it does | Creates a task and drops it into the first Kanban column |

---

## Keyboard Shortcuts

### Global

| Action | Mac | Windows / Linux |
|--------|-----|----------------|
| Open Command Palette | `⌘ K` | `Ctrl K` |
| Quick Capture | `⌘ ⇧ C` | `Ctrl Shift C` |
| Voice Input | `⌘ ⇧ V` | `Ctrl Shift V` |
| Switch Voice Language | `⌘ ⇧ L` | `Ctrl Shift L` |
| Show keyboard shortcuts | `?` | `?` |
| Close or dismiss | `Esc` | `Esc` |

### Tab Navigation

| Tab | Shortcut |
|-----|---------|
| Tasks | `1` |
| Memory | `2` |
| Articles | `3` |
| Focus | `4` |
| Journal | `5` |
| Chat | `6` |
| Briefing | `7` |
| Brainstorm | `8` |

> These shortcuts only fire when the cursor is not inside an input or textarea.

### Pomodoro

| Action | Mac | Windows / Linux |
|--------|-----|----------------|
| Start or pause timer | `⌃ ⌥ T` | `Ctrl Alt T` |

### Journal

| Action | Mac | Windows / Linux |
|--------|-----|----------------|
| Save entry | `⌘ ↵` | `Ctrl Enter` |

---

## Themes

| Theme | What it looks like |
|-------|-------------------|
| **Light** | Warm orange accent on white cards |
| **Dark** | Warm orange accent on dark cards |
| **Green Neon Dark** | Acid green on black with CRT scanlines |
| **Neon Light** | Magenta on aged paper |

---

## Security

| Point | Details |
|-------|---------|
| No secrets in source | All tokens and API keys are set at runtime — nothing is hardcoded |
| AI keys never in browser | Anthropic and Perplexity keys are stored as Cloudflare Worker secrets and injected server-side. The browser sends no key — the Worker adds it before forwarding |
| HackMD token | Stored in IndexedDB (browser-side), scoped to same origin, never committed to git |
| Worker CORS | The Worker strips `Origin` and `Referer` headers before forwarding to AI APIs, preventing CORS-mode detection |
| Proxy architecture | All external API calls (HackMD, Anthropic, Perplexity) go through your own Worker — you control the proxy |
| Deployment | Do not deploy this on a shared or public origin where other users could access your IndexedDB |

---

## Developer Workflows

### Deep Work Sessions with 90-Minute Blocks

| Step | Action |
|------|--------|
| 1 | Go to Focus tab and select the **90/20 preset** |
| 2 | Add the task you are about to work on to the Kanban board |
| 3 | Press `Ctrl + Alt + T` to start |
| 4 | Mid-session distraction? Press `Ctrl + Shift + C` to capture it without breaking focus |
| 5 | After the session ends, open Journal (`5`) and write a quick summary |

### Article to Task Pipeline

| Step | Action |
|------|--------|
| 1 | Save articles to the **Articles** tab |
| 2 | Open the **Chat** tab (`6`), paste the article URL, click Fetch |
| 3 | Ask questions or request action items |
| 4 | Use Quick Capture to save action items as tasks |
| 5 | Mark the article as Read when done |

### Morning Routine

| Step | Action |
|------|--------|
| 1 | Open **Briefing** tab (`7`) |
| 2 | Click Generate — the AI reads your tasks, habits, and journal |
| 3 | Listen to the spoken briefing while making coffee |
| 4 | Press `1` to open Tasks and start your first Pomodoro |

---

## Storage Keys Reference

### IndexedDB (`productive-board` database, `config` store)

| Key | What it stores |
|-----|---------------|
| `api_token` | HackMD personal access token |
| `tasks_id` | Tasks note ID |
| `memory_id` | Memory note ID |
| `articles_id` | Articles note ID |
| `journal_id` | Journal note ID |
| `data_id` | Dashboard Data note ID |
| `cors_proxy` | Cloudflare Worker URL |
| `theme` | Active theme name |
| `ai_provider` | `perplexity` or `anthropic` |
| `tts_provider` | `web_speech`, `google`, or `elevenlabs` |
| `google_tts_key` | Google Cloud TTS API key |
| `elevenlabs_key` | ElevenLabs API key |
| `brainstorm_id` | Brainstorm HackMD note ID |

### Cloudflare Worker secrets (server-side only)

| Secret name | What it stores |
|-------------|---------------|
| `ANTHROPIC_KEY` | Anthropic API key — set with `npx wrangler secret put ANTHROPIC_KEY` |
| `PERPLEXITY_KEY` | Perplexity API key — set with `npx wrangler secret put PERPLEXITY_KEY` |

These are never stored in the browser, never appear in network requests from the browser, and are not visible in the Worker source code.

---

## Troubleshooting

### 401 Unauthorized (HackMD)

| Check | How |
|-------|-----|
| Token still valid | Go to HackMD Settings > API tab |
| Token permissions | Confirm read and write are enabled |
| Direct test | `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.hackmd.io/v1/notes/YOUR_NOTE_ID` |

### AI requests failing

| Check | Fix |
|-------|-----|
| Worker deployed | Run `npm run worker:deploy` after any changes to `worker/index.js` |
| Secrets set | Check Cloudflare Dashboard → Workers → your worker → Settings → Variables & Secrets |
| CORS proxy configured | Settings → CORS Proxy URL must point to your worker |
| Wrong provider selected | Settings → AI Providers → Chat Provider |

### ES module errors or blank page

The app uses ES modules — you cannot open `index.html` directly via `file://`.

```bash
npx serve .
```

### Settings not persisting after reload

Config is stored in IndexedDB. To inspect: DevTools → Application → IndexedDB → `productive-board` → `config`.

To wipe and start fresh:

```js
indexedDB.deleteDatabase('productive-board');
location.reload();
```

### CORS errors in the console

| Check | Fix |
|-------|-----|
| Proxy URL format | Settings URL must end with `/hackmd/` |
| Stale Worker code | Redeploy with `npm run worker:deploy` |

### Habits or badges lost after reload

The Dashboard Data Note ID is not configured. Add it in Settings.

### Whisper model not downloading

The model (~244MB) downloads on first mic click and caches in the Browser Cache API. If the download stalls, refresh and try again — it resumes from where it left off in most browsers.

---

## Cloudflare Free Tier

The free plan covers 100,000 Worker requests per day — more than enough for a personal dashboard.

---

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm run worker:dev` | Run the Worker locally (reads from `worker/.dev.vars`) |
| `npm run worker:deploy` | Deploy the Worker to Cloudflare |
