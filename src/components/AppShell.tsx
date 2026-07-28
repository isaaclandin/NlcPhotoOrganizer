import type { ReactNode } from "react";
import { useRef } from "react";
import Header from "./Header";
import { MIN_SIDEBAR_WIDTH, clampSidebarWidth, getMaxSidebarWidth } from "../utils/sidebarWidth";

const KEYBOARD_RESIZE_STEP = 16;

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
  /** Only the folder/directory sidebar (browser view) is user-resizable —
   * Settings/Logs use their own fixed-width sidebar and never pass these. */
  resizableSidebar?: boolean;
  sidebarWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  /** Fired once at the end of a drag/keypress — the moment to persist, as
   * opposed to onSidebarWidthChange which fires continuously while dragging. */
  onSidebarWidthCommit?: (width: number) => void;
}

function FolderSidebarResizeHandle({
  width,
  onChange,
  onCommit,
}: {
  width: number;
  onChange: (width: number) => void;
  onCommit: (width: number) => void;
}) {
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: width };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    onChange(clampSidebarWidth(drag.startWidth + (e.clientX - drag.startX)));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onCommit(clampSidebarWidth(drag.startWidth + (e.clientX - drag.startX)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = clampSidebarWidth(width + (e.key === "ArrowRight" ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP));
      onChange(next);
      onCommit(next);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize folder sidebar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={Math.round(getMaxSidebarWidth())}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="group relative w-2.5 shrink-0 cursor-col-resize touch-none select-none focus:outline-none"
    >
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-beige-300/60 transition-colors group-hover:bg-forest-500/70 group-focus-visible:bg-forest-600" />
    </div>
  );
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
  resizableSidebar,
  sidebarWidth,
  onSidebarWidthChange,
  onSidebarWidthCommit,
}: AppShellProps) {
  const isResizable = resizableSidebar && sidebarWidth !== undefined && onSidebarWidthChange;

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
          <aside
            style={isResizable ? { width: sidebarWidth, flexShrink: 0 } : undefined}
            className={
              isResizable
                ? "flex flex-col overflow-hidden border-r border-beige-300/60 bg-cream-100"
                : "flex w-64 shrink-0 flex-col overflow-hidden border-r border-beige-300/60 bg-cream-100"
            }
          >
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3 pt-3">{sidebar}</div>
          </aside>

          {isResizable && (
            <FolderSidebarResizeHandle
              width={sidebarWidth}
              onChange={onSidebarWidthChange}
              onCommit={onSidebarWidthCommit ?? onSidebarWidthChange}
            />
          )}

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-cream-50">{children}</main>
        </div>

        {bottomBar}
      </div>
    </div>
  );
}
