/** Photo grid/list view mode persistence — mirrors sidebarWidth.ts/photoZoom.ts. */

export type PhotoViewMode = "grid" | "list";

export const PHOTO_VIEW_MODE_STORAGE_KEY = "nlcPhotoRenamer.photoViewMode";
export const DEFAULT_PHOTO_VIEW_MODE: PhotoViewMode = "grid";

function isPhotoViewMode(value: string): value is PhotoViewMode {
  return value === "grid" || value === "list";
}

export function loadStoredPhotoViewMode(): PhotoViewMode {
  try {
    const raw = localStorage.getItem(PHOTO_VIEW_MODE_STORAGE_KEY);
    if (raw && isPhotoViewMode(raw)) return raw;
    return DEFAULT_PHOTO_VIEW_MODE;
  } catch {
    return DEFAULT_PHOTO_VIEW_MODE;
  }
}

export function savePhotoViewMode(mode: PhotoViewMode): void {
  try {
    localStorage.setItem(PHOTO_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // best-effort — a UI preference not persisting isn't worth surfacing an error for
  }
}

export function clearStoredPhotoViewMode(): void {
  try {
    localStorage.removeItem(PHOTO_VIEW_MODE_STORAGE_KEY);
  } catch {
    // best-effort
  }
}
