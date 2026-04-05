# Ali Productive Board

> A developer productivity dashboard. Pure static HTML/CSS/JS. No build step. No framework. Config lives in IndexedDB. Data syncs to HackMD. Everything runs in the browser.

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

---

## File Structure

```
deploy_v2/
├── index.html              ← HTML structure only (~400 lines)
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
│   └── overlays.css        ← Command palette, quick capture, kb modal, cyber loader
└── js/
    ├── main.js             ← Entry point — init, imports, window.* exposures
    ├── db.js               ← IndexedDB wrapper (dbGet, dbSet, migrateFromLocalStorage)
    ├── api.js              ← getFullApiUrl, fetchWithRetry
    ├── config.js           ← loadConfig, saveConfig, showSettingsModal
    ├── theme.js            ← applyTheme, initTheme, THEMES
    ├── ui.js               ← showStatus, setSyncStatus, switchMainTab, modal helpers
    ├── loader.js           ← showCyberLoader, hideCyberLoader
    ├── data-sync.js        ← Dashboard Data note load/save/parse/serialize
    ├── tasks.js            ← Kanban parse/render, drag-drop, HackMD sync
    ├── memory.js           ← Memory parse/render/edit, HackMD sync
    ├── articles.js         ← Articles parse/render, status cycle, HackMD sync
    ├── journal.js          ← Journal entries, date nav, HackMD sync
    ├── pomodoro.js         ← Timer loop, phases, sessions, UI
    ├── habits.js           ← Habit list, daily log, streaks, heatmap, freeze tokens
    ├── badges.js           ← BADGE_DEFS, checkBadges, showBadgeToast
    ├── analytics.js        ← trackAnalytics, getAnalytics, renderStats
    ├── focus.js            ← renderFocusTab orchestrator
    ├── cmdpalette.js       ← buildCmdList, initCmdPalette, open/close
    ├── capture.js          ← Quick capture modal (task-only)
    └── keyboard.js         ← Global keydown handler, showKbHelp, closeKbModal
worker/
└── index.js               ← Cloudflare Worker CORS proxy
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
| npx serve | `npx serve deploy_v2` |
| Python | `python3 -m http.server 4242` in `deploy_v2/` |
| VS Code | Install the **Live Server** extension, right-click `index.html` → Open with Live Server |

Then open `http://localhost:4242` (or whatever port your server uses).

### 2) Deploy the Cloudflare Worker proxy

HackMD's API blocks direct browser requests due to CORS. The Worker in this repo proxies those requests for you.

| Step | Action |
|------|--------|
| 1 | Create a free Cloudflare account at dash.cloudflare.com/sign-up |
| 2 | Install Node.js 18 or later |
| 3 | Run `npm install -g wrangler` then `wrangler -v` to confirm |
| 4 | Run `wrangler login` and click Allow in the browser window |
| 5 | Open `wrangler.toml` and set your worker name |
| 6 | Run `npx wrangler deploy` |
| 7 | Verify with `curl -i -H "Authorization: Bearer YOUR_TOKEN" https://<worker-url>/hackmd/notes` |
| 8 | Paste the worker URL into the app settings (keep the trailing `/hackmd/`) |

**Config files:**

| File | Purpose |
|------|---------|
| `worker/index.js` | Worker logic that proxies requests to HackMD |
| `wrangler.toml` | Deployment config |

`wrangler.toml` example:

```toml
name = "ali-productive-board"   # becomes part of your URL
main = "worker/index.js"
compatibility_date = "2024-04-03"
```

**Proxy URL format:**

```
https://<worker-name>.<subdomain>.workers.dev/hackmd/
```

Keep the trailing `/hackmd/`. The Worker uses it to route requests correctly.

### 3) Create a HackMD API token

1. Go to HackMD, open Settings, then the API tab
2. Create and copy your personal token
3. Do not commit this token to git

### 4) Create your HackMD notes

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

**Dashboard Data note:** Create a blank note called "Dashboard Data". The app will write and manage its content automatically. Without it, habits, badges, analytics, and pomo history are session-only and lost on reload.

### 5) Configure the app

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

Click Save. Config is stored in IndexedDB — it stays in your browser, never leaves through the network, and persists across reloads without touching localStorage.

---

## Storage Architecture

The app uses three storage layers:

