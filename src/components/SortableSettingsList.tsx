import { useState } from "react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

export interface SortableItem {
  id: string;
  label: string;
}

interface SortableSettingsListProps {
  items: SortableItem[];
  onReorder: (items: SortableItem[]) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  highlightId?: string;
}

export default function SortableSettingsList({
  items,
  onReorder,
  onEdit,
  onDelete,
  highlightId,
}: SortableSettingsListProps) {
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = [...items];
    const fromIndex = next.findIndex((i) => i.id === dragId);
    const toIndex = next.findIndex((i) => i.id === targetId);
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
    setDragId(null);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-beige-300/70">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => setDragId(item.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(item.id)}
          className={`flex items-center gap-2 px-3 py-2.5 text-sm ${
            index !== items.length - 1 ? "border-b border-beige-300/60" : ""
          } ${item.id === highlightId ? "bg-beige-200" : "bg-cream-50"}`}
        >
          <GripVertical size={15} className="shrink-0 cursor-grab text-ink-300" />
          <span className="flex-1 truncate text-ink-900">{item.label}</span>
          <button
            type="button"
            onClick={() => onEdit?.(item.id)}
            aria-label={`Edit ${item.label}`}
            className="rounded-md p-1 text-ink-400 hover:bg-beige-200 hover:text-ink-700"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(item.id)}
            aria-label={`Delete ${item.label}`}
            className="rounded-md p-1 text-ink-400 hover:bg-rose-100 hover:text-rose-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
