# Ali Productive Board

A developer-focused productivity dashboard — pure static HTML/CSS/JS, zero build step, HackMD-backed storage, everything runs in the browser.

---

## What's Inside

| Tab | What it does |
|-----|-------------|
| **Tasks** | Kanban board (board + list view), drag-and-drop sections and cards, subtasks |
| **Memory** | Structured notes viewer with editable sections, synced from HackMD |
| **Articles** | Tech reading tracker — status cycle, progress slider |
| **Focus** ✨ | Pomodoro timer, habit tracker, weekly stats gauge, achievements, heatmap |
| **Journal** ✨ | Daily writing entries — local-first, optional HackMD cloud sync |

---

## Quick Start After `git clone`

### 1) Clone and open

```bash
git clone <your-repo-url>
cd ali-productive-board
```

Open `index.html` directly in a browser, or deploy to GitHub Pages (no build step needed).

---

### 2) Deploy the Cloudflare Worker proxy

HackMD's API blocks direct browser requests (CORS). The Worker in this repo acts as a secure middleman.

#### Step 1 — Create a free Cloudflare account

Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). A free account is sufficient — no domain needed.

#### Step 2 — Install Node.js ≥ 18

```bash
node -v   # check version
```

Download from [nodejs.org](https://nodejs.org) if needed.

#### Step 3 — Install Wrangler

```bash
npm install -g wrangler
wrangler -v   # verify
```

#### Step 4 — Login

```bash
wrangler login   # opens browser, click Allow
```

#### Step 5 — Review config

| File | Purpose |
|------|---------|
| `worker/index.js` | Worker logic — proxies requests to HackMD |
| `wrangler.toml` | Deployment config |

Edit `wrangler.toml` to set your worker name:

```toml
name = "ali-productive-board"   # becomes part of your URL
main = "worker/index.js"
compatibility_date = "2024-04-03"
```

#### Step 6 — Deploy

```bash
npx wrangler deploy
```

Copy the printed URL, e.g. `https://ali-productive-board.yoursubdomain.workers.dev`

#### Step 7 — Verify it's live

```bash
curl -i -H "Authorization: Bearer YOUR_HACKMD_TOKEN" \
  https://<your-worker-url>/hackmd/notes
```

`200 OK` = success. `401` = bad token. `404` = bad path.

#### Step 8 — Copy the proxy URL

```
https://<worker-name>.<subdomain>.workers.dev/hackmd/
                                             ^^^^^^^^
                                             keep this trailing path
```

---

### 3) Create a HackMD API token

1. HackMD → **Settings** → **API** → create and copy your personal token
2. Never commit this token to git

---

### 4) Create your HackMD notes

Create one note for each area and copy the ID from the URL:

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
| Journal | No | Cloud backup of daily journal entries (local-first without it) |

---

### 5) Configure the app

Click the **⚙️ gear icon** → Settings and fill in:

- **HackMD API Token**
- **CORS Proxy URL** — your `...workers.dev/hackmd/` URL
- **Tasks Note ID**
- **Memory Note ID**
- **Articles Note ID**
- **Journal Note ID** *(optional — journal works offline without this)*

Click **Save**. Settings are stored in `localStorage` only — never sent anywhere other than your own proxy.

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

**Rules:**
- Sections are `##` H2 headers — any name works
- Task titles are wrapped in `**bold**` by the app when saving
- Subtasks use two-space indent: `  - [ ] subtask`
- `[x]` or `[X]` marks done

---

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

Built-in sections (auto-created if missing): `Me`, `People`, `Terms`, `Projects`, `Preferences`. Any additional `##` sections are also shown and editable.

---

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
| `status` | `not-read` · `reading` · `read` |
| `progress` | `0–100` |

The app manages IDs automatically. The table header must start with `| id |`.

---

### Journal Note *(optional)*

When a Journal Note ID is configured, the app syncs all local journal entries to HackMD in this format:

```markdown
# Journal

## 2025-04-05

Today I focused on...

---

## 2025-04-04

Yesterday was productive because...
```

Entries are always saved locally first — HackMD is a backup, not a dependency.

---

## All Features

### Tasks — Kanban Board

- **Board view** and **List view** (toggle in header)
- Drag cards between columns; drag columns to reorder
- Click any task title or note to edit inline
- Subtasks with nested checkboxes
- `+ Add Section` button to create new columns
- Changes saved to HackMD with **Save to HackMD** button

---

### Focus Tab ✨

#### Pomodoro Timer

- Circular SVG progress ring with phase display
- Three phases: **Focus** → **Short Break** → **Long Break**
- After 4 focus sessions, break automatically extends to long break
- Three preset modes:

| Preset | Focus | Break | Long Break |
|--------|-------|-------|------------|
| **25/5** (default) | 25 min | 5 min | 15 min |
| **50/10** | 50 min | 10 min | 20 min |
| **90/20** *(deep work)* | 90 min | 20 min | 30 min |

- Browser notification when phase ends
- Compact header widget shows timer at all times — click it to jump to Focus tab
- Session count tracked daily and shown as dots in the tab

**Developer tip:** Use the **90/20 preset** for deep coding sessions — research shows 90-minute blocks align with the brain's ultradian rhythm, giving you time for full context loading before the break.

#### Habit Tracker

- Add unlimited habits with a custom emoji and name
- One-tap daily check-off per habit
- Flame streak counter (🔥 appears at 3+ days)
- **Freeze tokens** — 2 per calendar month, each preserves a streak on a missed day
- 12-week **activity heatmap** — GitHub contribution graph style, theme-aware

**Suggested developer habits:**

| Habit | Why |
|-------|-----|
| 🔍 Review a PR | Keeps team velocity up; research shows <4hr review turnaround has highest impact |
| 📝 Write a doc | Doc debt accumulates — one function/decision per day adds up |
| 🧪 Write a test | TDD discipline, one test at a time |
| 📖 Read an article | Continuous learning, compound knowledge |
| 🏃 Take a walk | Context reset between focus blocks |
| 🌅 Plan tomorrow | Reduces morning decision fatigue |

#### Weekly Stats

- **Score gauge** (0–100): composite of tasks completed + focus minutes + habit completion
- Week-over-week delta with ↑/↓ indicator
- 7-day bar chart of daily productivity
- Metric breakdown: tasks done, focus time, habit completion %

#### Achievements (12 Badges)

| Badge | Unlock condition |
|-------|-----------------|
| ⏱️ First Pomo | Complete your first Pomodoro |
| 🔥 On a Roll | 5 total Pomodoro sessions |
| ⚔️ Focus Knight | 50 total Pomodoro sessions |
| ✨ 3-Day Streak | 3-day habit streak |
| 🌟 7-Day Blazer | 7-day habit streak |
| 💎 30-Day Legend | 30-day habit streak |
| 🎯 Perfect Day | All habits done in a single day |
| ✅ Task Master | 10 tasks completed in one day |
| 🐦 Early Bird | Log a habit before 8 AM |
| 🦉 Night Owl | Log a habit after 10 PM |
| 🎨 Renaissance | 4+ habits configured |
| 📓 Journal Keeper | 3 journal entries written |

A slide-in toast notification appears when any badge unlocks.

---

### Journal Tab ✨

- Navigate between days with ← → buttons
- Daily writing prompt at the top (cycles through 8 prompts)
- Saves locally with `Cmd/Ctrl + Enter` or the **Save** button
- Syncs to HackMD journal note if configured (silent, non-blocking)
- All entries persist in `localStorage` — works fully offline

---

### Command Palette

Press `Cmd/Ctrl + K` from anywhere.

- Fuzzy search across all dashboard actions
- Arrow key navigation, `Enter` to execute
- Grouped by category: Navigate, Pomodoro, Tasks, Theme, Settings, Help, Capture

---

### Quick Capture

Press `Ctrl + Shift + C` or click the **+** button (bottom-right corner).

- Three capture types: **Task**, **Note**, **Link**
- Tasks are auto-added to the first Kanban column
- All captures saved to `localStorage` inbox (`qc_inbox`)
- Submit with `Cmd/Ctrl + Enter`

---

## Keyboard Shortcuts

### Global

| Action | Shortcut |
|--------|---------|
| Command Palette | `Cmd/Ctrl + K` |
| Quick Capture | `Ctrl + Shift + C` |
| Keyboard shortcut help | `?` |
| Close / dismiss | `Esc` |

### Navigation

| Action | Shortcut |
|--------|---------|
| Go to Tasks | `1` |
| Go to Memory | `2` |
| Go to Articles | `3` |
| Go to Focus | `4` |
| Go to Journal | `5` |

> Shortcut keys only work when focus is not inside an input or textarea.

### Pomodoro

| Action | Shortcut |
|--------|---------|
| Start / Pause timer | `Alt + T` |

### Journal

| Action | Shortcut |
|--------|---------|
| Save journal entry | `Cmd/Ctrl + Enter` |
| Close quick capture | `Esc` |

---

## Themes

Click the theme button in the top-right:

| Theme | Style |
|-------|-------|
| **Light** | Warm orange, clean white cards |
| **Dark** | Warm orange, dark cards |
| **Green Neon Dark** | Cyberpunk acid green, void black, CRT scanlines — ideal for late-night coding sessions |
| **Neon Light** | Magenta on aged paper |

Theme persists in `localStorage`. Also switchable via Command Palette → "Cycle Theme".

---

## Developer-Specific Workflows

### Deep Work Sessions (90-min Pomodoro)

1. Switch to the **90/20 preset** in the Focus tab
2. Before starting, add the task you're working on to the Kanban board
3. Start the timer (`Alt + T`) — the header widget keeps the countdown visible while you're in any tab
4. Use **Quick Capture** (`Ctrl + Shift + C`) to capture ideas mid-session without losing context
5. After the session, use the **Journal** tab to do a quick "what did I accomplish / what's next" reflection
6. Take the full 20-min break before the next session

### Code Review Habit

1. Add "🔍 Review PR" as a habit in the Focus tab
2. During your 5-min Pomodoro break, open your team's PR queue and leave at least one review comment
3. Check off the habit for the day
4. The streak counter keeps you accountable

### Article-to-Task Pipeline

1. Add tech articles to the **Articles** tab as you find them
2. When reading, use **Quick Capture** (type: Note) to save key insights
3. Convert insights into Kanban tasks (e.g., "Try X pattern from that React article")
4. Mark the article as **Read ✓** when done

### Daily Dev Planning (5 min)

1. Open Journal (`5`) → write 2–3 sentences: what you'll focus on today
2. Open Tasks (`1`) → review and reorder your board
3. Start your first Pomodoro (`Alt + T`)

### Weekly Review (Fridays)

1. Check Focus tab → weekly stats gauge and badge progress
2. Open Journal → navigate back through the week's entries
3. Review Articles tab → anything still at 0% that should be dropped?
4. Update Memory tab → new team members, decisions made, terms learned

---

## localStorage Reference

All data is stored client-side only. Nothing is sent to any server except through your own Cloudflare Worker to HackMD.

| Key | Contents |
|-----|---------|
| `hackmd_api_token` | HackMD personal access token |
| `hackmd_tasks_id` | Tasks note ID |
| `hackmd_memory_id` | Memory note ID |
| `hackmd_articles_id` | Articles note ID |
| `hackmd_journal_id` | Journal note ID (optional) |
| `hackmd_cors_proxy` | Cloudflare Worker proxy URL |
| `dashboard_theme` | Active theme name |
| `habits` | Array of habit objects `{id, name, emoji}` |
| `habit_log` | `{date: [habitId, ...]}` daily completions |
| `pomo_state` | Current timer state |
| `pomo_log` | `{date: count}` daily session totals |
| `analytics` | `{date: {tasks_done, focus_mins}}` |
| `badges_unlocked` | `{badgeId: unlockedDate}` |
| `journal` | `{date: markdownText}` all entries |
| `qc_inbox` | Array of quick captures |
| `freeze_tokens` | `{count, lastReset}` |

To reset everything:

```js
// Run in browser console
localStorage.clear();
location.reload();
```

---

## Planned / Future Features

Features identified from developer productivity research that are not yet implemented:

| Feature | What it would do |
|---------|-----------------|
| **GitHub Activity Widget** | Show open PRs, issues assigned, commit streak — fetched via GitHub token |
| **Code Snippet Library** | Capture, tag, and search code snippets — synced to a HackMD note |
| **GitHub Contribution Heatmap** | Real commit activity overlay in the Focus heatmap |
| **PR Review Tracker** | Track how many PRs you've reviewed this week vs. your goal |
| **Developer XP / Levels** | Earn XP from tasks, pomodoros, habits, and journal entries |
| **Distraction Log** | Quick-log what interrupted a Pomodoro session |
| **Weekly Report Export** | Generate a markdown summary of the week's stats |
| **Ambient Sound** | Lo-fi / rain sounds tied to Pomodoro sessions (Web Audio API) |

---

## Security Model

- No secrets are hardcoded in source
- Token and note IDs are configured at runtime via the Settings modal only
- All HackMD API calls go through your own Cloudflare Worker — the browser never calls HackMD directly
- The API token is stored in `localStorage`, which is readable by any JS on the same origin
- Avoid deploying this dashboard on a shared or public origin
- Use a HackMD token with minimum required permissions (read + write for your notes only)

---

## Troubleshooting

### 401 Unauthorized

1. Verify the token is still valid in HackMD Settings → API
2. Confirm the token has read + write access
3. Test directly:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.hackmd.io/v1/notes/YOUR_NOTE_ID
```

### Settings modal shows no input fields

A stale `"NaN"` value in storage can block the settings modal. Clear and reload:

```js
localStorage.clear();
location.reload();
```

### CORS errors

- Ensure the configured proxy URL ends with `/hackmd/`
- Redeploy the Worker if it was recently changed: `npx wrangler deploy`

### Timer resets on page reload

This is intentional — the timer pauses on reload to prevent phantom counts. Click **Start** to resume.

### Badges not unlocking

Badge checks run when habits are toggled, Pomodoros complete, or tasks are checked. Reload the Focus tab to force a check: navigate away and back (`4`).

---

## Cloudflare Free Tier

The free Workers plan allows **100,000 requests/day** — more than enough for a personal dashboard.

---

## Production

Live at: `https://arigatouz.github.io/ali-productive-board/`