| Layer | What it stores | Persists? |
|-------|---------------|-----------|
| **IndexedDB** | API token, note IDs, CORS proxy URL, theme | Yes — survives reload, cleared only by DevTools |
| **HackMD** (Dashboard Data note) | Habits, habit log, badges, pomo log, analytics, freeze tokens | Yes — synced to the cloud |
| **localStorage** | Pomodoro timer state, journal entries | Yes — survives reload |
| **HackMD** (individual notes) | Tasks, Memory, Articles, Journal (cloud backup) | Yes — your existing HackMD notes |

### First Load Migration

On the very first load after upgrading from an older version, the app automatically migrates any existing config from `localStorage` to IndexedDB and removes the old keys. This is a one-time operation.

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

| Rule | Details |
|------|---------|
| Sections | `##` H2 headers, any name works |
| Task titles | App wraps them in `**bold**` when saving |
| Subtasks | Two-space indent: `  - [ ] subtask` |
| Completion | Use `[x]` or `[X]` to mark done |

### Memory Note

```markdown
# Memory

## Me

Ali Gamal, Frontend Team Lead at Luftborn | Angular, RxJS & Nx

## People

| Who | Role |
|-----|------|
| John | Backend lead |

## Terms

| Term | Meaning |
|------|---------|
| OKR  | Objectives and Key Results |

## Projects

| Name | What |
|------|------|
| Dashboard | This productivity app |

## Preferences

- Prefers concise responses
- Uses dark theme
```

Built-in sections auto-created if missing: `Me`, `People`, `Terms`, `Projects`, `Preferences`. Any other `##` sections you add are also shown and editable.

### Articles Note

```markdown
# Articles

| id | name | link | status | progress |
| -- | ---- | ---- | ------ | -------- |
| 1 | How the Browser Works | https://example.com | not-read | 0 |
| 2 | CSS Grid Guide | https://css-tricks.com/grid | reading | 60 |
| 3 | JS Promises Deep Dive | https://javascript.info/promise | read | 100 |
```

| Column | Values |
|--------|--------|
| `status` | `not-read`, `reading`, `read` |
| `progress` | 0 to 100 |

The app handles IDs automatically. The table header must start with `| id |`.

### Dashboard Data Note

The app writes and manages this note automatically. You never need to edit it manually.

```markdown
# Dashboard Data

## habits
```json
[{"id":"abc123","name":"Review PR","emoji":"🔍"}]
```

## habit_log
```json
{"2025-04-05":["abc123"]}
```

## badges_unlocked
```json
{"first_pomo":"2025-04-05"}
```

## pomo_log
```json
{"2025-04-05":3}
```

## analytics
```json
{"2025-04-05":{"tasks_done":4,"focus_mins":90}}
```

## freeze_tokens
```json
{"count":2,"lastReset":"2025-04"}
```
```

The app reads this note on load, updates in-memory state as you work, and debounces writes back to HackMD with a 2-second delay after each change.

### Journal Note (optional)

When you add a Journal Note ID in Settings, the app syncs all local entries to HackMD:

```markdown
# Journal

## 2025-04-05

Today I focused on...

---

## 2025-04-04

Yesterday was productive because...
```

Entries are always saved locally first. HackMD is a backup, not a requirement.

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
| Save | Hit **Save to HackMD** to push changes |

### Memory: Notes Viewer

| Feature | How it works |
|---------|-------------|
| Sections | Each `##` header becomes a tab |
| Inline edit | Click any section content to edit it |
| Auto-sections | `Me`, `People`, `Terms`, `Projects`, `Preferences` are created if missing |
| Save | Hit **Save to HackMD** to push changes |

### Articles: Reading Tracker

| Feature | How it works |
|---------|-------------|
| Status cycle | Click the status badge to cycle: `not-read` > `reading` > `read` |
| Progress | Drag the slider to set reading progress from 0 to 100 |
| Add articles | Use the form at the top, link is required |
| Save | Hit **Save to HackMD** to push changes |

### Focus Tab

#### Pomodoro Timer

The timer runs as a circular SVG ring and shows the current phase at all times. After every 4 focus sessions it automatically switches to a long break.

| Preset | Focus | Break | Long Break |
|--------|-------|-------|------------|
| **25/5** (default) | 25 min | 5 min | 15 min |
| **50/10** | 50 min | 10 min | 20 min |
| **90/20** (deep work) | 90 min | 20 min | 30 min |

The timer widget stays visible in the header no matter which tab you are on. Click it to jump back to the Focus tab. The app sends a browser notification when each phase ends.

Session count for the day is tracked in the Dashboard Data note and persists across reloads. The timer position itself resets on reload (intentional — prevents counting idle time).

**Developer note:** The 90/20 preset works better for coding than the default 25/5. It takes time to fully load context into working memory, and cutting a session at 25 minutes often means you restart right before getting productive.

