import { refreshAccessToken, invalidateCachedAccessToken, DropboxServiceError } from "./dropboxAuth";
import type { DropboxErrorKind } from "./dropboxAuth";
import type {
  DropboxEntry,
  DropboxFileItem,
  DropboxFolderItem,
  DropboxListFolderResult,
  FolderTreeNode,
} from "./dropboxTypes";

/**
 * Dropbox folder-browsing + rename client.
 *
 * Auth (OAuth PKCE, token refresh, connect/disconnect) lives in
 * dropboxAuth.ts — this module just calls `refreshAccessToken()` before
 * every request. Browses real folder contents (`files/list_folder` (+
 * `/continue`) and a recursive folder-only tree for the sidebar), fetches
 * grid thumbnails (`files/get_thumbnail_batch`), and renames files for real
 * (`files/move_v2` — Dropbox has no separate rename endpoint; renaming in
 * place is a move to a new path in the same folder). No delete.
 */

// Re-exported so existing call sites (`import { DropboxServiceError } from
// "./dropboxService"`) keep working unchanged — the types/class now live in
// dropboxAuth.ts alongside the refresh logic that throws them.
export { DropboxServiceError };
export type { DropboxErrorKind };

const LIST_FOLDER_URL = "https://api.dropboxapi.com/2/files/list_folder";
const LIST_FOLDER_CONTINUE_URL = "https://api.dropboxapi.com/2/files/list_folder/continue";

// ---------------------------------------------------------------------------
// Folder listing
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "tiff",
  "tif",
  "gif",
  "webp",
  "bmp",
  "heic",
  "heif",
]);

function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
}

/**
 * Same as extensionOf but keeps the original casing, so a renamed file's
 * extension matches what was actually on disk (e.g. "IMG_1234.HEIC" renames
 * to "...00001.HEIC", not "...00001.heic"). Detection stays case-insensitive
 * via extensionOf; only the text embedded in the new filename preserves case.
 */
export function rawExtensionOf(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1) : "";
}

/** jpg, jpeg, png, tiff, tif, gif, webp, bmp, heic, heif. HEIC/HEIF thumbnails may fail to generate via Dropbox's API — that's handled per-file, not treated as unsupported. */
export function isSupportedImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(name));
}

interface RawDropboxEntry {
  ".tag": string;
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
}

function normalizeEntry(raw: RawDropboxEntry): DropboxEntry | null {
  if (raw[".tag"] === "folder") {
    const folder: DropboxFolderItem = {
      id: raw.id,
      name: raw.name,
      pathLower: raw.path_lower,
      pathDisplay: raw.path_display,
      type: "folder",
    };
    return folder;
  }
  if (raw[".tag"] === "file") {
    const file: DropboxFileItem = {
      id: raw.id,
      name: raw.name,
      pathLower: raw.path_lower,
      pathDisplay: raw.path_display,
      type: "file",
      extension: rawExtensionOf(raw.name),
      isImage: isSupportedImageFile(raw.name),
      size: raw.size,
      clientModified: raw.client_modified,
      serverModified: raw.server_modified,
    };
    return file;
  }
  // "deleted" entries (or any future tag we don't know about) are skipped.
  return null;
}

function sortEntries(entries: DropboxEntry[]): DropboxEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

async function safeFetch(makeRequest: () => Promise<Response>): Promise<Response> {
  try {
    return await makeRequest();
  } catch {
    throw new DropboxServiceError(
      "Could not reach Dropbox. Check your internet connection and try again.",
      "network",
    );
  }
}

/**
 * Runs an authenticated Dropbox API call, refreshing and retrying exactly
 * once if the access token turns out to be expired/invalid (HTTP 401).
 */
async function callWithTokenRetry(makeRequest: (accessToken: string) => Promise<Response>): Promise<Response> {
  const token = await refreshAccessToken();
  let response = await safeFetch(() => makeRequest(token));

  if (response.status === 401) {
    invalidateCachedAccessToken();
    const freshToken = await refreshAccessToken();
    response = await safeFetch(() => makeRequest(freshToken));
  }

  return response;
}

async function parseApiErrorSummary(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error_summary === "string") return body.error_summary;
  } catch {
    // response body wasn't JSON (or was empty) — fall through with no summary
  }
  return "";
}

