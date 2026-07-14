import { execute, select } from "./db";

/**
 * Persisted Dropbox OAuth PKCE tokens (browser IndexedDB via db.ts's
 * BrowserBackend, or SQLite via TauriBackend). Never holds an app secret —
 * PKCE public clients don't have one. `refreshToken === null` means "not
 * connected" (see disconnectDropbox in dropboxAuth.ts, which deletes the row
 * entirely rather than blanking its fields).
 */
export interface DropboxAuthRecord {
  refreshToken: string | null;
  accessToken: string | null;
  /** Epoch ms, or null if no access token is cached. */
  accessTokenExpiresAt: number | null;
  accountEmail: string | null;
  accountName: string | null;
}

interface DropboxAuthRow {
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: number | null;
  account_email: string | null;
  account_name: string | null;
}

const EMPTY_RECORD: DropboxAuthRecord = {
  refreshToken: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  accountEmail: null,
  accountName: null,
};

function mapRow(row: DropboxAuthRow): DropboxAuthRecord {
  return {
    refreshToken: row.refresh_token,
    accessToken: row.access_token,
    accessTokenExpiresAt: row.access_token_expires_at,
    accountEmail: row.account_email,
    accountName: row.account_name,
  };
}

export async function getDropboxAuthRecord(): Promise<DropboxAuthRecord> {
  const rows = await select<DropboxAuthRow>("SELECT * FROM dropbox_auth WHERE id = 1");
  return rows.length > 0 ? mapRow(rows[0]) : { ...EMPTY_RECORD };
}

/** Merges `patch` onto whatever's currently stored and writes the full row (creating it if absent). */
export async function saveDropboxAuthRecord(patch: Partial<DropboxAuthRecord>): Promise<DropboxAuthRecord> {
  const current = await getDropboxAuthRecord();
  const next: DropboxAuthRecord = { ...current, ...patch };
  const values = [next.refreshToken, next.accessToken, next.accessTokenExpiresAt, next.accountEmail, next.accountName];

  const existing = await select<{ id: number }>("SELECT id FROM dropbox_auth WHERE id = 1");
  if (existing.length === 0) {
    await execute(
      `INSERT INTO dropbox_auth (id, refresh_token, access_token, access_token_expires_at, account_email, account_name)
       VALUES (1, ?, ?, ?, ?, ?)`,
      values,
    );
  } else {
    await execute(
      `UPDATE dropbox_auth SET
         refresh_token = ?,
         access_token = ?,
         access_token_expires_at = ?,
         account_email = ?,
         account_name = ?
       WHERE id = 1`,
      values,
    );
  }
  return next;
}

/** Disconnect — removes the row entirely, clearing every Dropbox auth token from storage. */
export async function clearDropboxAuthRecord(): Promise<void> {
  await execute("DELETE FROM dropbox_auth WHERE id = 1");
}
