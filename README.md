# 📋 Ali Productive Board

A personal productivity dashboard featuring a **kanban task board** and **memory/notes viewer**, deployed as a static single-page app on Netlify with serverless backend functions.

🔗 **Live Site:** [ali-productivity-dashboard.netlify.app](https://ali-productivity-dashboard.netlify.app)

---

## ✨ Features

- **🔐 Password-Protected Access** — Secure login gate with HMAC-signed token authentication (7-day expiry)
- **📌 Kanban Task Board** — Drag-and-drop task management with sections, checkboxes, and real-time sync
- **📝 Memory / Notes Viewer** — View and browse personal notes and context documents
- **☁️ HackMD-Backed Storage** — All data stored as Markdown in HackMD notes, editable from anywhere
- **📱 Responsive Design** — Clean, minimal UI built with Inter font and a warm accent palette
- **⚡ Zero Build Step** — No bundler, no framework — just a single HTML file served as-is

---

## 🏗️ Architecture

```
┌─────────────┐       ┌────────────────────┐       ┌─────────────┐
│   Browser    │ ───▶  │  Netlify Functions  │ ───▶  │  HackMD API │
│  index.html  │ ◀──── │  (auth/tasks/memory)│ ◀──── │  (Markdown)  │
└─────────────┘       └────────────────────┘       └─────────────┘
```

### Frontend

Everything lives in a single `index.html` file (~3,100 lines) — HTML, CSS, and JavaScript combined. No build step, no framework, no bundler.

### Backend (Serverless)

Three Netlify Functions in `netlify/functions/`:

| Function    | Method      | Description                                      |
| ----------- | ----------- | ------------------------------------------------ |
| `auth.js`   | `POST`      | Password login → returns HMAC-signed auth token  |
| `tasks.js`  | `GET/PATCH` | Proxy to HackMD API for task note (read & write) |
| `memory.js` | `GET`       | Proxy to HackMD API for memory/notes (read-only) |

### Auth Flow

```
Password Gate → POST /api/auth → Token → sessionStorage
                                          ↓
                          All API calls use Authorization: Bearer <token>
```

Tokens are `{expiry_timestamp}.{HMAC-SHA256(timestamp, secret)}` — verified server-side on every request.

---

## 📁 Project Structure

```
.
├── index.html              # Single-file frontend (HTML + CSS + JS)
├── package.json            # Project metadata
├── netlify.toml            # Netlify config (redirects, functions directory)
├── CLAUDE.md               # AI coding assistant context file
├── README.md               # This file
└── netlify/
    └── functions/
        ├── auth.js         # Authentication endpoint
        ├── tasks.js        # Tasks CRUD proxy to HackMD
        └── memory.js       # Memory/notes read proxy to HackMD
```

---

## 🚀 Deployment

The app is deployed on **Netlify** with zero build configuration.

```bash
# Deploy to production
netlify deploy --prod --dir=.
```

No build step required — the root directory is served as-is.

### API Routing

All `/api/*` requests are redirected to `/.netlify/functions/*` via `netlify.toml`:

```
/api/auth   → /.netlify/functions/auth
/api/tasks  → /.netlify/functions/tasks
/api/memory → /.netlify/functions/memory
```

---

## ⚙️ Environment Variables

Configure these in **Netlify Site Settings → Environment Variables**:

| Variable             | Description                             |
| -------------------- | --------------------------------------- |
| `DASHBOARD_PASSWORD` | Login password for the dashboard        |
| `TOKEN_SECRET`       | HMAC secret key for signing auth tokens |
| `HACKMD_API_TOKEN`   | HackMD API bearer token                 |
| `TASKS_NOTE_ID`      | HackMD note ID for the tasks board      |
| `MEMORY_NOTE_ID`     | HackMD note ID for memory/notes         |

---

## 🧩 How It Works

### Task Format

Tasks are stored as Markdown in HackMD with section headers and checkboxes:

```markdown
## 🔥 Urgent

- [ ] Fix the login bug
- [x] Update dependencies

## 📋 Backlog

- [ ] Add dark mode
- [ ] Write documentation
```

The frontend parses this with `parseTaskMarkdown()` and serializes changes back with `toMarkdown()`.

### Data Flow

1. **Login** — User enters password → `POST /api/auth` → receives signed token
2. **Load Tasks** — `GET /api/tasks` → Netlify function fetches Markdown from HackMD → parsed client-side into kanban columns
3. **Save Tasks** — Changes serialized to Markdown → `PATCH /api/tasks` → Netlify function pushes to HackMD
4. **View Memory** — `GET /api/memory` → Netlify function fetches notes from HackMD → rendered in the UI

---

## 🛠️ Tech Stack

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Frontend | Vanilla HTML / CSS / JavaScript                                   |
| Backend  | Netlify Serverless Functions (Node.js)                            |
| Auth     | HMAC-SHA256 signed tokens                                         |
| Storage  | HackMD API (Markdown notes)                                       |
| Hosting  | Netlify (static site + functions)                                 |
| Font     | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |

---

## 📄 License

Private project — personal use only.
