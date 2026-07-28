export interface DropboxFolderItem {
  id: string;
  name: string;
  pathLower: string;
  pathDisplay: string;
  type: "folder";
}

export interface DropboxFileItem {
  id: string;
  name: string;
  pathLower: string;
  pathDisplay: string;
  type: "file";
  extension: string;
  isImage: boolean;
  size?: number;
  clientModified?: string;
  serverModified?: string;
}

export type DropboxEntry = DropboxFolderItem | DropboxFileItem;

export interface DropboxListFolderResult {
  /** The (normalized) path that was listed — "" means root. */
  path: string;
  entries: DropboxEntry[];
}

/**
 * "unknown" = this folder is known to exist (its parent's listing named it)
 * but its own children haven't been fetched yet — a stub, shown immediately
 * so the folder is navigable/expandable while the crawl catches up to it.
 * "loading" = its listFolder call is in flight right now.
 * "loaded" = `children` is accurate and complete for this node (deeper
 * descendants may still individually be "unknown"/"loading").
 * "error" = the fetch failed; see `error`/`errorStatus`/`errorSummary`.
 */
export type FolderChildrenStatus = "unknown" | "loading" | "loaded" | "error";

/** A folder-only node in the recursively-built sidebar tree. */
export interface FolderTreeNode {
  name: string;
  pathDisplay: string;
  pathLower: string;
  children: FolderTreeNode[];
  /** See FolderChildrenStatus. Undefined only for nodes built before this field existed (treat as "loaded"). */
  childrenStatus?: FolderChildrenStatus;
  /** True if this node's children were cut off by maxDepth/maxFolders. */
  isPartial?: boolean;
  /** Set if listing this node's children failed; the rest of the tree is unaffected. */
  error?: string;
  /** Raw HTTP status behind `error`, when available — debug/diagnostics only. */
  errorStatus?: number;
  /** Dropbox's own `error_summary` behind `error`, when available — debug/diagnostics only, never a token/header. */
  errorSummary?: string;
  /** True once a listFolder call was actually attempted for this node (false/undefined if the crawl stopped before reaching it, e.g. maxDepth). */
  fetchAttempted?: boolean;
  /**
   * Count of supported-image files directly inside this folder — for the
   * debug panel only. Never used to decide whether the node exists, is
   * rendered, or is recursed into; folder discovery is image-count-blind by
   * design (see listFolderTree in dropboxService.ts).
   */
  directImageCount?: number;
}
