import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Folder, MapPin, Tag as TagIcon, X } from "lucide-react";
import Button from "./Button";
import DuckLogo from "./DuckLogo";

interface RenameConfirmModalProps {
  isOpen: boolean;
  count: number;
  folderPath: string;
  location: string;
  tags: string[];
  plannedFilenames: string[];
  isRenaming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const PREVIEW_LIMIT = 5;

export default function RenameConfirmModal({
  isOpen,
  count,
  folderPath,
  location,
  tags,
  plannedFilenames,
  isRenaming,
  onCancel,
  onConfirm,
}: RenameConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRenaming) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isRenaming, onCancel]);

  if (!isOpen) return null;

  const visibleNames = plannedFilenames.slice(0, PREVIEW_LIMIT);
  const remaining = plannedFilenames.length - visibleNames.length;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!isRenaming) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-confirm-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-beige-300/60 bg-cream-50 shadow-lifted"
      >
        <div className="flex items-start justify-between gap-3 border-b border-beige-300/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-100 text-forest-600">
              <AlertTriangle size={17} />
            </span>
            <div>
              <h2 id="rename-confirm-title" className="font-serif text-lg font-semibold text-forest-700">
                Rename {count} photo{count === 1 ? "" : "s"}?
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">This will rename the selected files in Dropbox.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isRenaming}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-ink-400 hover:bg-beige-200 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-xl border border-beige-300/70 bg-beige-100 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-ink-700">
              <Folder size={14} className="shrink-0 text-gold-500" />
              <span className="truncate font-mono text-xs">{folderPath}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-ink-700">
              <MapPin size={14} className="shrink-0 text-sage-500" />
              <span>
                Location: <span className="font-medium text-ink-900">{location}</span>
              </span>
            </div>
            <div className="mt-2 flex items-start gap-2 text-ink-700">
              <TagIcon size={14} className="mt-0.5 shrink-0 text-sage-500" />
              <span>
                Tags:{" "}
                <span className="font-medium text-ink-900">{tags.length > 0 ? tags.join(", ") : "None"}</span>
              </span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Planned file names</p>
            <div className="rounded-xl border border-beige-300/70 bg-cream-100 px-4 py-3">
              <ul className="space-y-1 font-mono text-xs text-ink-700">
                {visibleNames.map((name) => (
                  <li key={name} className="truncate">
                    {name}
                  </li>
                ))}
              </ul>
              {remaining > 0 && <p className="mt-1.5 text-xs text-ink-400">+{remaining} more</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-beige-300/60 bg-cream-100 px-5 py-3.5">
          <Button variant="secondary" onClick={onCancel} disabled={isRenaming}>
            Cancel
          </Button>
          <Button variant="primary" icon={<DuckLogo size={16} />} onClick={onConfirm} disabled={isRenaming}>
            Rename Photos
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
