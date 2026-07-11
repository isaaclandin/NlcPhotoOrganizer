/**
 * Local persistence backend.
 *
 * - Inside a real Tauri v2 shell, this talks to `@tauri-apps/plugin-sql`,
 *   which is backed by real SQLite (schema defined in
 *   `src-tauri/migrations/001_initial.sql`).
 * - Outside Tauri (plain browser / `npm run dev` without the Rust shell),
 *   this falls back to `sql.js` (SQLite compiled to WASM), persisting the
 *   database bytes to IndexedDB so data survives reloads. This fallback
 *   exists purely so the feature can be exercised and verified on a
 *   machine without a Rust toolchain installed; the schema it creates is
 *   kept behaviorally identical to the Tauri migration.
 *
 * Every repository in `src/services/*Repository.ts` goes through this
 * module's `execute` / `select`, so callers never need to know which
 * backend is active.
 */

const isTauriRuntime =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export interface ExecuteResult {
  rowsAffected: number;
  lastInsertId?: number;
}

interface DbBackend {
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

// ---------------------------------------------------------------------------
// Browser fallback (sql.js + IndexedDB)
// ---------------------------------------------------------------------------

const BROWSER_SCHEMA_SQL = `
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
`;

/**
 * `CREATE TABLE IF NOT EXISTS` doesn't add new columns to a table that
 * already exists from a previous session's IndexedDB snapshot. SQLite has
 * no "ADD COLUMN IF NOT EXISTS", so this checks `PRAGMA table_info` and
 * adds any columns the schema has gained since since that snapshot was
 * written. Only needed by the browser fallback — Tauri's real SQLite goes
 * through versioned migrations instead.
 */
function applyLightweightColumnMigrations(db: import("sql.js").Database): void {
  const columns = new Set<string>();
  const stmt = db.prepare("PRAGMA table_info(settings)");
  while (stmt.step()) {
    columns.add(stmt.getAsObject().name as string);
  }
  stmt.free();

  if (!columns.has("last_dropbox_path")) {
    db.run("ALTER TABLE settings ADD COLUMN last_dropbox_path TEXT NOT NULL DEFAULT ''");
  }
}

const IDB_DB_NAME = "nlc-photo-renamer-sqljs";
const IDB_STORE_NAME = "sqlite";
const IDB_KEY = "db-bytes";

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadBytesFromIndexedDb(): Promise<Uint8Array | null> {
  const idb = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, "readonly");
    const req = tx.objectStore(IDB_STORE_NAME).get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Uint8Array) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveBytesToIndexedDb(bytes: Uint8Array): Promise<void> {
  const idb = await openIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, "readwrite");
    tx.objectStore(IDB_STORE_NAME).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

class BrowserBackend implements DbBackend {
  private dbPromise: Promise<import("sql.js").Database> | null = null;

  private async getDb() {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
          import("sql.js"),
          import("sql.js/dist/sql-wasm.wasm?url"),
        ]);
        const SQL = await initSqlJs({ locateFile: () => wasmUrl });
        const existing = await loadBytesFromIndexedDb();
        const db = existing ? new SQL.Database(existing) : new SQL.Database();
        db.run(BROWSER_SCHEMA_SQL);
        applyLightweightColumnMigrations(db);
        await saveBytesToIndexedDb(db.export());
        return db;
      })();
    }
    return this.dbPromise;
  }

  private async persist(db: import("sql.js").Database) {
    await saveBytesToIndexedDb(db.export());
  }

  async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
    const db = await this.getDb();
    db.run(sql, params as never);
    await this.persist(db);
    return { rowsAffected: db.getRowsModified() };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as never);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }
}

// ---------------------------------------------------------------------------
// Tauri backend (@tauri-apps/plugin-sql, real SQLite)
// ---------------------------------------------------------------------------

class TauriBackend implements DbBackend {
  private dbPromise: Promise<import("@tauri-apps/plugin-sql").default> | null = null;

  private async getDb() {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const { default: Database } = await import("@tauri-apps/plugin-sql");
        return Database.load("sqlite:nlc-photo-renamer.db");
      })();
    }
    return this.dbPromise;
  }

  async execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
    const db = await this.getDb();
    const result = await db.execute(sql, params);
    return { rowsAffected: result.rowsAffected, lastInsertId: result.lastInsertId };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.getDb();
    return db.select<T[]>(sql, params);
  }
}

const backend: DbBackend = isTauriRuntime ? new TauriBackend() : new BrowserBackend();

export function execute(sql: string, params: unknown[] = []): Promise<ExecuteResult> {
  return backend.execute(sql, params);
}

export function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return backend.select<T>(sql, params);
}

export function isRunningInTauri(): boolean {
  return isTauriRuntime;
}

export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