#### Habit Tracker

| Feature | Details |
|---------|---------|
| Add habits | Name and emoji per habit |
| Daily check-off | One check per habit per day |
| Streaks | Flame icon appears at 3 or more consecutive days |
| Freeze tokens | 2 per month, each saves a streak on a day you miss |
| Heatmap | 12-week activity grid in GitHub contribution graph style |
| Persistence | Habits and logs saved to Dashboard Data note, survive reload |

Habits that tend to work well for developers:

| Habit | Why it helps |
|-------|-------------|
| 🔍 Review a PR | Teams ship faster when reviews happen the same day |
| 📝 Write a doc | One function documented per day prevents a documentation backlog |
| 🧪 Write a test | Small daily test habit builds coverage without a big push |
| 📖 Read an article | Keeps you current without needing to block out study time |
| 🏃 Take a walk | Resets context between focus sessions |
| 🌅 Plan tomorrow | Takes less than 5 minutes and removes morning friction |

#### Weekly Stats

| Metric | What it shows |
|--------|--------------|
| Score gauge | 0-100 score based on tasks, focus minutes, and habit completion |
| Week delta | Week-over-week comparison with up or down indicator |
| 7-day chart | Bar chart of daily output for the past week |
| Breakdown | Tasks done, total focus time, habit completion percentage |

Analytics are tracked automatically whenever you check off a task, complete a Pomodoro, or toggle a habit. They persist in the Dashboard Data note.

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

A toast notification slides in from the bottom right whenever you unlock a badge. Unlocked badges are saved to the Dashboard Data note.

### Journal Tab

| Feature | Details |
|---------|---------|
| Date navigation | Left and right arrows to move between days |
| Writing prompts | Rotates through 8 daily prompts shown at the top |
| Save | `Cmd/Ctrl + Enter` or the Save button |
| Cloud sync | Syncs to HackMD silently if a Journal Note ID is configured |
| Offline | All entries stay in `localStorage` and work with no internet connection |

### Command Palette

| Feature | Details |
|---------|---------|
| Open | `Cmd/Ctrl + K` from anywhere |
| Search | Searches across every action in the dashboard |
| Navigation | Arrow keys to move through results, `Enter` to run |
| Categories | Navigate, Pomodoro, Tasks, Theme, Settings, Help, Capture |

### Quick Capture

| Feature | Details |
|---------|---------|
| Open | `Ctrl + Shift + C` or the `+` button in the bottom right corner |
| What it does | Creates a task and drops it into the first Kanban column instantly |
| Save | `Cmd/Ctrl + Enter` or the **Add Task** button |
| Close | `Esc` |

---

## Keyboard Shortcuts

Click the **Shortcuts** button in the top-right of the header or press `?` to open the shortcuts modal at any time.

### Global

| Action | Mac | Windows / Linux |
|--------|-----|----------------|
| Open Command Palette | `⌘ K` | `Ctrl K` |
| Quick Capture | `⌘ ⇧ C` | `Ctrl Shift C` |
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

Your theme choice is saved in IndexedDB and persists across reloads. You can also switch themes through the Command Palette by searching "Cycle Theme".

---

## Developer Workflows

### Deep Work Sessions with 90-Minute Blocks

| Step | Action |
|------|--------|
| 1 | Go to Focus tab and select the **90/20 preset** |
| 2 | Add the task you are about to work on to the Kanban board |
| 3 | Press `Ctrl + ⌥ + T` (Mac) or `Ctrl + Alt + T` (Windows) to start. The timer stays visible in the header across all tabs |
| 4 | Mid-session distraction? Press `Ctrl + Shift + C` to capture it without breaking focus |
| 5 | After the session ends, open Journal (`5`) and write a quick summary |
| 6 | Take the full 20-minute break before starting again |

### Making Code Reviews a Daily Habit

| Step | Action |
|------|--------|
| 1 | Add "🔍 Review PR" as a habit in the Focus tab |
| 2 | Use your 5-minute Pomodoro breaks to open the team PR queue and leave at least one comment |
| 3 | Check off the habit at the end of the day |
| 4 | The streak counter does the accountability work for you |

### Article to Task Pipeline

| Step | Action |
|------|--------|
| 1 | Save tech articles to the **Articles** tab when you find them |
| 2 | While reading, use Quick Capture to save action items as tasks |
| 3 | Turn those captured tasks into Kanban cards |
| 4 | Mark the article as Read when you are done |

### Daily Planning in 5 Minutes

