import { useMemo, useState } from "react";
import {
  CheckSquare,
  Square,
  Minus,
  Plus,
  LayoutGrid,
  List,
  Check,
  BookOpen,
  Shirt,
  CalendarDays,
  Gift,
  User,
  HeartHandshake,
  Package,
  PawPrint,
  Tag as TagIcon,
  Image as ImageIcon,
  CloudOff,
  AlertTriangle,
  Loader2,
  ImageOff,
  FolderSearch,
  X,
  Bug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PhotoGrid from "./PhotoGrid";
import DropboxStatePanel from "./DropboxStatePanel";
import type { DropboxErrorKind } from "../services/dropboxService";
import type { ThumbnailResultMap } from "../services/dropboxService";
import type { DropboxFileItem } from "../services/dropboxTypes";

const KNOWN_TAG_ICONS: Record<string, LucideIcon> = {
  Animals: PawPrint,
  Books: BookOpen,
  Clothing: Shirt,
  Events: CalendarDays,
  Holiday: Gift,
  People: User,
  Program: HeartHandshake,
  Supplies: Package,
};

/** Custom/user-added tags fall back to a generic tag glyph. */
export function getTagIcon(label: string): LucideIcon {
  return KNOWN_TAG_ICONS[label] ?? TagIcon;
}

export const MIN_COLUMNS = 3;
export const MAX_COLUMNS = 8;

export interface DropboxLoadError {
  message: string;
  kind: DropboxErrorKind;
}

const CREDENTIAL_ERROR_KINDS: DropboxErrorKind[] = [
  "missing_credentials",
  "invalid_client",
  "invalid_refresh_token",
  "invalid_token",
];

/**
 * Safe-to-display folder-tree diagnostics for live troubleshooting (e.g. on
 * a deployed site, without devtools) — contains only path/count/boolean
 * info, never tokens, headers, or raw API payloads.
 */
export interface FolderDebugInfo {
  path: string;
  depth: number;
  childFolderCount: number;
  hasDirectImages: boolean;
  hasChildFolders: boolean;
  treeLoading: boolean;
  limitHit: boolean;
  nodeError: string | null;
  /** Size of the sidebar's expandedPaths set — should stay small (root + a
   * few ancestor chains), not track every folder the recursive crawl found. */
  expandedPathCount: number;
  /** Total folders discovered anywhere in the tree, for comparison against expandedPathCount. */
  totalFolderCount: number;
  /** True if every discovered folder is currently expanded — a red flag (the exact bug this panel exists to catch), not expected in normal use. */
  allExpanded: boolean;
}

interface PhotoBrowserViewProps {
  files: DropboxFileItem[];
  thumbnails: ThumbnailResultMap;
  thumbnailWarning: string | null;
  loading: boolean;
  error: DropboxLoadError | null;
  /** True when the currently open folder is Dropbox root — changes the empty-state copy. */
  isRoot: boolean;
  /** True if the current folder contains subfolders — distinguishes "no photos here yet, keep browsing" from "genuinely empty." */
  hasSubfolders: boolean;
  debugInfo: FolderDebugInfo;
  /** Non-blocking notice shown once if the saved startup folder couldn't be opened. */
  startupWarning: string | null;
  onDismissStartupWarning: () => void;
  selectedIds: Set<string>;
  onTogglePhoto: (id: string) => void;
  onToggleSelectAll: () => void;
  columns: number;
  onColumnsChange: (columns: number) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onGoToSettings: () => void;
  onRetry: () => void;
  onGoToRoot: () => void;
}

export default function PhotoBrowserView({
  files,
  thumbnails,
  thumbnailWarning,
  loading,
  error,
  isRoot,
  hasSubfolders,
  debugInfo,
  startupWarning,
  onDismissStartupWarning,
  selectedIds,
  onTogglePhoto,
  onToggleSelectAll,
  columns,
  onColumnsChange,
  viewMode,
  onViewModeChange,
  onGoToSettings,
  onRetry,
  onGoToRoot,
}: PhotoBrowserViewProps) {
  const [showDebug, setShowDebug] = useState(false);
  const allSelected = files.length > 0 && selectedIds.size === files.length;
  const noneSelected = selectedIds.size === 0;

  const selectionLabel = useMemo(() => {
    if (noneSelected) return "None selected";
    if (allSelected) return "All selected";
    return `${selectedIds.size} selected`;
  }, [selectedIds, noneSelected, allSelected]);

  // Shared so it's visible regardless of which state panel/content is
  // showing below it — including the missing-credentials early return,
  // which is exactly when a failed-connection-attempt message matters most.
  const startupWarningBanner = startupWarning && (
    <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-gold-400/50 bg-gold-300/20 px-3.5 py-2.5 text-xs text-gold-600">
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">{startupWarning}</span>
      <button
        type="button"
        onClick={onDismissStartupWarning}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-0.5 text-gold-600/70 hover:bg-gold-300/40 hover:text-gold-600"
      >
        <X size={13} />
      </button>
    </div>
  );

  if (error?.kind === "missing_credentials") {
    return (
      <>
        {startupWarningBanner}
        <DropboxStatePanel
          icon={CloudOff}
          heading="Connect Dropbox to start renaming"
          message="Connect your Dropbox account in Settings, then come back here."
          primaryLabel="Go to Settings"
          onPrimary={onGoToSettings}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-beige-300/60 px-6 py-4">
        <button
          type="button"
          onClick={onToggleSelectAll}
          disabled={files.length === 0}
          className="flex items-center gap-2 text-sm font-medium text-ink-700 disabled:opacity-50"
        >
          {allSelected ? (
            <CheckSquare size={18} className="text-forest-600" />
          ) : noneSelected ? (
            <Square size={18} className="text-ink-400" />
          ) : (
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-forest-600">
              <Check size={12} className="text-cream-50" strokeWidth={3} />
            </span>
          )}
          {selectionLabel}
        </button>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => onColumnsChange(Math.min(MAX_COLUMNS, columns + 1))}
              className="text-ink-400 hover:text-ink-700"
            >
              <Minus size={16} />
            </button>
            <input
              type="range"
              min={MIN_COLUMNS}
              max={MAX_COLUMNS}
              value={MAX_COLUMNS + MIN_COLUMNS - columns}
              onChange={(e) =>
                onColumnsChange(MAX_COLUMNS + MIN_COLUMNS - Number(e.target.value))
              }
              className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-beige-300 accent-forest-600"
            />
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => onColumnsChange(Math.max(MIN_COLUMNS, columns - 1))}
              className="text-ink-400 hover:text-ink-700"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-beige-300 bg-cream-50 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              aria-label="Grid view"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-forest-600 text-cream-50" : "text-ink-500 hover:bg-beige-200"
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              aria-label="List view"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                viewMode === "list" ? "bg-forest-600 text-cream-50" : "text-ink-500 hover:bg-beige-200"
              }`}
            >
              <List size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            aria-label="Toggle folder debug info"
            aria-pressed={showDebug}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
              showDebug
                ? "border-forest-700/40 bg-forest-600 text-cream-50"
                : "border-beige-300 bg-cream-50 text-ink-400 hover:text-ink-700"
            }`}
          >
            <Bug size={15} />
          </button>
        </div>
      </div>

      {showDebug && (
        <div className="mx-6 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-beige-300/70 bg-beige-100 px-3.5 py-2 font-mono text-[11px] text-ink-600">
          <span>
            path=<span className="text-forest-700">{debugInfo.path}</span>
          </span>
          <span>depth={debugInfo.depth}</span>
          <span>childFolders={debugInfo.childFolderCount}</span>
          <span>hasDirectImages={String(debugInfo.hasDirectImages)}</span>
          <span>hasChildFolders={String(debugInfo.hasChildFolders)}</span>
          <span>treeLoading={String(debugInfo.treeLoading)}</span>
          <span className={debugInfo.limitHit ? "font-semibold text-gold-600" : undefined}>
            limitHit={String(debugInfo.limitHit)}
          </span>
          <span>
            expandedPaths={debugInfo.expandedPathCount}/{debugInfo.totalFolderCount}
          </span>
          <span className={debugInfo.allExpanded ? "font-semibold text-rose-600" : undefined}>
            allExpanded={String(debugInfo.allExpanded)}
          </span>
          {debugInfo.nodeError && <span className="font-semibold text-rose-600">error={debugInfo.nodeError}</span>}
        </div>
      )}

      {startupWarningBanner}

      {loading ? (
        <DropboxStatePanel icon={Loader2} spin heading="Loading folder…" />
      ) : error ? (
        <DropboxStatePanel
          icon={AlertTriangle}
          tone="error"
          heading="Couldn't load this folder"
          message={error.message}
          primaryLabel="Try Again"
          onPrimary={onRetry}
          secondaryLabel={
            CREDENTIAL_ERROR_KINDS.includes(error.kind)
              ? "Go to Settings"
              : error.kind === "path_not_found"
                ? "Go to Dropbox Root"
                : undefined
          }
          onSecondary={CREDENTIAL_ERROR_KINDS.includes(error.kind) ? onGoToSettings : onGoToRoot}
        />
      ) : files.length === 0 && isRoot ? (
        <DropboxStatePanel
          icon={FolderSearch}
          heading="Choose a photo folder"
          message="Select a Dropbox folder from the sidebar to view and rename photos. You can set a startup folder in Settings."
        />
      ) : files.length === 0 && hasSubfolders ? (
        <DropboxStatePanel
          icon={FolderSearch}
          heading="No photos directly in this folder"
          message="Choose a subfolder from the sidebar to view its photos."
        />
      ) : files.length === 0 ? (
        <DropboxStatePanel icon={ImageOff} heading="No supported photos found in this folder" message="This folder doesn't contain any supported image files." />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {thumbnailWarning && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-gold-400/50 bg-gold-300/20 px-3.5 py-2.5 text-xs text-gold-600">
              <AlertTriangle size={14} className="shrink-0" />
              {thumbnailWarning}
            </div>
          )}
          {viewMode === "grid" ? (
            <PhotoGrid
              photos={files}
              thumbnails={thumbnails}
              selectedIds={selectedIds}
              onToggle={onTogglePhoto}
              columns={columns}
            />
          ) : (
            <div className="flex flex-col divide-y divide-beige-300/60 overflow-hidden rounded-2xl border border-beige-300/60 bg-beige-100">
              {files.map((photo) => {
                const isSelected = selectedIds.has(photo.id);
                const thumb = thumbnails.get(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onTogglePhoto(photo.id)}
                    className={`flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                      isSelected ? "bg-sage-100" : "hover:bg-cream-100"
                    }`}
                  >
                    {thumb?.status === "ready" ? (
                      <img
                        src={thumb.src}
                        alt={photo.name}
                        draggable={false}
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sage-100 via-cream-100 to-beige-200">
                        {thumb?.status === "loading" ? (
                          <div className="h-full w-full animate-pulse rounded-xl bg-beige-200/70" />
                        ) : (
                          <ImageIcon size={18} className="text-sage-400/80" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{photo.name}</p>
                    </div>
                    {isSelected ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-600">
                        <Check size={14} className="text-cream-50" strokeWidth={3} />
                      </span>
                    ) : (
                      <Square size={18} className="shrink-0 text-ink-300" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
