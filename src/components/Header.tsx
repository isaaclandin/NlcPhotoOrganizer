import { RefreshCw, Settings as SettingsIcon } from "lucide-react";
import DuckLogo from "./DuckLogo";
import BreadcrumbBar from "./BreadcrumbBar";
import headerLeafBranchReference from "../assets/design/processed/header_leaf_branch_reference.png";

interface HeaderProps {
  breadcrumbItems: string[];
  onBreadcrumbNavigate?: (index: number) => void;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onTitleClick?: () => void;
  settingsActive?: boolean;
}

export default function Header({
  breadcrumbItems,
  onBreadcrumbNavigate,
  onRefresh,
  onOpenSettings,
  onTitleClick,
  settingsActive,
}: HeaderProps) {
  return (
    <header className="relative overflow-hidden border-b border-beige-300/60 bg-cream-100 px-4 py-2">
      <img
        src={headerLeafBranchReference}
        alt=""
        role="presentation"
        draggable={false}
        className="pointer-events-none absolute -right-1 -top-2 h-auto w-16 select-none opacity-80"
      />

      <div className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={onTitleClick}
          className="flex shrink-0 items-center gap-2 rounded-xl text-left transition-opacity hover:opacity-80"
        >
          <DuckLogo size={28} />
          <h1 className="whitespace-nowrap font-serif text-base font-bold leading-tight tracking-tight text-forest-700">
            NLC Photo Renamer
          </h1>
        </button>

        <div className="min-w-0 flex-1">
          <BreadcrumbBar items={breadcrumbItems} onNavigate={onBreadcrumbNavigate} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-beige-300 bg-cream-50 px-3.5 py-2 text-sm font-medium text-ink-700 shadow-soft transition-colors hover:bg-beige-200"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium shadow-soft transition-colors ${
              settingsActive
                ? "border-forest-700/40 bg-forest-600 text-cream-50 hover:bg-forest-700"
                : "border-beige-300 bg-cream-50 text-ink-700 hover:bg-beige-200"
            }`}
          >
            <SettingsIcon size={15} />
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}
