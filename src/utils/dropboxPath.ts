/**
 * Small helpers for turning a Dropbox path ("" = root, otherwise something
 * like "/NLC/Marketing/Photos") into breadcrumb segments and back.
 */

function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/** ["Dropbox", "NLC", "Marketing", "Photos"] for path "/NLC/Marketing/Photos". */
export function breadcrumbSegments(path: string): string[] {
  return ["Dropbox", ...splitPath(path)];
}

/** Given a clicked breadcrumb index (0 = "Dropbox"), the path to navigate to. */
export function pathForBreadcrumbIndex(path: string, index: number): string {
  if (index <= 0) return "";
  return "/" + splitPath(path).slice(0, index).join("/");
}

/** Display name for the current folder — the last path segment, or "Dropbox" at root. */
export function folderNameFromPath(path: string): string {
  const parts = splitPath(path);
  return parts.length > 0 ? parts[parts.length - 1] : "Dropbox";
}

/**
 * Every path from root down to (and including) `path` itself:
 * "/nlc/marketing" -> ["", "/nlc", "/nlc/marketing"]. Used to auto-expand
 * the sidebar tree down to whatever folder is currently open.
 */
export function ancestorDropboxPaths(path: string): string[] {
  const parts = splitPath(path);
  const result = [""];
  let acc = "";
  for (const part of parts) {
    acc = `${acc}/${part}`;
    result.push(acc);
  }
  return result;
}
