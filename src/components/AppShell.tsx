import type { ReactNode } from "react";
import Header from "./Header";

interface AppShellProps {
  breadcrumbItems: string[];
  onBreadcrumbNavigate?: (index: number) => void;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onTitleClick?: () => void;
  settingsActive?: boolean;
  sidebar: ReactNode;
  bottomBar?: ReactNode;
  children: ReactNode;
}

export default function AppShell({
  breadcrumbItems,
  onBreadcrumbNavigate,
  onRefresh,
  onOpenSettings,
  onTitleClick,
  settingsActive,
  sidebar,
  bottomBar,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#EAE3D2] p-4">
      <div className="flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-beige-300/60 bg-cream-50 shadow-lifted">
        <Header
          breadcrumbItems={breadcrumbItems}
          onBreadcrumbNavigate={onBreadcrumbNavigate}
          onRefresh={onRefresh}
          onOpenSettings={onOpenSettings}
          onTitleClick={onTitleClick}
          settingsActive={settingsActive}
        />

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 shrink-0 flex-col border-r border-beige-300/60 bg-cream-100">
            <div className="min-h-0 flex-1 overflow-y-auto pb-3 pt-3">{sidebar}</div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-cream-50">
            {children}
          </main>
        </div>

        {bottomBar}
      </div>
    </div>
  );
}
