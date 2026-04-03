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

This opens a browser window asking you to authorise Wrangler. Click **Allow**. You will see a success message in the terminal once done.

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
curl -H "Authorization: Bearer YOUR_HACKMD_TOKEN" \
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
- You inject values at runtime via Settings UI only.
- Never commit real token or note IDs to the repository.

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
