# NLC Photo Renamer

A browser-based tool for renaming Dropbox photo files with a consistent
`PREFIX_Location_Tags_00001.ext` pattern, with folder browsing, thumbnails,
undo, and a rename history log. Runs as a static site (deployable to GitHub
Pages) — no backend, no server-stored credentials.

An optional legacy Tauri desktop shell also still exists in `src-tauri/`
(see [Desktop shell (legacy)](#desktop-shell-legacy) below), but the web
build is the primary target.

## How it stores data

Everything — settings, locations, tags, counters, rename/undo logs, and the
Dropbox refresh token — is stored locally in the browser via IndexedDB
(through a small SQLite-over-WASM layer, `src/services/db.ts`). Nothing is
sent to or stored on any backend server. Clearing your browser's site data
for this app removes everything, including the Dropbox connection.

## Dropbox authentication

This app uses the OAuth 2.0 **Authorization Code flow with PKCE**
(`src/services/dropboxAuth.ts`), not the older implicit grant, and never
handles a Dropbox **app secret** — PKCE public clients don't need one.

- The Dropbox **app key** (`client_id`) is a public value, supplied at build
  time via the `VITE_DROPBOX_APP_KEY` env var and baked into the built JS
  bundle. This is expected and safe — it's not a secret.
- On "Connect Dropbox," the app generates a PKCE `code_verifier` +
  `code_challenge` (S256) and a random `state`, stashes the verifier/state in
  `sessionStorage`, and redirects to Dropbox's authorize page with
  `token_access_type=offline` so Dropbox returns a **refresh token**.
- On redirect back, the app validates `state`, exchanges the authorization
  code for tokens (using `code_verifier`, no secret), and persists the
  refresh token + a short-lived access token (with its expiry) to IndexedDB.
  The auth params are stripped from the URL immediately after.
- Every Dropbox API call refreshes the access token automatically from the
  stored refresh token when it's missing/expired, and retries once on a 401.
- If the refresh token itself is rejected by Dropbox (revoked/expired), the
  app shows **"Dropbox session expired. Reconnect Dropbox."** — reconnecting
  is a normal "Connect Dropbox" click in Settings.
- **Disconnect Dropbox** (in Settings) deletes every stored Dropbox token
  from IndexedDB immediately.
- Access tokens, refresh tokens, authorization codes, and (moot, since it's
  never used) the app secret are never written to `console.*`.

## Local development

```bash
npm install
cp .env.example .env.local
# edit .env.local: set VITE_DROPBOX_APP_KEY (VITE_DROPBOX_REDIRECT_URI is
# already set to the right value for local dev)
npm run dev
```

The dev server runs on **`http://localhost:5173`** — Vite's own default,
pinned explicitly in `vite.config.ts` (the legacy Tauri shell's `devUrl` is
kept in sync with this same port). Your `VITE_DROPBOX_REDIRECT_URI` for local
dev should be `http://localhost:5173/`, and that exact URL must also be
registered in the Dropbox App Console (see below).

## Dropbox App Console setup

At <https://www.dropbox.com/developers/apps>, open your app (or create one
with **Scoped access**) and configure:

1. **Redirect URIs** — add every origin this app will run from, exactly
   (including trailing slash):
   - `http://localhost:5173/` (local dev)
   - `https://<your-github-username>.github.io/<repo-name>/` (GitHub Pages)
   - any custom domain you deploy to
2. **Permissions tab → scopes** — enable:
   - `files.metadata.read`
   - `files.content.read`
   - `files.content.write`
3. Copy the **App key** shown on the Settings tab — that's your
   `VITE_DROPBOX_APP_KEY`. The **App secret** is not needed anywhere in this
   project; don't put it in `.env`, GitHub secrets, or anywhere else.

## Deploying to GitHub Pages

`.github/workflows/deploy-pages.yml` builds and deploys `dist/` on every
push to `main` (and via manual dispatch), using GitHub's official Pages
Actions (`upload-pages-artifact` + `deploy-pages` — no `gh-pages` branch or
personal access token needed).

One-time setup:

1. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_DROPBOX_APP_KEY` — your Dropbox app key
   - `VITE_DROPBOX_REDIRECT_URI` — `https://<your-username>.github.io/<repo-name>/`

   These are repository **variables**, not secrets — the app key is a public
   OAuth client_id, safe to expose in the built bundle and in workflow logs.
   The app secret is never used, so it never goes into GitHub Actions at all.
3. Push to `main`. The workflow sets `VITE_BASE_PATH` to `/<repo-name>/`
   automatically (derived from the repository name) so all asset URLs
   resolve correctly under the Pages subpath. If you deploy to a custom
   domain or a user/org root site instead of a project subpath, set
   `VITE_BASE_PATH` to `/` instead.

After the first deploy, visit the Pages URL, go to **Settings → Dropbox
Connection**, and click **Connect Dropbox**.

## Desktop shell (legacy)

`src-tauri/` still contains a Tauri v2 desktop shell (real SQLite via
`@tauri-apps/plugin-sql` instead of the browser's IndexedDB fallback) and
`.github/workflows/windows-build.yml` still builds a Windows NSIS installer
from it. **Dropbox sign-in is not wired up for this shell** — the PKCE
redirect flow assumes a normal browser redirect back to a URL the web app
serves, which the desktop webview doesn't handle. The manual
app-key/secret/refresh-token Settings fields that used to make the desktop
build work were removed as part of the web pivot. Treat the desktop shell as
inactive/unsupported for Dropbox features unless someone wires up a native
redirect handler for it.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
