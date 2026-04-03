# Ali Productive Board

Static productivity dashboard with three HackMD-backed areas:

- **Tasks** — Kanban board with sections, tasks, subtasks, and drag-and-drop
- **Memory** — Structured notes viewer with editable sections
- **Articles** — Reading tracker with progress and status

---

## Quick Start After `git clone`

### 1) Clone and open the project

```bash
git clone <your-repo-url>
cd ali-productive-board
```

You can run it as a static site (GitHub Pages) or open `index.html` locally.

### 2) Deploy the Cloudflare Worker proxy

HackMD's API does not allow direct browser requests (CORS). The Worker in this repo acts as a secure middleman between the app and HackMD. Follow these steps to deploy it.

---

#### Step 1 — Create a free Cloudflare account

1. Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Enter your email and a password, then click **Create Account**.
3. Verify your email address when the confirmation email arrives.
4. You do not need to add a domain. A free account is sufficient.

---

#### Step 2 — Install Node.js (if not already installed)

Wrangler (the Cloudflare CLI) requires Node.js 18 or later.

```bash
node -v   # check current version
```

If missing or outdated, download it from [https://nodejs.org](https://nodejs.org) and install the LTS version.

---

#### Step 3 — Install Wrangler

```bash
npm install -g wrangler
```

Verify it installed correctly:

```bash
wrangler -v
```

---

#### Step 4 — Log in to Cloudflare via Wrangler

```bash
wrangler login
```

This opens a browser window asking you to authorize Wrangler. Click **Allow**. You will see a success message in the terminal once done.

---

#### Step 5 — Review the Worker code and config

The Worker code is already written. Two files matter:

| File | Purpose |
|------|---------|
| `worker/index.js` | The Worker logic — proxies requests to HackMD |
| `wrangler.toml` | Deployment config — Worker name, entry point |

Open `wrangler.toml` and update the `name` field if you want a custom URL:

```toml
name = "ali-productive-board"   # change this to whatever you like
main = "worker/index.js"
compatibility_date = "2024-04-03"
```

The Worker name becomes part of your URL:
`https://<name>.<your-subdomain>.workers.dev`

---

#### Step 6 — Deploy the Worker

From the root of the project, run:

```bash
npx wrangler deploy
```

A successful deploy looks like this:

```
✨  Built successfully
✨  Successfully published your script to
    https://ali-productive-board.<subdomain>.workers.dev
```

Copy that URL — you will need it in the next step.

---

#### Step 7 — Verify the Worker is live

Test the path guard (should return `400 Bad Request`):

```bash
curl -i https://<your-worker-url>/
```

Test a proxied call with your HackMD token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://<your-worker-url>/hackmd/notes/YOUR_NOTE_ID
```

You should get a JSON response with note data. If you get `401`, the token is wrong. If you get `400`, the path is missing `/hackmd/`.

---

#### Step 8 — Copy the proxy URL for the app settings

Your proxy URL to paste into the app settings is:

```
https://<worker-name>.<subdomain>.workers.dev/hackmd/
```

> Keep the trailing `/hackmd/` — the Worker uses it to route requests to HackMD.

---

#### Redeploying after changes

Any time you edit `worker/index.js`, redeploy with:

```bash
npx wrangler deploy
```

---

#### Cloudflare free tier limits

The free Workers plan allows **100,000 requests per day**, which is more than enough for a personal dashboard.

### 3) Generate a HackMD API token

1. Go to HackMD → **Settings** → **API**
2. Create and copy your personal API token
3. Never commit it to git

### 4) Create your three HackMD notes

Create one note for each area and copy the ID from the URL:

```
https://hackmd.io/AbCdEfGhIjKlMnOpQrStUv
                  ^^^^^^^^^^^^^^^^^^^^^^
                  this is the note ID
```

See the **Note Format** section below for how each note should be structured.

### 5) Configure the app

1. Open the app and click the **gear icon** (Settings)
2. Fill in all fields:
   - `HackMD API Token`
   - `CORS Proxy URL` (`...workers.dev/hackmd/`)
   - `Tasks Note ID`
   - `Memory Note ID`
   - `Articles Note ID`
3. Click **Save**

Settings are stored in `localStorage` — never sent anywhere except to HackMD through your own proxy.

---

## Note Formats

### Tasks Note

Sections are `## H2` headers. Each task is a checkbox item under a section. Tasks support an optional note after a ` - ` separator, and nested subtasks with an extra indent.

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
- The `# Tasks` heading is optional but recommended
- Sections must be `##` (H2) — any name is valid
- Task titles are wrapped in `**bold**` by the app when saving; plain text works too when creating manually
- Subtasks use two-space indent: `  - [ ] subtask`
- `[x]` or `[X]` marks a task as done

---

### Memory Note

The Memory note is a free-form markdown file with `##` sections. The app recognizes five built-in section names and will auto-create them if missing. Any other `##` sections you add are also shown.

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

**Built-in sections** (shown in this order, auto-created if missing):

| Section | Typical content |
|---------|----------------|
| `Me` | Your bio, role, stack |
| `People` | Team members and roles |
| `Terms` | Glossary / abbreviations |
| `Projects` | Active projects |
| `Preferences` | Working preferences |

**Rules:**
- The `# H1` title is the note title (shown in the header)
- Any content before the first `##` is treated as an intro
- Any `##` section name works — not limited to the five built-ins
- Sections can contain any markdown: text, tables, lists, code blocks
- Sections are editable inline by clicking the edit icon

---

### Articles Note

The Articles note is a markdown table. The app reads and writes this table automatically — you normally don't need to edit it by hand.

```markdown
# Articles

| id | name | link | status | progress |
| -- | ---- | ---- | ------ | -------- |
| 1 | How the Browser Works | https://example.com/article | not-read | 0 |
| 2 | CSS Grid Guide | https://css-tricks.com/grid | reading | 60 |
| 3 | JavaScript Promises | https://javascript.info/promise | read | 100 |
```

**Column reference:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Unique auto-incremented ID (managed by app) |
| `name` | string | Article title. Escape `\|` if the title contains a pipe |
| `link` | URL | Full article URL |
| `status` | enum | `not-read` · `reading` · `read` |
| `progress` | integer | Reading progress `0–100` (percentage) |

**Rules:**
- The table header row must start with `| id |` exactly
- Rows with a non-integer `id` are ignored
- The app auto-increments IDs when adding articles through the UI
- You can add articles manually by appending rows, but let the app manage IDs

---

## Themes

Click the theme button in the top-right to switch between four themes:

| Theme | Style |
|-------|-------|
| **Light** | Classic warm orange, clean white cards |
| **Dark** | Classic warm orange, dark cards |
| **Green Neon Dark** | Cyberpunk acid green, void black, CRT scanlines |
| **Neon Light** | Magenta on aged paper |

Theme selection persists in `localStorage`.

---

## Security Model

- No secrets are hardcoded in source
- Token and note IDs are injected at runtime via the Settings UI only
- All API calls go through your own Cloudflare Worker — never directly from the browser to HackMD
- The API token is stored in `localStorage`, which is readable by browser extensions and any JS running on the same origin. Avoid deploying this dashboard on a shared or public origin, and use a HackMD token scoped to the minimum required permissions

---

## Troubleshooting

### 401 Unauthorized

1. Confirm the token is valid in HackMD Settings → API
2. Confirm the token has read and write access to the notes
3. Confirm the proxy URL ends with `/hackmd/`
4. Test directly:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.hackmd.io/v1/notes/YOUR_NOTE_ID
```

### Settings modal shows no input fields

Clear `localStorage` and reload — a stale `"NaN"` value in storage can cause the app to skip the auto-open of the settings modal.

```js
// Run in browser console
localStorage.clear();
location.reload();
```

### CORS errors

- Ensure requests go through the Cloudflare Worker proxy
- Ensure the configured URL is the Worker endpoint ending in `/hackmd/`
- Redeploy the worker if it was recently updated (`npx wrangler deploy`)
