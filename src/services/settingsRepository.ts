import { execute, select } from "./db";
import type { AppSettings } from "./types";

interface SettingsRow {
  id: number;
  base_prefix: string;
  number_width: number;
  log_retention_days: number;
  log_retention_min_batches: number;
  last_dropbox_path: string;
  default_startup_dropbox_path: string | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  basePrefix: "NLC",
  numberWidth: 5,
  logRetentionDays: 7,
  logRetentionMinBatches: 10,
  lastDropboxPath: "",
  defaultStartupDropboxPath: null,
};

function mapRow(row: SettingsRow): AppSettings {
  return {
    basePrefix: row.base_prefix,
    numberWidth: row.number_width,
    logRetentionDays: row.log_retention_days,
    logRetentionMinBatches: row.log_retention_min_batches,
    lastDropboxPath: row.last_dropbox_path ?? "",
    defaultStartupDropboxPath: row.default_startup_dropbox_path ?? null,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await select<SettingsRow>("SELECT * FROM settings WHERE id = 1");
  if (rows.length === 0) {
    await execute(
      `INSERT OR IGNORE INTO settings
         (id, base_prefix, number_width, log_retention_days, log_retention_min_batches, last_dropbox_path, default_startup_dropbox_path)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_SETTINGS.basePrefix,
        DEFAULT_SETTINGS.numberWidth,
        DEFAULT_SETTINGS.logRetentionDays,
        DEFAULT_SETTINGS.logRetentionMinBatches,
        DEFAULT_SETTINGS.lastDropboxPath,
        DEFAULT_SETTINGS.defaultStartupDropboxPath,
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
       last_dropbox_path = ?,
       default_startup_dropbox_path = ?
     WHERE id = 1`,
    [
      next.basePrefix,
      next.numberWidth,
      next.logRetentionDays,
      next.logRetentionMinBatches,
      next.lastDropboxPath,
      next.defaultStartupDropboxPath,
    ],
  );
  return next;
}
