import {
  getDropboxAuthRecord,
  saveDropboxAuthRecord,
  clearDropboxAuthRecord,
} from "./dropboxAuthRepository";

/**
 * Dropbox OAuth 2.0 Authorization Code flow with PKCE.
 *
 * No app secret exists anywhere in this module (or anywhere in the
 * frontend) — the app key comes from the VITE_DROPBOX_APP_KEY build-time
 * env var, and PKCE public clients authenticate the authorization-code
 * exchange and refresh-token grant with `client_id` alone. `redirect_uri`
 * comes from VITE_DROPBOX_REDIRECT_URI.
 *
 * Flow:
 * 1. beginDropboxAuth() — generate code_verifier/code_challenge (S256) +
 *    state, stash verifier+state in sessionStorage, redirect the whole page
 *    to Dropbox's /oauth2/authorize with token_access_type=offline so
 *    Dropbox issues a refresh token alongside the access token.
 * 2. Dropbox redirects back to redirect_uri with ?code=...&state=....
 * 3. completeDropboxAuthIfRedirected() — called once on every app load;
 *    validates state, exchanges code for tokens at /oauth2/token using
 *    code_verifier, persists refresh_token + access_token + expires_at, and
 *    strips the auth params from the URL.
 * 4. refreshAccessToken() — used by every authenticated Dropbox API call
 *    (via dropboxService.ts's callWithTokenRetry): reuses a still-valid
 *    access token (in-memory, falling back to the persisted expires_at) or
 *    mints a new one from the stored refresh token.
 */

const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize";
const CURRENT_ACCOUNT_URL = "https://api.dropboxapi.com/2/users/get_current_account";

/** Refresh 60s before the token's real expiry to avoid edge-of-window failures. */
const EXPIRY_SAFETY_MARGIN_MS = 60_000;
/** Dropbox short-lived tokens default to 4 hours if `expires_in` is omitted. */
const DEFAULT_EXPIRES_IN_SECONDS = 4 * 60 * 60;

/** Single-use — read and removed by completeDropboxAuthIfRedirected(). */
const PKCE_VERIFIER_KEY = "dropbox_pkce_code_verifier";
const PKCE_STATE_KEY = "dropbox_pkce_state";

export type DropboxErrorKind =
  | "missing_credentials"
  | "invalid_refresh_token"
  | "invalid_client"
  | "invalid_token"
  | "path_not_found"
  | "access_denied"
  | "network"
  | "unknown";

export class DropboxServiceError extends Error {
  kind: DropboxErrorKind;
  constructor(message: string, kind: DropboxErrorKind) {
    super(message);
    this.name = "DropboxServiceError";
    this.kind = kind;
  }
}

function getAppKey(): string {
  const appKey = import.meta.env.VITE_DROPBOX_APP_KEY.trim();
  if (!appKey) {
    throw new DropboxServiceError(
      "Dropbox isn't configured for this build (missing VITE_DROPBOX_APP_KEY).",
      "missing_credentials",
    );
  }
  return appKey;
}

