import { execute, select } from "./db";
import type { AppSettings } from "./types";

interface SettingsRow {
  id: number;
  base_prefix: string;
  number_width: number;
  log_retention_days: number;
  log_retention_min_batches: number;
  dropbox_app_key: string;
  dropbox_app_secret: string;
  dropbox_refresh_token: string;
  last_dropbox_path: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  basePrefix: "NLC",
  numberWidth: 5,
  logRetentionDays: 7,
  logRetentionMinBatches: 10,
  dropboxAppKey: "",
  dropboxAppSecret: "",
  dropboxRefreshToken: "",
  lastDropboxPath: "",
};

function mapRow(row: SettingsRow): AppSettings {
  return {
    basePrefix: row.base_prefix,
    numberWidth: row.number_width,
    logRetentionDays: row.log_retention_days,
    logRetentionMinBatches: row.log_retention_min_batches,
    dropboxAppKey: row.dropbox_app_key,
    dropboxAppSecret: row.dropbox_app_secret,
    dropboxRefreshToken: row.dropbox_refresh_token,
    lastDropboxPath: row.last_dropbox_path ?? "",
  };
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await select<SettingsRow>("SELECT * FROM settings WHERE id = 1");
  if (rows.length === 0) {
    await execute(
      `INSERT OR IGNORE INTO settings
         (id, base_prefix, number_width, log_retention_days, log_retention_min_batches, dropbox_app_key, dropbox_app_secret, dropbox_refresh_token, last_dropbox_path)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_SETTINGS.basePrefix,
        DEFAULT_SETTINGS.numberWidth,
        DEFAULT_SETTINGS.logRetentionDays,
        DEFAULT_SETTINGS.logRetentionMinBatches,
        DEFAULT_SETTINGS.dropboxAppKey,
        DEFAULT_SETTINGS.dropboxAppSecret,
        DEFAULT_SETTINGS.dropboxRefreshToken,
        DEFAULT_SETTINGS.lastDropboxPath,
      ],
    );
    return { ...DEFAULT_SETTINGS };
  }
  return mapRow(rows[0]);
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch };
  await execute(
    `UPDATE settings SET
       base_prefix = ?,
       number_width = ?,
       log_retention_days = ?,
       log_retention_min_batches = ?,
       dropbox_app_key = ?,
       dropbox_app_secret = ?,
       dropbox_refresh_token = ?,
       last_dropbox_path = ?
     WHERE id = 1`,
    [
      next.basePrefix,
      next.numberWidth,
      next.logRetentionDays,
      next.logRetentionMinBatches,
      next.dropboxAppKey,
      next.dropboxAppSecret,
      next.dropboxRefreshToken,
      next.lastDropboxPath,
    ],
  );
  return next;
}
