# Ali Productive Board

Static productivity dashboard with three HackMD-backed areas:

- Tasks board
- Memory notes
- Articles tracker

## Quick Start After `git clone`

Follow these exact steps to run the app with your own private configuration.

### 1) Clone and open the project

```bash
git clone <your-repo-url>
cd ali-productive-board
```

You can run the app as a static site (for example with GitHub Pages) or open `index.html` in a browser for local testing.

### 2) Create your Cloudflare Worker proxy URL

HackMD API needs a proxy for browser-based calls (CORS).

This repo already contains Worker code in `worker/index.js` and config in `wrangler.toml`.

Deploy the worker (either via Cloudflare dashboard Git integration or Wrangler CLI), then copy your worker URL:

`https://<worker-name>.<subdomain>.workers.dev/`

Your app setting must use:

`https://<worker-name>.<subdomain>.workers.dev/hackmd/`

> Important: keep the trailing `/hackmd/`.

### 3) Generate a HackMD API token

1. Go to HackMD → `Settings` → `API`.
2. Create/copy your API token.
3. Keep it private. Do **not** commit it to git.

### 4) Prepare your HackMD note IDs

Create (or choose) three HackMD notes:

- Tasks note
- Memory note
- Articles note

For each note, copy the ID from the URL:

- URL example: `https://hackmd.io/AbCdEfGhIjKlMnOpQrStUv`
- Note ID: `AbCdEfGhIjKlMnOpQrStUv`

### 5) Open the app and save settings

1. Open the app.
2. Click the Settings button (gear icon).
3. Fill all fields:
   - `HackMD API Token`
   - `CORS Proxy URL` (`...workers.dev/hackmd/`)
   - `Tasks Note ID`
   - `Memory Note ID`
   - `Articles Note ID`
4. Click `Save`.

Settings are stored in your browser `localStorage`.

## Security Model

- No secrets are hardcoded in source.
- You inject values at runtime via Settings UI (or `env.js` for private/self-managed deployments).
- Never commit real token or note IDs to the repository.

## Optional Runtime Injection via `env.js`

If you want prefilled values in a private environment, you can use `env.js`:

```javascript
window.HACKMD_ENV = {
  API_TOKEN: '',
  TASKS_NOTE_ID: '',
  MEMORY_NOTE_ID: '',
  ARTICLES_NOTE_ID: '',
  CORS_PROXY: ''
};
```

UI-saved values in `localStorage` take precedence over `env.js`.

## Troubleshooting

### 401 Unauthorized

1. Confirm the token is valid in HackMD.
2. Confirm the token can access the target notes.
3. Confirm your proxy URL is correct and ends with `/hackmd/`.
4. Test directly:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.hackmd.io/v1/notes/YOUR_NOTE_ID
```

### CORS errors

- Ensure app requests go through your Cloudflare Worker proxy (not directly to HackMD from browser).
- Ensure the configured URL is the Worker endpoint with `/hackmd/`.
