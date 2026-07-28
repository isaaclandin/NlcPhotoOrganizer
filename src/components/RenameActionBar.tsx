import { Trash2, Sparkles, Loader2, CheckCircle2, AlertTriangle, FilePenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Pill from "./Pill";
import Button from "./Button";
import { buildRenamePattern, formatSequence } from "../utils/naming";
import miniDuckPreviewReference from "../assets/design/processed/mini_duck_preview_reference.png";

export interface TagOption {
  label: string;
  icon: LucideIcon;
}

export interface RenameProgress {
  done: number;
  total: number;
}

export interface RenameResult {
  tone: "success" | "warning" | "error";
  message: string;
}

interface RenameActionBarProps {
  locations: string[];
  selectedLocation: string;
  onSelectLocation: (location: string) => void;
  tagOptions: TagOption[];
  selectedTags: string[];
  onToggleTag: (label: string) => void;
  prefix: string;
  numberWidth: number;
  previewSequence: number;
  selectedCount: number;
  renaming: boolean;
  renameProgress: RenameProgress | null;
  renameResult: RenameResult | null;
  onClearSelection: () => void;
  onRename: () => void;
}

const RESULT_STYLES: Record<RenameResult["tone"], { wrap: string; icon: LucideIcon }> = {
  success: { wrap: "text-forest-600", icon: CheckCircle2 },
  warning: { wrap: "text-gold-600", icon: AlertTriangle },
  error: { wrap: "text-rose-600", icon: AlertTriangle },
};

export default function RenameActionBar({
  locations,
  selectedLocation,
  onSelectLocation,
  tagOptions,
  selectedTags,
  onToggleTag,
  prefix,
  numberWidth,
  previewSequence,
  selectedCount,
  renaming,
  renameProgress,
  renameResult,
  onClearSelection,
  onRename,
}: RenameActionBarProps) {
  const parts = buildRenamePattern({ prefix, location: selectedLocation, tags: selectedTags });
  const sequence = formatSequence(previewSequence, numberWidth);
  const resultStyle = renameResult ? RESULT_STYLES[renameResult.tone] : null;
  const ResultIcon = resultStyle?.icon;

  return (
    <div className="border-t border-beige-300/60 bg-beige-100">
      <div className="grid grid-cols-1 gap-4 px-4 py-1 md:grid-cols-3">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-sm font-semibold text-ink-900">Location</span>
            <span className="text-xs text-ink-400">(required)</span>
          </div>
          {/* flex-wrap + gap (not justify-between/fixed widths) so this stays
              balanced for any number/length of locations — each pill sizes
              to its own label and wraps to a new row rather than squeezing
              or overflowing. rounded-2xl on the container (not rounded-full)
              so it still looks intentional once it wraps past one row. */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-beige-300 bg-cream-50 p-1.5">
            {locations.map((location) => {
              const isSelected = location === selectedLocation;
              return (
                <button
                  key={location}
                  type="button"
                  onClick={() => onSelectLocation(location)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    isSelected
                      ? "bg-forest-600 text-cream-50 shadow-soft"
                      : "text-ink-700 hover:bg-sage-100"
                  }`}
                >
                  {location}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
            <Sparkles size={12} className="shrink-0 text-gold-500" />
            Tip: Use tags to keep your photos easy to find later.
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-sm font-semibold text-ink-900">Tags</span>
            <span className="text-xs text-ink-400">(optional)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {tagOptions.map((tag) => (
              <Pill
                key={tag.label}
                label={tag.label}
                icon={tag.icon}
                selected={selectedTags.includes(tag.label)}
                removable
                onClick={() => onToggleTag(tag.label)}
                onRemove={() => onToggleTag(tag.label)}
              />
            ))}
          </div>
        </div>

        <div className="relative">
          <span className="mb-1.5 block text-sm font-semibold text-ink-900">Rename Preview</span>
          <div className="rounded-xl border border-sage-300/70 bg-sage-50 px-3.5 py-2.5 pr-12 shadow-soft">
            <p className="truncate font-mono text-[15px] leading-snug">
              <span className="font-bold text-forest-700">{parts.join("_")}_</span>
              <span className="font-bold text-gold-600">{sequence}</span>
              <span className="text-ink-400">.jpg</span>
            </p>
          </div>
          <p className="mt-1 text-xs text-ink-400">Sequence will increment for each photo.</p>
          <img
            src={miniDuckPreviewReference}
            alt=""
            role="presentation"
            draggable={false}
            className="pointer-events-none absolute -bottom-2 -right-1 h-auto w-14 select-none object-contain drop-shadow-md"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-beige-300/60 bg-cream-100 px-4 py-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-[20px]">
          {resultStyle && ResultIcon && (
            <div className={`flex items-center gap-2 text-xs font-medium ${resultStyle.wrap}`}>
              <ResultIcon size={14} className="shrink-0" />
              <span>{renameResult!.message}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            icon={<Trash2 size={15} />}
            onClick={onClearSelection}
            disabled={renaming}
            className="!px-3.5 !py-2"
          >
            Clear Selection
          </Button>
          <Button
            variant="primary"
            icon={renaming ? <Loader2 size={16} className="animate-spin" /> : <FilePenLine size={16} />}
            onClick={onRename}
            disabled={selectedCount === 0 || !selectedLocation || renaming}
            className="!px-3.5 !py-2 !font-semibold active:!bg-forest-800"
          >
            {renaming
              ? `Renaming ${renameProgress?.done ?? 0} of ${renameProgress?.total ?? selectedCount}…`
              : `Rename ${selectedCount} Photo${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
