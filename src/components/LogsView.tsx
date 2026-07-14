import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import BatchList from "./BatchList";
import BatchDetail from "./BatchDetail";
import { getBatch, getBatchItems, listBatches } from "../services/logsRepository";
import type { BatchItemRecord, BatchRecord } from "../services/types";
import type { RenameProgress, RenameResult } from "./RenameActionBar";

interface LogsViewProps {
  onRequestUndo: (batch: BatchRecord, items: BatchItemRecord[]) => void;
  undoing: boolean;
  undoingBatchId: string | null;
  undoProgress: RenameProgress | null;
  undoResult: RenameResult | null;
}

export default function LogsView({
  onRequestUndo,
  undoing,
  undoingBatchId,
  undoProgress,
  undoResult,
}: LogsViewProps) {
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<BatchItemRecord[]>([]);
  const [undoOfBatch, setUndoOfBatch] = useState<BatchRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await listBatches();
      if (cancelled) return;
      setBatches(rows);
      setActiveId((current) => current ?? rows[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) {
      setActiveItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await getBatchItems(activeId);
      if (!cancelled) setActiveItems(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    const activeBatch = batches.find((b) => b.id === activeId) ?? null;
    if (!activeBatch || activeBatch.operationType !== "undo" || !activeBatch.undoOfBatchId) {
      setUndoOfBatch(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const original = await getBatch(activeBatch.undoOfBatchId!);
      if (!cancelled) setUndoOfBatch(original);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, batches]);

  const sortedBatches = useMemo(() => {
    return [...batches].sort((a, b) =>
      sortOrder === "newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
  }, [batches, sortOrder]);

  const activeBatch = batches.find((b) => b.id === activeId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-4">
      {/* No page title here — the breadcrumb ("Logs / Batch History") and
          the highlighted sidebar nav item already identify this view. */}
      {undoResult && (
        <div
          className={`mb-3 inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-xs font-medium ${
            undoResult.tone === "success"
              ? "bg-sage-100 text-forest-700"
              : undoResult.tone === "warning"
                ? "bg-gold-300/40 text-gold-600"
                : "bg-rose-100 text-rose-700"
          }`}
        >
          {undoResult.tone === "success" ? (
            <CheckCircle2 size={13} />
          ) : undoResult.tone === "warning" ? (
            <AlertTriangle size={13} />
          ) : (
            <XCircle size={13} />
          )}
          {undoResult.message}
        </div>
      )}

      {/* grid-rows-1 forces the single row to 1fr — without it, an implicit
          auto-sized row only grows to fit its content, so the detail panel
          doesn't stretch to fill the remaining page height. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-5 lg:grid-cols-[340px_1fr]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-900">Recent Batches</p>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              className="rounded-lg border border-beige-300 bg-cream-50 px-2 py-1 text-xs text-ink-700"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loading ? (
              <p className="px-1 py-4 text-sm text-ink-400">Loading…</p>
            ) : sortedBatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-beige-300 bg-beige-100/60 px-4 py-6 text-center text-sm text-ink-500">
                No rename batches yet. Rename some photos to see them here.
              </div>
            ) : (
              <BatchList batches={sortedBatches} activeId={activeId} onSelect={setActiveId} />
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          {activeBatch ? (
            <BatchDetail
              batch={activeBatch}
              items={activeItems}
              undoOfBatch={undoOfBatch}
              onRequestUndo={() => onRequestUndo(activeBatch, activeItems)}
              undoing={undoing}
              isUndoingThisBatch={undoing && undoingBatchId === activeBatch.id}
              undoProgress={undoProgress}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-beige-300 bg-beige-100/40 text-sm text-ink-400">
              Select a batch to see its details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
