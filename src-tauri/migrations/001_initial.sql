-- NLC Photo Renamer: initial local persistence schema.
-- Mirrored (kept behaviorally identical) in src/services/db.ts for the
-- browser/dev fallback backend, so both engines produce the same shape.

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_prefix TEXT NOT NULL DEFAULT 'NLC',
  number_width INTEGER NOT NULL DEFAULT 5,
  log_retention_days INTEGER NOT NULL DEFAULT 7,
  log_retention_min_batches INTEGER NOT NULL DEFAULT 10,
  last_dropbox_path TEXT NOT NULL DEFAULT '',
  -- NULL = not set. '' = Dropbox root, deliberately chosen. Nullable (unlike
  -- last_dropbox_path) so an explicit root default is distinguishable from unset.
  default_startup_dropbox_path TEXT DEFAULT NULL
);

INSERT OR IGNORE INTO settings (id, base_prefix, number_width, log_retention_days, log_retention_min_batches)
VALUES (1, 'NLC', 5, 7, 10);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT OR IGNORE INTO locations (id, label, sort_order) VALUES
  ('loc-shelter', 'Shelter', 0),
  ('loc-north', 'North', 1),
  ('loc-south', 'South', 2),
  ('loc-general', 'General', 3),
  ('loc-custom', 'Custom', 4);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT OR IGNORE INTO tags (id, label, sort_order) VALUES
  ('tag-books', 'Books', 0),
  ('tag-clothing', 'Clothing', 1),
  ('tag-events', 'Events', 2),
  ('tag-people', 'People', 3),
  ('tag-supplies', 'Supplies', 4),
  ('tag-holiday', 'Holiday', 5),
  ('tag-animals', 'Animals', 6);

CREATE TABLE IF NOT EXISTS counters (
  pattern TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  location TEXT NOT NULL,
  location_group TEXT NOT NULL,
  tags TEXT NOT NULL,
  numbering_range TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  -- 'rename' | 'undo'. An undo batch is just another batch row whose items
  -- move files the opposite direction; undo_of_batch_id points back at the
  -- rename batch it reverses.
  operation_type TEXT NOT NULL DEFAULT 'rename',
  undo_of_batch_id TEXT,
  undone_by_batch_id TEXT,
  -- 'none' | 'partial' | 'complete' — only meaningful on rename batches.
  -- See logsRepository.markBatchUndone for how this is derived.
  undo_status TEXT NOT NULL DEFAULT 'none',
  undone_at TEXT
);

CREATE TABLE IF NOT EXISTS batch_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  -- Full Dropbox paths for this row's move: original_path -> new_path.
  -- For an undo batch item these are the *undo* move's own from/to paths
  -- (i.e. original_path = the renamed file's path, new_path = where it's
  -- being restored to) — same column meaning, reused in reverse.
  original_path TEXT NOT NULL DEFAULT '',
  new_path TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON batch_items(batch_id);

-- Dropbox OAuth PKCE tokens. Single row (id = 1), present only once the user
-- has connected — "no row" means "not connected" (see dropboxAuthRepository).
-- The app key/secret never live here (or anywhere in the frontend): the key
-- comes from VITE_DROPBOX_APP_KEY at build time, and PKCE auth needs no secret.
-- Note: the desktop shell has no wired-up redirect handler for the PKCE
-- browser-redirect flow (see dropboxAuth.ts) — this table exists for schema
-- parity with the web build's IndexedDB store, not because desktop OAuth is
-- implemented.
CREATE TABLE IF NOT EXISTS dropbox_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  refresh_token TEXT,
  access_token TEXT,
  access_token_expires_at INTEGER,
  account_email TEXT,
  account_name TEXT
);
