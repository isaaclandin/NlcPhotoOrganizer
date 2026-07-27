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

/** A folder-only node in the recursively-built sidebar tree. */
export interface FolderTreeNode {
  name: string;
  pathDisplay: string;
  pathLower: string;
  children: FolderTreeNode[];
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
