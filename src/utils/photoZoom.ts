/** Pure grid-columns (photo zoom) persistence — mirrors sidebarWidth.ts.
 * Columns is a purely local UI preference, so it's stored the same way:
 * localStorage, not the Dropbox-backed settings layer. */
import { MIN_COLUMNS, MAX_COLUMNS } from "../components/PhotoBrowserView";

export const PHOTO_ZOOM_STORAGE_KEY = "dropboxPhotoGridColumns";
/** MAX_COLUMNS = the most columns = the smallest thumbnails = the most
 * photos visible at once — the "smallest zoom" default for a fresh user. */
export const DEFAULT_PHOTO_GRID_COLUMNS = MAX_COLUMNS;

export function clampPhotoGridColumns(columns: number): number {
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, columns));
}

export function loadStoredPhotoGridColumns(): number {
  try {
    const raw = localStorage.getItem(PHOTO_ZOOM_STORAGE_KEY);
    if (!raw) return DEFAULT_PHOTO_GRID_COLUMNS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_PHOTO_GRID_COLUMNS;
    return clampPhotoGridColumns(parsed);
  } catch {
    return DEFAULT_PHOTO_GRID_COLUMNS;
  }
}

export function savePhotoGridColumns(columns: number): void {
  try {
    localStorage.setItem(PHOTO_ZOOM_STORAGE_KEY, String(Math.round(columns)));
  } catch {
    // best-effort — a UI preference not persisting isn't worth surfacing an error for
  }
}
