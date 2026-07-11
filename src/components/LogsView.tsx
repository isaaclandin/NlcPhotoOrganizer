import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Download, Leaf } from "lucide-react";
import Button from "./Button";
import BatchList from "./BatchList";
import BatchDetail from "./BatchDetail";
import { getBatchItems, listBatches } from "../services/logsRepository";
import type { BatchItemRecord, BatchRecord } from "../services/types";

export default function LogsView() {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<BatchItemRecord[]>([]);
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

  const filteredBatches = useMemo(() => {
    let rows = batches;
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((b) => b.name.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) =>
      sortOrder === "newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
    return rows;
  }, [batches, query, sortOrder]);

  const activeBatch = batches.find((b) => b.id === activeId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-xl font-semibold text-forest-700">
            Batch History
            <Leaf size={16} className="text-sage-400" />
          </h1>
          <p className="mt-0.5 text-sm text-ink-500">
            Review your rename activity and download logs.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-beige-300 bg-cream-50 px-3.5 py-2.5">
            <Search size={15} className="text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search batches..."
              className="w-40 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
            />
          </div>
          <Button variant="secondary" icon={<SlidersHorizontal size={15} />} disabled>
            Filter
          </Button>
          <Button variant="secondary" icon={<Download size={15} />} disabled>
            Export Logs
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
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
            ) : filteredBatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-beige-300 bg-beige-100/60 px-4 py-6 text-center text-sm text-ink-500">
                {batches.length === 0
                  ? "No rename batches yet. Rename some photos to see them here."
                  : "No batches match your search."}
              </div>
            ) : (
              <BatchList batches={filteredBatches} activeId={activeId} onSelect={setActiveId} />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          {activeBatch ? (
            <BatchDetail batch={activeBatch} items={activeItems} />
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
