import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, Box, MoreHorizontal } from "lucide-react";

interface BreadcrumbBarProps {
  items: string[];
  onNavigate?: (index: number) => void;
}

type BreadcrumbEntry = { kind: "item"; item: string; index: number } | { kind: "collapsed" };

/** Root is always shown; `tailCount` trailing segments (always ending at the
 * active/current folder) are shown after it. Everything else collapses into
 * a single "…" chip. When `tailCount` covers everything after root, nothing
 * is actually hidden, so no "…" chip is rendered at all. */
function visibleEntries(items: string[], tailCount: number): BreadcrumbEntry[] {
  if (items.length === 0) return [];
  if (tailCount >= items.length - 1) {
    return items.map((item, index) => ({ kind: "item", item, index }));
  }
  const tailStart = items.length - tailCount;
  return [
    { kind: "item", item: items[0], index: 0 },
    { kind: "collapsed" },
    ...items.slice(tailStart).map((item, i): BreadcrumbEntry => ({ kind: "item", item, index: tailStart + i })),
  ];
}

/**
 * Breadcrumb pill that only collapses middle segments into "…" when the
 * available header width actually requires it, instead of at a fixed
 * segment count. Root and the active (current) folder are always shown;
 * segments are added back in from the tail (working toward root) for as
 * long as they still fit.
 *
 * A hidden, identically-styled copy of every segment/chip is measured via
 * refs (position: absolute, so it never affects visible layout). Combined
 * with the real container's measured content width and the flex row's own
 * gap, that's enough to compute — without any extra render passes — the
 * largest trailing window of segments that fits.
 */
export default function BreadcrumbBar({ items, onNavigate }: BreadcrumbBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ellipsisRef = useRef<HTMLSpanElement>(null);
  // Defaults to "show everything" so a path that already fits never
  // flickers through a collapsed state first — useLayoutEffect corrects
  // this (if needed) before the browser paints.
  const [tailCount, setTailCount] = useState(() => Math.max(items.length - 1, 0));

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    const measure = () => {
      const style = getComputedStyle(container);
      const paddingX = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
      const availableWidth = container.clientWidth - paddingX;
      const gap = parseFloat(style.columnGap || style.gap || "0") || 0;

      const iconWidth = iconRef.current?.offsetWidth ?? 0;
      const itemWidths = items.map((_, i) => itemRefs.current[i]?.offsetWidth ?? 0);
      const ellipsisWidth = ellipsisRef.current?.offsetWidth ?? 0;

      const widthFor = (tail: number, withEllipsis: boolean) => {
        const shownItemCount = withEllipsis ? 1 + tail : items.length;
        const childCount = 1 /* icon */ + shownItemCount + (withEllipsis ? 1 : 0);
        const itemsWidth = withEllipsis
          ? itemWidths[0] + itemWidths.slice(items.length - tail).reduce((a, b) => a + b, 0)
          : itemWidths.reduce((a, b) => a + b, 0);
        return iconWidth + itemsWidth + (withEllipsis ? ellipsisWidth : 0) + gap * (childCount - 1);
      };

      // Everything fits — no collapsing needed.
      if (widthFor(items.length - 1, false) <= availableWidth) {
        setTailCount(items.length - 1);
        return;
      }
      // Otherwise find the largest trailing window (always ending at the
      // current folder) that fits alongside root + the "…" chip.
      for (let tail = items.length - 2; tail >= 1; tail--) {
        if (widthFor(tail, true) <= availableWidth) {
          setTailCount(tail);
          return;
        }
      }
      // Not even root + "…" + current folder fits — still show that much
      // (never drop the current folder); its own text truncates via CSS
      // as an absolute-last-resort fallback (see the `truncate` class below).
      setTailCount(1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [items]);

  const entries = visibleEntries(items, tailCount);

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-full border border-beige-300/70 bg-beige-100 px-3.5 py-1.5 text-[13px] text-ink-500"
    >
      <Box size={14} className="shrink-0 text-sage-500" />
      {entries.map((entry) => {
        if (entry.kind === "collapsed") {
          return (
            <span key="collapsed" className="flex shrink-0 items-center gap-2">
              <span className="flex items-center text-ink-400" title="More folders in this path">
                <MoreHorizontal size={14} />
              </span>
              <ChevronRight size={14} className="text-ink-400" />
            </span>
          );
        }
        const isLast = entry.index === items.length - 1;
        return (
          <span key={`${entry.item}-${entry.index}`} className="flex min-w-0 shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.(entry.index)}
              title={isLast ? entry.item : undefined}
              className={`whitespace-nowrap transition-colors hover:text-forest-700 ${
                isLast ? "max-w-[40vw] truncate font-semibold text-forest-700" : "text-ink-500"
              }`}
            >
              {entry.item}
            </button>
            {!isLast && <ChevronRight size={14} className="text-ink-400" />}
          </span>
        );
      })}

      {/* Hidden measurer — identical markup/text to the entries above,
          rendered off-flow (position: absolute) purely so its real widths
          can be measured via refs. Never visible, never interactive. */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-2 overflow-hidden"
        style={{ height: 0 }}
      >
        <span ref={iconRef} className="flex shrink-0 items-center">
          <Box size={14} />
        </span>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span
              key={`measure-${item}-${index}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap"
            >
              <span className={isLast ? "font-semibold" : undefined}>{item}</span>
              {!isLast && <ChevronRight size={14} />}
            </span>
          );
        })}
        <span ref={ellipsisRef} className="flex shrink-0 items-center gap-2">
          <MoreHorizontal size={14} />
          <ChevronRight size={14} />
        </span>
      </div>
    </div>
  );
}
