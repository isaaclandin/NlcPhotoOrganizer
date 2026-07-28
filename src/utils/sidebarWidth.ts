/** Pure width math + persistence for the resizable folder sidebar — kept
 * framework-free so it's easy to reason about/reuse from both App.tsx
 * (initial load, persistence) and AppShell.tsx (drag clamping). */

export const SIDEBAR_WIDTH_STORAGE_KEY = "dropboxFolderSidebarWidth";
export const DEFAULT_SIDEBAR_WIDTH = 300;
export const MIN_SIDEBAR_WIDTH = 220;
export const MAX_SIDEBAR_WIDTH_PX = 520;
/** Upper bound also never exceeds this fraction of the viewport width, so the
 * sidebar can't crowd out the photo grid on a narrower browser window. */
const MAX_SIDEBAR_WIDTH_VIEWPORT_RATIO = 0.42;

export function getMaxSidebarWidth(): number {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : MAX_SIDEBAR_WIDTH_PX;
  return Math.min(MAX_SIDEBAR_WIDTH_PX, viewportWidth * MAX_SIDEBAR_WIDTH_VIEWPORT_RATIO);
}

export function clampSidebarWidth(width: number): number {
  // On a very narrow viewport the vw-based cap can dip below MIN — MIN wins
  // so the sidebar never gets clamped to something smaller than usable.
  const max = Math.max(MIN_SIDEBAR_WIDTH, getMaxSidebarWidth());
  return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), max);
}

export function loadStoredSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!raw) return DEFAULT_SIDEBAR_WIDTH;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_SIDEBAR_WIDTH;
    return clampSidebarWidth(parsed);
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

export function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    // best-effort — a UI preference not persisting isn't worth surfacing an error for
  }
}
