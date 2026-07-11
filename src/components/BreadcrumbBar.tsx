import { ChevronRight, Box } from "lucide-react";

interface BreadcrumbBarProps {
  items: string[];
  onNavigate?: (index: number) => void;
}

export default function BreadcrumbBar({ items, onNavigate }: BreadcrumbBarProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-full border border-beige-300/70 bg-beige-100 px-4 py-2.5 text-sm text-ink-500">
      <Box size={16} className="shrink-0 text-sage-500" />
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item}-${index}`} className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.(index)}
              className={`whitespace-nowrap transition-colors hover:text-forest-700 ${
                isLast ? "font-semibold text-forest-700" : "text-ink-500"
              }`}
            >
              {item}
            </button>
            {!isLast && <ChevronRight size={14} className="text-ink-400" />}
          </span>
        );
      })}
    </div>
  );
}
