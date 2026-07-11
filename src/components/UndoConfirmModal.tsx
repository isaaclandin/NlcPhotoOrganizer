import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Undo2, Folder, Clock, AlertTriangle, X } from "lucide-react";
import Button from "./Button";
import { formatBatchDate } from "../utils/formatDate";

export interface UndoReverseMove {
  fromName: string;
  toName: string;
}

interface UndoConfirmModalProps {
  isOpen: boolean;
  batchTimestamp: string;
  folderPath: string;
  count: number;
  reverseMoves: UndoReverseMove[];
  isUndoing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const PREVIEW_LIMIT = 5;

export default function UndoConfirmModal({
  isOpen,
  batchTimestamp,
  folderPath,
  count,
  reverseMoves,
  isUndoing,
  onCancel,
  onConfirm,
}: UndoConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isUndoing) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUndoing, onCancel]);

  if (!isOpen) return null;

  const visibleMoves = reverseMoves.slice(0, PREVIEW_LIMIT);
  const remaining = reverseMoves.length - visibleMoves.length;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!isUndoing) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="undo-confirm-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-beige-300/60 bg-cream-50 shadow-lifted"
      >
        <div className="flex items-start justify-between gap-3 border-b border-beige-300/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-100 text-forest-600">
              <Undo2 size={17} />
            </span>
            <div>
              <h2 id="undo-confirm-title" className="font-serif text-lg font-semibold text-forest-700">
                Undo this rename batch?
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">
                This will move the successfully renamed Dropbox files back to their original names.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isUndoing}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1 text-ink-400 hover:bg-beige-200 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-xl border border-beige-300/70 bg-beige-100 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-ink-700">
              <Clock size={14} className="shrink-0 text-sage-500" />
              <span>
                Renamed: <span className="font-medium text-ink-900">{formatBatchDate(batchTimestamp)}</span>
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-ink-700">
              <Folder size={14} className="shrink-0 text-gold-500" />
              <span className="truncate font-mono text-xs">{folderPath}</span>
            </div>
            <div className="mt-2 text-ink-700">
              <span className="font-medium text-ink-900">{count}</span> file{count === 1 ? "" : "s"} will be
              moved back to their original names.
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Reverse moves</p>
            <div className="rounded-xl border border-beige-300/70 bg-cream-100 px-4 py-3">
              <ul className="space-y-1 font-mono text-xs text-ink-700">
                {visibleMoves.map((move, index) => (
                  <li key={`${move.fromName}-${index}`} className="truncate">
                    {move.fromName} <span className="text-ink-400">→</span> {move.toName}
                  </li>
                ))}
              </ul>
              {remaining > 0 && <p className="mt-1.5 text-xs text-ink-400">+{remaining} more</p>}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold-400/50 bg-gold-300/20 px-3.5 py-2.5 text-xs text-gold-600">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Undo will fail for any file that was moved, deleted, or whose original filename is already taken.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-beige-300/60 bg-cream-100 px-5 py-3.5">
          <Button variant="secondary" onClick={onCancel} disabled={isUndoing}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Undo2 size={16} />} onClick={onConfirm} disabled={isUndoing}>
            Undo Rename
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
