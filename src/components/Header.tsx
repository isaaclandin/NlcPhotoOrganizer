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
    <header className="relative overflow-hidden border-b border-beige-300/60 bg-cream-100 px-6 pb-4 pt-5">
      <img
        src={headerLeafBranchReference}
        alt=""
        role="presentation"
        draggable={false}
        className="pointer-events-none absolute -right-3 -top-5 h-auto w-40 select-none opacity-80"
      />

      <div className="relative flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={onTitleClick}
          className="flex items-center gap-2.5 rounded-xl text-left transition-opacity hover:opacity-80"
        >
          <DuckLogo size={60} />
          <div>
            <h1 className="font-serif text-[26px] font-bold leading-tight tracking-tight text-forest-700">
              NLC Photo Renamer
            </h1>
            <p className="mt-0.5 text-sm text-ink-500">
              Organize with heart. Rename with ease.
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-beige-300 bg-cream-50 px-4 py-2.5 text-sm font-medium text-ink-700 shadow-soft transition-colors hover:bg-beige-200"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-soft transition-colors ${
              settingsActive
                ? "border-forest-700/40 bg-forest-600 text-cream-50 hover:bg-forest-700"
                : "border-beige-300 bg-cream-50 text-ink-700 hover:bg-beige-200"
            }`}
          >
            <SettingsIcon size={16} />
            Settings
          </button>
        </div>
      </div>

      <div className="relative mt-4">
        <BreadcrumbBar items={breadcrumbItems} onNavigate={onBreadcrumbNavigate} />
      </div>
    </header>
  );
}
