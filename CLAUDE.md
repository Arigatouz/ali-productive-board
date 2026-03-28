# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal productivity dashboard deployed as a static single-page app on Netlify with serverless backend functions. Provides a password-protected kanban task board and memory/notes viewer, backed by HackMD as the data store.

## Architecture

**Single-file frontend:** Everything (HTML, CSS, JS) lives in `index.html` (~3100 lines). No build step, no framework, no bundler. The `[build] command` in `netlify.toml` is a no-op.

**Serverless backend:** Three Netlify Functions in `netlify/functions/`:
- `auth.js` — Password login, returns HMAC-signed JWT-like token (expiry timestamp + signature)
- `tasks.js` — GET/PATCH proxy to HackMD API for the tasks note (markdown-based kanban)
- `memory.js` — GET proxy to HackMD API for the memory/CLAUDE.md note

All three functions share the same token verification pattern: `payload.signature` where payload is an expiry timestamp and signature is `HMAC-SHA256(payload, TOKEN_SECRET)`.

**Data flow:** Browser -> Netlify Function -> HackMD API. Tasks are stored as markdown in a HackMD note, parsed client-side into sections/tasks for the kanban board.

## Deploy

```bash
netlify deploy --prod --dir=.
```

No build step required. The `--dir=.` flag deploys the root directory as-is.

## Environment Variables (Netlify)

All configured in Netlify site settings (not in code):
- `DASHBOARD_PASSWORD` — Login password
- `TOKEN_SECRET` — HMAC secret for auth tokens
- `HACKMD_API_TOKEN` — HackMD API bearer token
- `TASKS_NOTE_ID` — HackMD note ID for tasks
- `MEMORY_NOTE_ID` — HackMD note ID for memory

## Key Patterns

- **Auth flow:** Password gate on page load -> POST to `/api/auth` -> token stored in `sessionStorage` -> all subsequent API calls use `Authorization: Bearer <token>`
- **Task format:** Markdown with `## Section` headers and `- [ ]`/`- [x]` checkboxes, parsed by `parseTaskMarkdown()` and serialized by `toMarkdown()`
- **API routing:** `/api/*` redirects to `/.netlify/functions/*` via `netlify.toml` redirects

## Production

Site: `ali-productivity-dashboard.netlify.app`