/** Throws a friendly `DropboxServiceError` if `response` is not ok; no-op otherwise. */
async function throwIfApiError(response: Response): Promise<void> {
  if (response.ok) return;

  if (response.status === 401) {
    // Only reachable if the one retry in callWithTokenRetry also failed.
    throw new DropboxServiceError(
      "Dropbox rejected the access token. Try testing the connection again in Settings.",
      "invalid_token",
    );
  }

  const summary = await parseApiErrorSummary(response);

  if (summary.includes("not_found")) {
    throw new DropboxServiceError("That Dropbox folder could not be found.", "path_not_found");
  }
  if (summary.includes("no_permission") || summary.includes("disallowed_name") || response.status === 403) {
    throw new DropboxServiceError("You don't have access to that Dropbox folder.", "access_denied");
  }
  throw new DropboxServiceError("Dropbox returned an unexpected error. Please try again.", "unknown");
}

interface RawListFolderResponse {
  entries: RawDropboxEntry[];
  cursor: string;
  has_more: boolean;
}

/** Internal pagination helper — keep exported surface to `listFolder`. */
async function listFolderContinue(cursor: string): Promise<RawListFolderResponse> {
  const response = await callWithTokenRetry((token) =>
    fetch(LIST_FOLDER_CONTINUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursor }),
    }),
  );
  await throwIfApiError(response);
  return response.json();
}

/**
 * List the contents of a Dropbox folder (non-recursive), following
 * `has_more` pagination until the full listing is collected. Root is the
 * empty string `""` per Dropbox's API convention — the UI is responsible
 * for displaying that as "Dropbox".
 */
export async function listFolder(path: string): Promise<DropboxListFolderResult> {
  const normalizedPath = path === "/" ? "" : path;

  const firstResponse = await callWithTokenRetry((token) =>
    fetch(LIST_FOLDER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: normalizedPath,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      }),
    }),
  );
  await throwIfApiError(firstResponse);

  const firstPage = (await firstResponse.json()) as RawListFolderResponse;
  const rawEntries: RawDropboxEntry[] = [...firstPage.entries];

  let hasMore = firstPage.has_more;
  let cursor = firstPage.cursor;
  while (hasMore) {
    const page = await listFolderContinue(cursor);
    rawEntries.push(...page.entries);
    hasMore = page.has_more;
    cursor = page.cursor;
  }

  const entries = sortEntries(
    rawEntries.map(normalizeEntry).filter((entry): entry is DropboxEntry => entry !== null),
  );

  return { path: normalizedPath, entries };
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

const THUMBNAIL_BATCH_URL = "https://content.dropboxapi.com/2/files/get_thumbnail_batch";
/** Dropbox allows at most 25 entries per get_thumbnail_batch call. */
const THUMBNAIL_CHUNK_SIZE = 25;
/** Balances grid clarity against payload size — plenty for a photo tile, not a full preview. */
const THUMBNAIL_SIZE = "w256h256";
const THUMBNAIL_FORMAT = "jpeg";
const THUMBNAIL_MODE = "bestfit";

export type ThumbnailState = { status: "loading" } | { status: "ready"; src: string } | { status: "failed" };

/** file.id -> thumbnail outcome for that file. */
export type ThumbnailResultMap = Map<string, ThumbnailState>;

// In-memory only, per Phase 5 scope — never written to sqlite/sql.js. Keyed
// on id + serverModified so an edited/replaced file naturally misses the
// cache instead of showing a stale thumbnail; old entries for since-changed
// files are simply never looked up again (no active eviction needed for an
// in-memory, session-scoped cache).
const thumbnailCache = new Map<string, string>();

