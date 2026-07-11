import type { BatchStatus } from "../services/types";

const styles: Record<BatchStatus, string> = {
  Success: "bg-sage-100 text-forest-700 border border-sage-300/70",
  Partial: "bg-gold-300/40 text-gold-600 border border-gold-400/50",
  Failed: "bg-rose-100 text-rose-700 border border-rose-300/60",
};

export default function StatusBadge({ status }: { status: BatchStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}
