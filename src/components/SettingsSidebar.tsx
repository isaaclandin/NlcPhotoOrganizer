import { Home, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SettingsSection = "general" | "logs";

const NAV_ITEMS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "General", icon: Home },
  { id: "logs", label: "Logs", icon: FileText },
];

interface SettingsSidebarProps {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export default function SettingsSidebar({ active, onSelect }: SettingsSidebarProps) {
  return (
    <div className="px-3">
      <p className="mb-2 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-ink-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sage-100 text-forest-600">
          <Home size={13} />
        </span>
        Settings
      </p>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-100 ${
                isActive
                  ? "bg-sage-100 font-semibold text-forest-700"
                  : "text-ink-700 hover:bg-beige-200/70"
              }`}
            >
              <Icon size={16} className={isActive ? "text-forest-600" : "text-ink-400"} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
