# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal productivity dashboard deployed as a static single-page app. Pure vanilla JS (no frameworks), single `index.html` file (~6300 lines). All data stored in `localStorage` or synced to HackMD notes via API.

## Architecture

**Pure Static Frontend:** Everything (HTML, CSS, JS) is served as static files. No build step, no bundler. Edit `index.html` directly.

**Data Flow:** Browser → CORS Proxy → HackMD API.

**Configuration:** API tokens and Note IDs are stored in `localStorage` and configured via the Settings modal (⚙️ button).

## Tabs & Panels

| Tab | Panel ID | Data source |
|-----|----------|-------------|
| Tasks | `#tasksPanel` | HackMD `TASKS_NOTE_ID` |
| Memory | `#memoryPanel` | HackMD `MEMORY_NOTE_ID` |
| Articles | `#articlesPanel` | HackMD `ARTICLES_NOTE_ID` |
| Focus | `#focusPanel` | `localStorage` only |
| Journal | `#journalPanel` | `localStorage` + optional HackMD `JOURNAL_NOTE_ID` |

All 5 tabs are toggled by `switchMainTab(tab)`. Tab buttons: `tasksTabBtn`, `memoryTabBtn`, `articlesTabBtn`, `focusTabBtn`, `journalTabBtn`.

## Features (as of feat/productivity-features branch)

- **Kanban board** (board view + list view) + drag/drop columns and cards
- **Memory viewer** — structured markdown parsed into tabs
- **Articles reading list** — status cycle, progress slider
- **Pomodoro timer** — circular SVG ring, focus/break/long-break phases, daily session log (`pomo_log` in localStorage), browser notifications. Compact header widget. Functions: `pomoToggle()`, `pomoReset()`, `pomoSkip()`
- **Habit tracker** — add/delete habits, daily toggle, flame streaks, 12-week heatmap, freeze tokens (2/month). Data: `habits` + `habit_log` in localStorage
- **Weekly stats gauge** — productivity score from tasks + focus + habits. Analytics tracked in `analytics` localStorage key via `trackAnalytics(key, val)`
- **Achievements (12 badges)** — defined in `BADGE_DEFS` array, unlocked state in `badges_unlocked`. Show via `showBadgeToast(badge)`
- **Command palette** — `Cmd/Ctrl+K`, defined in `CMD_LIST` array, fuzzy substring match
- **Quick capture** — `Ctrl+Shift+C` floating button, saves to `qc_inbox` localStorage + auto-creates task
- **Journal** — local-first daily entries in `journal` localStorage, optional HackMD sync, date navigation, daily prompts
- **Keyboard shortcuts** — 1-5 tabs, Alt+T timer, ?, Esc priority chain
- **Cyber save loader** — `showCyberLoader(label)` / `hideCyberLoader()` (defined in second `<script>` block at end of file)
- **Themes** — light, dark, neon-dark, neon-light — set via `applyTheme(name)`

## Key Patterns

- **Initialization:** `initDashboard()` is called on load. It runs `initPomodoro()`, `initHabits()`, `initCmdPalette()`, `initQC()`, `initJournal()`, `checkBadges()`, then HackMD loads.
- **API Calls:** All HackMD requests go through `getFullApiUrl(path)` which applies the CORS proxy.
- **Task Format:** `## Section` headers + `- [ ]`/`- [x]` checkboxes, parsed by `parseTaskMarkdown()`, serialized by `toMarkdown()`
- **Tab switching:** Always use `switchMainTab(tabName)`. Valid names: `'tasks'|'memory'|'articles'|'focus'|'journal'`
- **Analytics hook:** `trackAnalytics('tasks_done', n)` or `trackAnalytics('focus_mins', n)` — used by stats gauge
- **Modal system:** Single shared `#modalOverlay`. Set `modalTitle.textContent`, `modalBody.innerHTML`, and `onSettingsSave` callback before showing. `closeModal()` to hide.
- **Status bar:** `showStatus('message')` — auto-hides after 2.5s

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `hackmd_*` | API token + note IDs |
| `dashboard_theme` | Active theme |
| `habits` | Array of habit objects `{id, name, emoji}` |
| `habit_log` | `{date: [habitId, ...]}` completion log |
| `pomo_state` | Current timer state |
| `pomo_log` | `{date: count}` daily session counts |
| `analytics` | `{date: {tasks_done, focus_mins}}` |
| `badges_unlocked` | `{badgeId: unlockedDate}` |
| `journal` | `{date: markdownText}` |
| `qc_inbox` | Array of quick captures |
| `freeze_tokens` | `{count, lastReset}` |

## Deploy

### GitHub Pages
Push to GitHub, enable Pages on root directory.

### Production
Site: `https://arigatouz.github.io/ali-productive-board/`

## File Structure

```
deploy_v2/
  index.html       ← entire app (~6300 lines)
  worker/
    index.js       ← Cloudflare Worker CORS proxy
  CLAUDE.md
```
