import { useState } from "react";
import type { ReactNode } from "react";
import {
  Folder,
  FileText,
  MapPin,
  Copy,
  Check,
  Download,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Undo2,
} from "lucide-react";
import Card from "./Card";
import Button from "./Button";
import StatusBadge from "./StatusBadge";
import type { BatchItemRecord, BatchRecord } from "../services/types";
import { formatBatchDate } from "../utils/formatDate";
import type { RenameProgress } from "./RenameActionBar";

interface BatchDetailProps {
  batch: BatchRecord;
  items: BatchItemRecord[];
  /** The original rename batch this undo batch reverses (only set when batch.operationType === "undo"). */
  undoOfBatch: BatchRecord | null;
  onRequestUndo: () => void;
  undoing: boolean;
  isUndoingThisBatch: boolean;
  undoProgress: RenameProgress | null;
}

export default function BatchDetail({
  batch,
  items,
  undoOfBatch,
  onRequestUndo,
  undoing,
  isUndoingThisBatch,
  undoProgress,
}: BatchDetailProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copied, setCopied] = useState(false);

  const successfulCount = items.filter((item) => item.result === "Success").length;
  // Eligible only for a rename batch, with at least one successful item, that
  // hasn't already been undone — undo batches themselves can never be undone.
  const canUndo = batch.operationType === "rename" && batch.undoStatus === "none" && successfulCount > 0;

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const rangeStart = items.length === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(items.length, clampedPage * pageSize);
  const rows = items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const handleCopyLog = async () => {
    const payload = JSON.stringify({ ...batch, items }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert("Could not copy to clipboard.");
    }
  };

  const handleExportLog = () => {
    const payload = JSON.stringify({ ...batch, items }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batch.name.replace(/\s+/g, "_")}_${batch.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" padded={false}>
      <div className="flex items-center justify-between gap-4 border-b border-beige-300/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-300/40">
            <Folder size={20} className="text-gold-600" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink-900">{batch.name}</h2>
              <StatusBadge status={batch.status} />
              {batch.operationType === "undo" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sage-300/70 bg-sage-100 px-2.5 py-1 text-xs font-semibold text-forest-700">
                  <Undo2 size={11} />
                  Undo batch
                </span>
              )}
              {batch.operationType === "rename" && batch.undoStatus === "complete" && (
                <span className="inline-flex items-center rounded-full border border-beige-300 bg-beige-200 px-2.5 py-1 text-xs font-semibold text-ink-600">
                  Undone
                </span>
              )}
              {batch.operationType === "rename" && batch.undoStatus === "partial" && (
                <span className="inline-flex items-center rounded-full border border-gold-400/50 bg-gold-300/30 px-2.5 py-1 text-xs font-semibold text-gold-600">
                  Partially undone
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500">Completed on {formatBatchDate(batch.createdAt)}</p>
            {batch.operationType === "undo" && (
              <p className="text-xs text-ink-500">
                Undo of:{" "}
                <span className="font-medium text-ink-700">
                  {undoOfBatch ? `${undoOfBatch.name} (${formatBatchDate(undoOfBatch.createdAt)})` : "original batch"}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canUndo &&
            (isUndoingThisBatch ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-beige-300 bg-cream-50 px-3.5 py-2 text-xs font-medium text-ink-500">
                Undoing {undoProgress?.done ?? 0} of {undoProgress?.total ?? successfulCount}…
              </span>
            ) : (
              <Button
                variant="secondary"
                icon={<Undo2 size={14} />}
                className="!px-3.5 !py-2 text-xs"
                onClick={onRequestUndo}
                disabled={undoing}
              >
                Undo Batch
              </Button>
            ))}
          <Button
            variant="secondary"
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
            className="!px-3.5 !py-2 text-xs"
            onClick={handleCopyLog}
          >
            {copied ? "Copied!" : "Copy Log"}
          </Button>
          <Button variant="secondary" icon={<Download size={14} />} className="!px-3.5 !py-2 text-xs" onClick={handleExportLog}>
            Export Log
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
        <StatTile icon={Folder} label="Folder Path" value={batch.folderPath} mono />
        <StatTile
          icon={FileText}
          label="Files Renamed"
          value={String(batch.fileCount)}
          caption={`of ${batch.fileCount} files`}
        />
        <StatTile
          icon={MapPin}
          label="Location"
          value={batch.location}
          caption={batch.locationGroup}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 pb-4 sm:grid-cols-3">
        <div className="rounded-xl border border-beige-300/70 bg-cream-50 p-3.5">
          <p className="mb-2 text-xs font-medium text-ink-500">Tags</p>
          {batch.tags.length === 0 ? (
            <p className="text-xs text-ink-400">No tags</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {batch.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-beige-300 bg-beige-100 px-2.5 py-1 text-xs text-ink-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <StatTile
          icon={FileText}
          label="Numbering Range"
          value={batch.numberingRange}
          caption="Sequence will increment"
          mono
        />
        <div className="rounded-xl border border-beige-300/70 bg-cream-50 p-3.5">
          <p className="mb-2 text-xs font-medium text-ink-500">Result</p>
          <div
            className={`flex items-center gap-1.5 text-sm font-semibold ${
              batch.status === "Failed" ? "text-rose-600" : "text-forest-600"
            }`}
          >
            {batch.status === "Failed" ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
            {batch.status}
          </div>
          <p className="mt-1 text-xs text-ink-400">
            {batch.status === "Success"
              ? "All files renamed"
              : batch.status === "Partial"
                ? "Some files could not be renamed"
                : "Batch failed to complete"}
          </p>
        </div>
      </div>

      <div className="min-w-0 border-t border-beige-300/60 px-5 pb-4 pt-4">
        <p className="mb-2 text-sm font-semibold text-ink-900">
          Rename Details ({batch.fileCount} files)
        </p>
        <div className="overflow-x-auto rounded-xl border border-beige-300/60">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-beige-200/80 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2 font-medium">Original Name</th>
                <th className="px-3 py-2 font-medium">New Name</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-300/50 bg-cream-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-ink-400">
                    No files in this batch.
                  </td>
                </tr>
              ) : (
                rows.map((file) => (
                  <tr key={file.id} className={file.result === "Failed" ? "bg-rose-50/60" : ""}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-700">
                      {file.originalName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-900">
                      {file.newName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          file.result === "Failed" ? "text-rose-600" : "text-forest-600"
                        }`}
                      >
                        {file.result === "Failed" ? (
                          <XCircle size={13} />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        {file.result}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-400">
                      {file.error ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between py-3 text-xs text-ink-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-beige-300 bg-cream-50 px-2 py-1 text-xs text-ink-700"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>per page</span>
          </div>
          <div className="flex items-center gap-1">
            <PageButton onClick={() => setPage(1)} disabled={clampedPage === 1}>
              <ChevronsLeft size={14} />
            </PageButton>
            <PageButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage === 1}>
              <ChevronLeft size={14} />
            </PageButton>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-forest-600 px-2 font-semibold text-cream-50">
              {clampedPage}
            </span>
            <PageButton
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage === totalPages}
            >
              <ChevronRight size={14} />
            </PageButton>
            <PageButton onClick={() => setPage(totalPages)} disabled={clampedPage === totalPages}>
              <ChevronsRight size={14} />
            </PageButton>
          </div>
          <span>
            {rangeStart}–{rangeEnd} of {items.length}
          </span>
        </div>
      </div>
    </Card>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  caption,
  mono,
}: {
  icon: typeof Folder;
  label: string;
  value: string;
  caption?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-beige-300/70 bg-cream-50 p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
        <Icon size={13} className="text-sage-500" />
        {label}
      </div>
      <p className={`truncate text-sm font-semibold text-ink-900 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
      {caption && <p className="mt-0.5 text-xs text-ink-400">{caption}</p>}
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-beige-300 bg-cream-50 text-ink-500 transition-colors hover:bg-beige-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
