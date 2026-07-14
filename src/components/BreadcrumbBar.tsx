import { ChevronRight, Box, MoreHorizontal } from "lucide-react";

interface BreadcrumbBarProps {
  items: string[];
  onNavigate?: (index: number) => void;
}

/** Segments beyond this count collapse the middle into "…" so root and the
 * active (last) folder stay visible without scrolling — full paths up to
 * this length (4 nested levels: Dropbox + 4) still show in full. */
const COLLAPSE_THRESHOLD = 5;
/** How many trailing segments (including the active one) stay visible when collapsed. */
const VISIBLE_TAIL = 2;

type BreadcrumbEntry = { kind: "item"; item: string; index: number } | { kind: "collapsed" };

function visibleEntries(items: string[]): BreadcrumbEntry[] {
  if (items.length <= COLLAPSE_THRESHOLD) {
    return items.map((item, index) => ({ kind: "item", item, index }));
  }
  const tailStart = items.length - VISIBLE_TAIL;
  return [
    { kind: "item", item: items[0], index: 0 },
    { kind: "collapsed" },
    ...items.slice(tailStart).map((item, i): BreadcrumbEntry => ({ kind: "item", item, index: tailStart + i })),
  ];
}

export default function BreadcrumbBar({ items, onNavigate }: BreadcrumbBarProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-full border border-beige-300/70 bg-beige-100 px-4 py-2.5 text-sm text-ink-500">
      <Box size={16} className="shrink-0 text-sage-500" />
      {visibleEntries(items).map((entry, i) => {
        if (entry.kind === "collapsed") {
          return (
            <span key={`collapsed-${i}`} className="flex shrink-0 items-center gap-2">
              <span className="flex items-center text-ink-400" title="More folders in this path">
                <MoreHorizontal size={14} />
              </span>
              <ChevronRight size={14} className="text-ink-400" />
            </span>
          );
        }
        const isLast = entry.index === items.length - 1;
        return (
          <span key={`${entry.item}-${entry.index}`} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.(entry.index)}
              className={`whitespace-nowrap transition-colors hover:text-forest-700 ${
                isLast ? "font-semibold text-forest-700" : "text-ink-500"
              }`}
            >
              {entry.item}
            </button>
            {!isLast && <ChevronRight size={14} className="text-ink-400" />}
          </span>
        );
      })}
    </div>
  );
}
