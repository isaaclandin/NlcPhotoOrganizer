import { ChevronRight, ChevronDown, Folder, Box, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import type { FolderTreeNode } from "../services/dropboxTypes";

interface FolderSidebarProps {
  tree: FolderTreeNode | null;
  treeLoading: boolean;
  currentPath: string;
  expandedPaths: Set<string>;
  /** Paths currently being re-crawled via a node's own "Retry" (see onRetryNode). */
  retryingPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onNavigate: (path: string) => void;
  /** Re-crawls just one failed folder's subtree in place. */
  onRetryNode: (path: string) => void;
}

function FolderTreeRow({
  node,
  depth,
  currentPath,
  expandedPaths,
  retryingPaths,
  onToggleExpand,
  onNavigate,
  onRetryNode,
}: {
  node: FolderTreeNode;
  depth: number;
  currentPath: string;
  expandedPaths: Set<string>;
  retryingPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onNavigate: (path: string) => void;
  onRetryNode: (path: string) => void;
}) {
  const isRoot = depth === 0;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPaths.has(node.pathLower);
  const isActive = node.pathLower === currentPath;
  const isRetrying = retryingPaths.has(node.pathLower);
  // Undefined only for nodes built before childrenStatus existed — treat as loaded.
  const status = node.childrenStatus ?? "loaded";
  // Covers both "not yet queued" and "fetch in flight" — from the sidebar's
  // point of view both just mean "we don't know this folder's children yet."
  const isDiscovering = status === "unknown" || status === "loading";

  // Capped so very deep trees (10+ levels) don't eat the whole row's width
  // in indentation alone, leaving nothing for the name — truncation below
  // still keeps a too-long name readable at any depth.
  const indentDepth = Math.min(depth, 10);

  return (
    <div>
      <div
        style={{ paddingLeft: `${8 + indentDepth * 12}px` }}
        className={`group flex w-full items-center gap-1 rounded-lg py-1.5 pr-2 text-sm transition-colors duration-100 ${
          isActive
            ? "border-l-2 border-forest-600 bg-sage-100 font-semibold text-forest-700"
            : "border-l-2 border-transparent text-ink-700 hover:bg-beige-200/70"
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleExpand(node.pathLower)}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-400 hover:text-ink-700"
        >
          {status === "error" ? null : isDiscovering ? (
            <Loader2 size={11} className="animate-spin text-ink-300" aria-label="Discovering subfolders" />
          ) : hasChildren ? (
            isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onNavigate(node.pathLower)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {isRoot ? (
            <Box size={15} className="shrink-0 text-sage-500" />
          ) : (
            <Folder size={15} className="shrink-0 fill-gold-300/70 text-gold-500" />
          )}
          <span className="truncate" title={node.pathDisplay}>
            {node.name}
          </span>
          {!node.error && node.isPartial ? (
            <span className="ml-auto shrink-0 text-[10px] leading-none text-ink-400" title="Folder limit reached — some subfolders here weren't discovered">
              +
            </span>
          ) : null}
        </button>
        {node.error && (
          <>
            <AlertTriangle size={11} className="shrink-0 text-rose-500" aria-label={node.error} />
            <button
              type="button"
              onClick={() => onRetryNode(node.pathLower)}
              disabled={isRetrying}
              aria-label={`Retry loading ${node.name}`}
              title={node.error}
              className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[10px] font-medium text-rose-600 underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={10} className={isRetrying ? "animate-spin" : undefined} />
              Retry
            </button>
          </>
        )}
      </div>
      {isExpanded && (hasChildren || isDiscovering) && (
        <div>
          {node.children.map((child) => (
            <FolderTreeRow
              key={child.pathLower}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              expandedPaths={expandedPaths}
              retryingPaths={retryingPaths}
              onToggleExpand={onToggleExpand}
              onNavigate={onNavigate}
              onRetryNode={onRetryNode}
            />
          ))}
          {isDiscovering && (
            <div
              style={{ paddingLeft: `${8 + Math.min(depth + 1, 10) * 12}px` }}
              className="flex items-center gap-1.5 py-1 text-xs text-ink-400"
            >
              <Loader2 size={11} className="animate-spin" />
              Loading…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Recursive Dropbox folder tree. Data (the tree) and UI state
 * (`expandedPaths`) are kept separate on purpose — the tree is rebuilt
 * wholesale on refresh, while expand/collapse state should survive that.
 */
export default function FolderSidebar({
  tree,
  treeLoading,
  currentPath,
  expandedPaths,
  retryingPaths,
  onToggleExpand,
  onNavigate,
  onRetryNode,
}: FolderSidebarProps) {
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {tree && (
        <FolderTreeRow
          node={tree}
          depth={0}
          currentPath={currentPath}
          expandedPaths={expandedPaths}
          retryingPaths={retryingPaths}
          onToggleExpand={onToggleExpand}
          onNavigate={onNavigate}
          onRetryNode={onRetryNode}
        />
      )}
      {treeLoading && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-400">
          <Loader2 size={13} className="animate-spin" />
          {tree ? "Refreshing folders…" : "Loading folders…"}
        </div>
      )}
    </nav>
  );
}