| Step | Action |
|------|--------|
| 1 | Press `5` to open Journal and write 2-3 sentences about today's focus |
| 2 | Press `1` to open Tasks and re-order the board if needed |
| 3 | Press `Ctrl + ⌥ + T` to start your first Pomodoro |

### Friday Weekly Review

| Step | Action |
|------|--------|
| 1 | Check the Focus tab for your weekly score and any new badges |
| 2 | Open Journal and browse through the week's entries |
| 3 | Drop articles that have sat at 0% for more than two weeks |
| 4 | Update the Memory tab with new people, decisions, or terms from the week |

---

## Storage Keys Reference

### IndexedDB (`productive-board` database, `config` store)

Config is stored in IndexedDB, not localStorage. Use DevTools → Application → IndexedDB to inspect.

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

### localStorage

| Key | What it stores |
|-----|---------------|
| `pomo_state` | Current timer state (phase, remaining seconds, session count) |
| `journal` | `{date: markdownText}` — all journal entries |

### HackMD Dashboard Data note

| Section | What it stores |
|---------|---------------|
| `habits` | Array of habit objects `{id, name, emoji}` |
| `habit_log` | `{date: [habitId, ...]}` daily completion log |
| `badges_unlocked` | `{badgeId: unlockedDate}` plus time-of-day flags |
| `pomo_log` | `{date: count}` daily session totals |
| `analytics` | `{date: {tasks_done, focus_mins}}` |
| `freeze_tokens` | `{count, lastReset}` monthly freeze token state |

---

## What Is Coming Next

| Feature | Description |
|---------|------------|
| **GitHub Activity Widget** | Show open PRs, assigned issues, and commit streak using a GitHub token |
| **Code Snippet Library** | Save, tag, and search code snippets synced to a HackMD note |
| **GitHub Contribution Heatmap** | Overlay real commit activity onto the Focus heatmap |
| **PR Review Tracker** | Track weekly PR reviews against a personal goal |
| **Developer XP and Levels** | Earn XP from tasks, Pomodoros, habits, and journal entries |
| **Distraction Log** | Log what interrupted a Pomodoro session |
| **Weekly Report Export** | Generate a markdown summary of the week |
| **Ambient Sound** | Lo-fi or rain sounds tied to focus sessions via Web Audio API |

---

## Security

| Point | Details |
|-------|---------|
| No secrets in source | Tokens and note IDs are set at runtime through the Settings modal |
| API routing | All HackMD API calls go through your own Cloudflare Worker, not directly from the browser |
| Token storage | The API token is stored in IndexedDB, which is scoped to the same origin |
| Deployment | Do not deploy this on a shared or public origin where other users could access your IndexedDB |
| Token scope | Use a HackMD token scoped to the minimum permissions you need |

---

## Troubleshooting

### 401 Unauthorized

| Check | How |
|-------|-----|
| Token still valid | Go to HackMD Settings > API tab |
| Token permissions | Confirm read and write are enabled |
| Direct test | `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.hackmd.io/v1/notes/YOUR_NOTE_ID` |

### ES module errors or blank page on local dev

The app uses ES modules which require an HTTP server. You cannot open `index.html` directly.

```bash
npx serve deploy_v2
```

Then open `http://localhost:3000` (or the port shown).

### Settings not persisting after reload

Config is now stored in IndexedDB. To inspect it: DevTools → Application → IndexedDB → `productive-board` → `config`.

To wipe config and start fresh:

```js
indexedDB.deleteDatabase('productive-board');
location.reload();
```

### CORS errors in the console

| Check | Fix |
|-------|-----|
| Proxy URL format | Settings URL must end with `/hackmd/` |
| Stale Worker code | Redeploy with `npx wrangler deploy` after updating `worker/index.js` |

### Habits or badges lost after reload

This means the Dashboard Data Note ID is not configured. Go to Settings and add the ID of your blank Dashboard Data note. Without it the app works in-session only and all focus data resets on reload.

### Timer resets after a page reload

This is on purpose. The timer pauses on reload to avoid counting time you were not actually working. Click Start to pick up where you left off. Session counts for the day are saved to the Dashboard Data note and are not lost.

### Badges are not unlocking

Badge checks run automatically when you toggle a habit, finish a Pomodoro, or check off a task. If something seems stuck, navigate away from the Focus tab and back to it (`4`) to trigger a fresh check.

---

## Cloudflare Free Tier

The free plan covers 100,000 Worker requests per day, which is plenty for a personal dashboard.

---

## Production

Live at: `https://arigatouz.github.io/ali-productive-board/`
