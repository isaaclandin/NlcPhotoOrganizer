-- NLC Photo Renamer: initial local persistence schema.
-- Mirrored (kept behaviorally identical) in src/services/db.ts for the
-- browser/dev fallback backend, so both engines produce the same shape.

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_prefix TEXT NOT NULL DEFAULT 'NLC',
  number_width INTEGER NOT NULL DEFAULT 5,
  log_retention_days INTEGER NOT NULL DEFAULT 7,
  log_retention_min_batches INTEGER NOT NULL DEFAULT 10,
  dropbox_app_key TEXT NOT NULL DEFAULT '',
  dropbox_app_secret TEXT NOT NULL DEFAULT '',
  dropbox_refresh_token TEXT NOT NULL DEFAULT '',
  last_dropbox_path TEXT NOT NULL DEFAULT ''
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
  file_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  new_name TEXT NOT NULL,
  result TEXT NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id ON batch_items(batch_id);