function thumbnailCacheKey(file: DropboxFileItem): string {
  return `${file.id}::${file.serverModified ?? file.clientModified ?? ""}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface RawThumbnailBatchEntry {
  ".tag": string;
  thumbnail?: string;
}

export interface GetThumbnailsResult {
  /** True if at least one whole batch request failed (auth/network) — worth a non-blocking warning. Per-file failures don't set this. */
  hadRequestFailure: boolean;
}

/**
 * Fetch thumbnails for the given (already-filtered-to-images) files via
 * Dropbox's batch endpoint, in chunks of `THUMBNAIL_CHUNK_SIZE`. Calls
 * `onBatch` with results as each chunk resolves (cached entries are
 * delivered synchronously as the first batch) so the UI can render
 * progressively instead of waiting for the whole folder.
 *
 * Never throws — a failed chunk (network/auth) marks that chunk's files as
 * `"failed"` and moves on to the next chunk rather than aborting the whole
 * folder's thumbnails.
 */
export async function getThumbnails(
  files: DropboxFileItem[],
  onBatch: (results: ThumbnailResultMap) => void,
  options: { signal?: AbortSignal } = {},
): Promise<GetThumbnailsResult> {
  const { signal } = options;
  const imageFiles = files.filter((f) => f.isImage);
  if (imageFiles.length === 0) return { hadRequestFailure: false };

  const cachedResults: ThumbnailResultMap = new Map();
  const uncached: DropboxFileItem[] = [];
  for (const file of imageFiles) {
    const cachedSrc = thumbnailCache.get(thumbnailCacheKey(file));
    if (cachedSrc) {
      cachedResults.set(file.id, { status: "ready", src: cachedSrc });
    } else {
      uncached.push(file);
    }
  }
  if (cachedResults.size > 0) onBatch(cachedResults);
  if (uncached.length === 0 || signal?.aborted) return { hadRequestFailure: false };

  let hadRequestFailure = false;

  for (const batch of chunk(uncached, THUMBNAIL_CHUNK_SIZE)) {
    if (signal?.aborted) break;

    let response: Response;
    try {
      response = await callWithTokenRetry((token) =>
        fetch(THUMBNAIL_BATCH_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal,
          body: JSON.stringify({
            entries: batch.map((file) => ({
              path: file.pathLower,
              format: THUMBNAIL_FORMAT,
              size: THUMBNAIL_SIZE,
              mode: THUMBNAIL_MODE,
            })),
          }),
        }),
      );
    } catch {
      if (signal?.aborted) break;
      hadRequestFailure = true;
      onBatch(new Map(batch.map((f) => [f.id, { status: "failed" as const }])));
      continue;
    }

    if (signal?.aborted) break;

    if (!response.ok) {
      hadRequestFailure = true;
      onBatch(new Map(batch.map((f) => [f.id, { status: "failed" as const }])));
      continue;
    }

    let data: { entries?: RawThumbnailBatchEntry[] };
    try {
      data = await response.json();
    } catch {
      hadRequestFailure = true;
      onBatch(new Map(batch.map((f) => [f.id, { status: "failed" as const }])));
      continue;
    }

    const results: ThumbnailResultMap = new Map();
    const rawEntries = data.entries ?? [];
    batch.forEach((file, index) => {
      const entry = rawEntries[index];
      if (entry?.[".tag"] === "success" && entry.thumbnail) {
        const src = `data:image/${THUMBNAIL_FORMAT};base64,${entry.thumbnail}`;
        thumbnailCache.set(thumbnailCacheKey(file), src);
        results.set(file.id, { status: "ready", src });
      } else {
        // Per-file failure (unsupported format, conversion error, etc.) —
        // not a request-level problem, so this doesn't set hadRequestFailure.
        results.set(file.id, { status: "failed" });
      }
    });
    onBatch(results);
  }

  return { hadRequestFailure };
}

// ---------------------------------------------------------------------------
// Recursive folder tree (sidebar) — folders only, no files, no thumbnails
// ---------------------------------------------------------------------------

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_FOLDERS = 2000;

export interface ListFolderTreeOptions {
  maxDepth?: number;
  maxFolders?: number;
  signal?: AbortSignal;
}

/**
 * Recursively builds a folder-only tree for the sidebar, starting at
 * `rootPath` ("" = Dropbox root). Reuses `listFolder` (so it inherits the
 * same auth-retry behavior) and simply discards the file entries it
 * returns — Dropbox's API has no "folders only" server-side filter, so this
 * is the only practical way to do it without a different, heavier endpoint.
 *
 * Siblings are fetched in parallel (one batch of concurrent requests per
 * tree level) rather than strictly sequentially, so a real account's tree
 * builds in a reasonable time instead of one folder at a time.
 *
 * Never throws: a folder that fails to list gets `error` set on its own
 * node (including the root, e.g. for missing/invalid credentials) and the
 * rest of the tree is unaffected. `maxDepth`/`maxFolders` stop the crawl
 * gracefully and mark the node where the cutoff happened as `isPartial`.
 */
export async function listFolderTree(
  rootPath: string = "",
  options: ListFolderTreeOptions = {},
): Promise<FolderTreeNode> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxFolders = options.maxFolders ?? DEFAULT_MAX_FOLDERS;
  const signal = options.signal;
  let folderCount = 0;

  async function buildNode(
    path: string,
    name: string,
    pathDisplay: string,
    depth: number,
  ): Promise<FolderTreeNode> {
    const node: FolderTreeNode = { name, pathDisplay, pathLower: path, children: [] };

    if (signal?.aborted) return node;

    if (depth >= maxDepth) {
      node.isPartial = true;
      return node;
    }

    let result: DropboxListFolderResult;
    try {
      result = await listFolder(path);
    } catch (err) {
      node.error = err instanceof DropboxServiceError ? err.message : "Couldn't load this folder.";
      return node;
    }

    if (signal?.aborted) return node;

    const childFolders = result.entries
      .filter((e): e is DropboxFolderItem => e.type === "folder")
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    const toVisit: DropboxFolderItem[] = [];
    for (const folder of childFolders) {
      if (folderCount >= maxFolders) {
        node.isPartial = true;
        break;
      }
      folderCount += 1;
      toVisit.push(folder);
    }

    node.children = await Promise.all(
      toVisit.map((folder) => buildNode(folder.pathLower, folder.name, folder.pathDisplay, depth + 1)),
    );

    return node;
  }

  return buildNode(rootPath, "Dropbox", rootPath, 0);
}

// ---------------------------------------------------------------------------
// Rename (real Dropbox move — Dropbox has no separate "rename" endpoint;
// renaming a file in place is a move to a new path within the same folder)
// ---------------------------------------------------------------------------

const MOVE_URL = "https://api.dropboxapi.com/2/files/move_v2";

export interface RenameFileOutcome {
  ok: boolean;
  error?: string;
}

/** Renames exactly one file by moving it to a new path in the same folder. Never throws. */
export async function renameFile(fromPath: string, toPath: string): Promise<RenameFileOutcome> {
  let response: Response;
  try {
    response = await callWithTokenRetry((token) =>
      fetch(MOVE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_path: fromPath,
          to_path: toPath,
          allow_shared_folder: false,
          autorename: false,
          allow_ownership_transfer: false,
        }),
      }),
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof DropboxServiceError ? err.message : "Could not reach Dropbox.",
    };
  }

  if (response.ok) return { ok: true };

  if (response.status === 401) {
    return { ok: false, error: "Dropbox rejected the access token." };
  }

  const summary = await parseApiErrorSummary(response);
  if (summary.includes("conflict")) {
    return { ok: false, error: "A file with that name already exists in this folder." };
  }
  if (summary.includes("not_found")) {
    return { ok: false, error: "The file could not be found — it may have moved or been deleted." };
  }
  if (summary.includes("insufficient_space")) {
    return { ok: false, error: "Not enough space in the Dropbox account." };
  }
  if (summary.includes("no_permission") || response.status === 403) {
    return { ok: false, error: "No permission to rename this file." };
  }
  return { ok: false, error: "Dropbox couldn't rename this file." };
}

export interface RenameOperation {
  /** Caller-supplied key (e.g. DropboxFileItem.id) to correlate a result back to its file. */
  key: string;
  fromPath: string;
  toPath: string;
}

export interface RenameOperationResult {
  key: string;
  ok: boolean;
  error?: string;
}

export interface RenameFilesResult {
  results: RenameOperationResult[];
  /** True if we never even attempted a file because we couldn't get an access token. */
  aborted: boolean;
  abortReason?: string;
}

/**
 * Renames files one at a time (sequential — real writes to the user's
 * Dropbox, so no bursty parallelism here), reporting each result via
 * `onProgress` as it completes so the UI can show live progress.
 *
 * Checks for a usable access token once up front: if credentials are
 * missing/invalid, the whole batch is aborted before touching any file
 * instead of failing every file individually with the same root cause.
 */
export async function renameFiles(
  operations: RenameOperation[],
  onProgress?: (result: RenameOperationResult) => void,
): Promise<RenameFilesResult> {
  if (operations.length === 0) return { results: [], aborted: false };

  try {
    await refreshAccessToken();
  } catch (err) {
    return {
      results: [],
      aborted: true,
      abortReason: err instanceof DropboxServiceError ? err.message : "Could not connect to Dropbox.",
    };
  }

  const results: RenameOperationResult[] = [];
  for (const op of operations) {
    const outcome = await renameFile(op.fromPath, op.toPath);
    const result: RenameOperationResult = { key: op.key, ok: outcome.ok, error: outcome.error };
    results.push(result);
    onProgress?.(result);
  }

  return { results, aborted: false };
}
