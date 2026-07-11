import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";

interface PillProps {
  label: string;
  icon?: LucideIcon;
  selected?: boolean;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

export default function Pill({
  label,
  icon: Icon,
  selected = false,
  removable = false,
  onClick,
  onRemove,
  className = "",
}: PillProps) {
  const handleRemove = (event: MouseEvent) => {
    event.stopPropagation();
    onRemove?.();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
        selected
          ? "border-forest-700/30 bg-forest-600 text-cream-50 shadow-soft"
          : "border-beige-300 bg-cream-50 text-ink-700 hover:border-sage-300 hover:bg-sage-50"
      } ${className}`}
    >
      {Icon && <Icon size={14} className={selected ? "text-cream-50" : "text-sage-500"} />}
      <span>{label}</span>
      {selected && removable && (
        <X
          size={14}
          onClick={handleRemove}
          className="ml-0.5 rounded-full text-cream-50/80 hover:text-cream-50"
        />
      )}
    </button>
  );
}
