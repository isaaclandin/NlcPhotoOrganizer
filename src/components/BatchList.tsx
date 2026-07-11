import { Folder, Tag } from "lucide-react";
import StatusBadge from "./StatusBadge";
import type { BatchRecord } from "../services/types";
import { formatBatchDate } from "../utils/formatDate";

interface BatchListProps {
  batches: BatchRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export default function BatchList({ batches, activeId, onSelect }: BatchListProps) {
  return (
    <div className="flex flex-col gap-2">
      {batches.map((batch) => {
        const isActive = batch.id === activeId;
        return (
          <button
            key={batch.id}
            type="button"
            onClick={() => onSelect(batch.id)}
            className={`rounded-2xl border px-4 py-3.5 text-left transition-colors duration-100 ${
              isActive
                ? "border-forest-600/50 bg-sage-100 shadow-soft"
                : "border-beige-300/70 bg-beige-100 hover:border-sage-300"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-ink-900">{batch.name}</span>
              <StatusBadge status={batch.status} />
            </div>
            <p className="mt-1 text-xs text-ink-500">{formatBatchDate(batch.createdAt)}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
              <Folder size={13} className="text-gold-500" />
              <span>{batch.folderName}</span>
              <span className="text-ink-300">·</span>
              <span>{batch.fileCount} files</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-400">
              <Tag size={12} />
              <span>{batch.tags.length} tags</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
