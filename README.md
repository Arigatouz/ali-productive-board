# 📋 Ali Productive Board

A personal productivity dashboard featuring a **kanban task board**, **memory/notes viewer**, and **articles tracker**.

🔗 **Live Site (GitHub Pages):** [Arigatouz.github.io/ali-productive-board/](https://Arigatouz.github.io/ali-productive-board/)

---

## ✨ Features

- **🚀 Static-First Architecture** — Runs entirely in the browser. No server-side functions or complex backends required.
- **📌 Kanban Task Board** — Drag-and-drop task management with sections, checkboxes, and real-time sync.
- **📝 Memory / Notes Viewer** — View and browse personal notes and context documents.
- **📚 Articles Tracker** — Manage your reading list with status tracking and progress bars.
- **☁️ HackMD-Backed Storage** — All data is stored as Markdown in your own HackMD notes.
- **🔐 Client-Side Secrets** — Your HackMD API Token and Note IDs are stored securely in your browser's `localStorage`.
- **🔄 GitHub Pages Ready** — Easy deployment with a built-in CORS proxy configuration to bypass browser limitations.

---

## 🏗️ Architecture

```
┌─────────────┐       ┌────────────────────┐       ┌─────────────┐
│   Browser    │ ───▶  │ Private Cloudflare │ ───▶  │  HackMD API │
│  index.html  │ ◀──── │   Worker Proxy     │ ◀──── │  (Markdown)  │
└─────────────┘       └────────────────────┘       └─────────────┘
```

### Frontend

The application is a single-file static web page (`index.html`). It uses vanilla JavaScript to interact with the HackMD API directly from your browser.

### CORS & Connectivity (Crucial)

Because HackMD's API does not support direct browser requests (CORS), the app requires a CORS proxy. For security and privacy, **it is highly recommended to use your own private Cloudflare Worker proxy.**

#### 🛡️ Setting up a Private Cloudflare Worker Proxy (Free)

This repository includes a pre-configured Cloudflare Worker to act as your CORS proxy.

1. Create a free account at [cloudflare.com](https://www.cloudflare.com/).
2. Fork or push this repository to your GitHub account.
3. In your Cloudflare dashboard, go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
4. Select this repository.
5. Cloudflare will automatically detect the `wrangler.toml` and deploy the worker logic in `worker/index.js`.
6. Once deployed, copy your Worker URL (e.g., `https://hackmd-proxy.yourname.workers.dev/`).
7. In your Dashboard Settings (gear icon), set the **CORS Proxy** to this URL (ensure it ends with `/hackmd/`).

**Note:** If you are deploying manually using the Wrangler CLI:
```bash
npm install
npm run worker:deploy
```

---

## 🚀 Deployment (GitHub Pages)

1. **Push to GitHub**: Push this repository to your GitHub account.
2. **Enable Pages**: 
   - Go to **Settings > Pages** in your GitHub repository.
   - Select **Deploy from a branch**.
   - Choose the `main` branch and the `/ (root)` folder.
   - Click **Save**.
3. **Configure**: Once the site is live, click the **Gear Icon (Settings)** on the dashboard to enter your HackMD API Token and Note IDs.

### 🛠️ Runtime Configuration (Optional)

For teams or multiple deployments, you can pre-configure the dashboard using the `env.js` file in the root directory. This file is loaded at runtime and can provide default values for the API Token and Note IDs.

**Example `env.js`:**
```javascript
window.HACKMD_ENV = {
  API_TOKEN: '',
  TASKS_NOTE_ID: '',
  MEMORY_NOTE_ID: '',
  ARTICLES_NOTE_ID: '',
  CORS_PROXY: ''
};
```
*Note: Using a private Cloudflare Worker (recommended) or a public proxy like `https://api.allorigins.win/raw?url=` if for testing only.*
*Note: Values in `localStorage` (set via the UI Settings) will always take precedence over `env.js`.*

---

## ⚙️ Configuration & Troubleshooting

All configuration can be managed via the UI Settings (gear icon).

### 🔑 Authentication Checklist

If you encounter a **401 Unauthorized** error, follow this checklist:

1. **Verify Token**: Ensure your API token is correctly copied from HackMD Settings > API.
2. **Check Permissions**: The token must have read and write access to the notes.
3. **CORS Proxy**: Ensure the CORS proxy is working. **Recommended:** Use your own Cloudflare Worker (see Architecture section).
4. **Test with curl**: Run this command in your terminal to verify your token and note ID:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.hackmd.io/v1/notes/YOUR_NOTE_ID
   ```

| Variable | Description |
| --- | --- |
| **API Token** | Your HackMD API bearer token (get it from HackMD Settings > API). |
| **CORS Proxy** | The proxy used to reach HackMD (Private Cloudflare Worker recommended). |
| **Tasks Note ID** | The ID of the HackMD note for your tasks. |
| **Memory Note ID** | The ID of the HackMD note for your notes. |
| **Articles Note ID** | The ID of the HackMD note for your reading list. |

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

The frontend parses this into kanban columns and serializes changes back to Markdown when you hit **Save**.

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | Vanilla HTML / CSS / JavaScript |
| **Storage** | HackMD API (Markdown notes) |
| **Hosting** | GitHub Pages (Static) |
| **Proxy** | Public CORS Proxies |
| **Font** | [Inter](https://fonts.google.com/specimen/Inter) |

---

## 📄 License

Private project — personal use only.