function getRedirectUri(): string {
  const redirectUri = import.meta.env.VITE_DROPBOX_REDIRECT_URI.trim();
  if (!redirectUri) {
    throw new DropboxServiceError(
      "Dropbox isn't configured for this build (missing VITE_DROPBOX_REDIRECT_URI).",
      "missing_credentials",
    );
  }
  return redirectUri;
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64UrlEncode(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// Step 1-4: kick off the redirect to Dropbox
// ---------------------------------------------------------------------------

/**
 * Generates the PKCE verifier/challenge/state, stores the verifier+state in
 * sessionStorage (survives the round trip to Dropbox and back; cleared on
 * tab close), and redirects the page to Dropbox's authorize endpoint.
 */
export async function beginDropboxAuth(): Promise<void> {
  const appKey = getAppKey();
  const redirectUri = getRedirectUri();

  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = randomBase64Url(16);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("token_access_type", "offline");

  window.location.assign(url.toString());
}

// ---------------------------------------------------------------------------
// Step 5: handle the redirect back
// ---------------------------------------------------------------------------

export type DropboxAuthCallbackResult =
  | { status: "not-a-callback" }
  | { status: "success" }
  | { status: "error"; message: string };

/**
 * Call once on every app load. If the current URL is a Dropbox redirect
 * (`?code=...&state=...` or `?error=...`), validates `state` against what
 * was stashed before redirecting, exchanges the code for tokens (no
 * client_secret), persists them, and strips the auth params from the URL —
 * so a reload never resubmits a stale/already-used authorization code.
 * Resolves `{ status: "not-a-callback" }` (a no-op) for a normal page load.
 */
export async function completeDropboxAuthIfRedirected(): Promise<DropboxAuthCallbackResult> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const returnedState = params.get("state");
  const errorParam = params.get("error");

  if (!code && !errorParam) return { status: "not-a-callback" };

  const storedVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const storedState = sessionStorage.getItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);

  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState({}, "", cleanUrl);

  if (errorParam) {
    return { status: "error", message: "Dropbox authorization was cancelled or denied." };
  }
  if (!code || !returnedState || !storedState || returnedState !== storedState) {
    return { status: "error", message: "Dropbox sign-in could not be verified. Please try connecting again." };
  }
  if (!storedVerifier) {
    return { status: "error", message: "Dropbox sign-in session expired. Please try connecting again." };
  }

  let appKey: string;
  let redirectUri: string;
  try {
    appKey = getAppKey();
    redirectUri = getRedirectUri();
  } catch (err) {
    return {
      status: "error",
      message: err instanceof DropboxServiceError ? err.message : "Dropbox is not configured for this build.",
    };
  }

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: appKey,
        redirect_uri: redirectUri,
        code_verifier: storedVerifier,
      }).toString(),
    });
  } catch {
    return {
      status: "error",
      message: "Could not reach Dropbox to finish connecting. Check your internet connection.",
    };
  }

  if (!response.ok) {
    return { status: "error", message: "Dropbox rejected the connection request. Please try connecting again." };
  }

  let data: { access_token?: string; refresh_token?: string; expires_in?: number };
  try {
    data = await response.json();
  } catch {
    return { status: "error", message: "Dropbox returned an unexpected response. Please try again." };
  }

  if (!data.access_token || !data.refresh_token) {
    return { status: "error", message: "Dropbox didn't return an offline connection. Please try again." };
  }

  const expiresAt = Date.now() + (data.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000;
  await saveDropboxAuthRecord({
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    accessTokenExpiresAt: expiresAt,
  });
  cachedAccessToken = { accessToken: data.access_token, expiresAt };

  // Best-effort account info fetch, purely cosmetic for the "Connected as
  // ..." line in Settings — a failure here doesn't affect the connection.
  try {
    const accountResponse = await fetch(CURRENT_ACCOUNT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.access_token}`, "Content-Type": "application/json" },
      body: "null",
    });
    if (accountResponse.ok) {
      const account = (await accountResponse.json()) as { name?: { display_name?: string }; email?: string };
      await saveDropboxAuthRecord({
        accountEmail: account.email ?? null,
        accountName: account.name?.display_name ?? null,
      });
    }
  } catch {
    // non-fatal
  }

  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Access token refresh — no secret, PKCE public client
// ---------------------------------------------------------------------------

// In-memory cache so repeated API calls within a session don't hit
// IndexedDB every time; access_token/expires_at are also persisted (see
// above/below) so a page reload doesn't force an immediate refresh.
let cachedAccessToken: { accessToken: string; expiresAt: number } | null = null;

/** Forces the next refreshAccessToken() call to mint a fresh token instead of reusing the cache. */
export function invalidateCachedAccessToken(): void {
  cachedAccessToken = null;
}

/** True once a refresh token is on file — i.e. "connected" — regardless of whether the current access token is still valid. */
export async function hasDropboxRefreshToken(): Promise<boolean> {
  const record = await getDropboxAuthRecord();
  return !!record.refreshToken;
}

async function parseErrorTag(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.error?.[".tag"] === "string") return body.error[".tag"];
    if (typeof body?.error_summary === "string") return body.error_summary;
  } catch {
    // response body wasn't JSON (or was empty) — fall through with no tag
  }
  return "";
}

/**
 * Returns a valid access token, refreshing from the stored refresh token if
 * the cached one is missing/expired. Never accepts or sends a client
 * secret — the refresh-token grant for a PKCE public client is
 * authenticated with `client_id` alone.
 */
export async function refreshAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt - EXPIRY_SAFETY_MARGIN_MS > now) {
    return cachedAccessToken.accessToken;
  }

  const record = await getDropboxAuthRecord();

  if (
    record.accessToken &&
    record.accessTokenExpiresAt &&
    record.accessTokenExpiresAt - EXPIRY_SAFETY_MARGIN_MS > now
  ) {
    cachedAccessToken = { accessToken: record.accessToken, expiresAt: record.accessTokenExpiresAt };
    return record.accessToken;
  }

  if (!record.refreshToken) {
    throw new DropboxServiceError("Connect your Dropbox account in Settings to continue.", "missing_credentials");
  }

  const appKey = getAppKey();

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: record.refreshToken,
        client_id: appKey,
      }).toString(),
    });
  } catch {
    throw new DropboxServiceError(
      "Could not reach Dropbox. Check your internet connection and try again.",
      "network",
    );
  }

  if (!response.ok) {
    // The OAuth token endpoint returns errors shaped like
    // {"error": "invalid_grant: ..."} — a tag prefix followed by a human
    // description, not a bare tag — so this must be a prefix check.
    const errorTag = await parseErrorTag(response);

    if (errorTag.startsWith("invalid_grant")) {
      throw new DropboxServiceError("Dropbox session expired. Reconnect Dropbox.", "invalid_refresh_token");
    }
    if (errorTag.startsWith("invalid_client") || response.status === 401) {
      throw new DropboxServiceError("Dropbox rejected this app's connection. Reconnect Dropbox.", "invalid_client");
    }
    if (response.status === 400) {
      // Most 400s on this endpoint that aren't a recognized tag are still a
      // bad/revoked refresh token rather than a malformed request.
      throw new DropboxServiceError("Dropbox session expired. Reconnect Dropbox.", "invalid_refresh_token");
    }
    throw new DropboxServiceError("Dropbox returned an unexpected error. Please try again.", "unknown");
  }

  let data: { access_token?: string; expires_in?: number };
  try {
    data = await response.json();
  } catch {
    throw new DropboxServiceError("Dropbox returned an unexpected error. Please try again.", "unknown");
  }

  if (!data.access_token) {
    throw new DropboxServiceError("Dropbox returned an unexpected error. Please try again.", "unknown");
  }

  const expiresAt = now + (data.expires_in ?? DEFAULT_EXPIRES_IN_SECONDS) * 1000;
  cachedAccessToken = { accessToken: data.access_token, expiresAt };
  // Best-effort persistence — losing this just costs one extra refresh call
  // after the next reload, not a functional problem.
  void saveDropboxAuthRecord({ accessToken: data.access_token, accessTokenExpiresAt: expiresAt }).catch(() => {});

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Connection status + disconnect
// ---------------------------------------------------------------------------

export interface DropboxConnectionInfo {
  connected: boolean;
  email: string | null;
  name: string | null;
}

export async function getDropboxConnectionInfo(): Promise<DropboxConnectionInfo> {
  const record = await getDropboxAuthRecord();
  return {
    connected: !!record.refreshToken,
    email: record.accountEmail,
    name: record.accountName,
  };
}

/** Clears every Dropbox auth token from storage and the in-memory cache. */
export async function disconnectDropbox(): Promise<void> {
  await clearDropboxAuthRecord();
  cachedAccessToken = null;
}
