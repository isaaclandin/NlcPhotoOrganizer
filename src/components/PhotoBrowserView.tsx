import { useMemo } from "react";
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

interface PhotoBrowserViewProps {
  files: DropboxFileItem[];
  thumbnails: ThumbnailResultMap;
  thumbnailWarning: string | null;
  loading: boolean;
  error: DropboxLoadError | null;
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
  const allSelected = files.length > 0 && selectedIds.size === files.length;
  const noneSelected = selectedIds.size === 0;

  const selectionLabel = useMemo(() => {
    if (noneSelected) return "None selected";
    if (allSelected) return "All selected";
    return `${selectedIds.size} selected`;
  }, [selectedIds, noneSelected, allSelected]);

  if (error?.kind === "missing_credentials") {
    return (
      <DropboxStatePanel
        icon={CloudOff}
        heading="Connect Dropbox to start renaming"
        message="Add your Dropbox app key, app secret, and refresh token in Settings, then come back here."
        primaryLabel="Go to Settings"
        onPrimary={onGoToSettings}
      />
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
        </div>
      </div>

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
      ) : files.length === 0 ? (
        <DropboxStatePanel icon={ImageOff} heading="No photos in this folder" message="This folder doesn't contain any supported image files yet." />
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
