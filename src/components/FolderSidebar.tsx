import { ChevronRight, ChevronDown, Folder, Box, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import type { FolderTreeNode } from "../services/dropboxTypes";

interface FolderSidebarProps {
  tree: FolderTreeNode | null;
  treeLoading: boolean;
  currentPath: string;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onNavigate: (path: string) => void;
  /** Rebuilds the folder tree from scratch — offered when a limit/error cut discovery short. */
  onRetry: () => void;
}

/** True if any node in the tree hit maxDepth/maxFolders or failed to list. */
function treeHasPartialOrError(node: FolderTreeNode): boolean {
  if (node.isPartial || node.error) return true;
  return node.children.some(treeHasPartialOrError);
}

function FolderTreeRow({
  node,
  depth,
  currentPath,
  expandedPaths,
  onToggleExpand,
  onNavigate,
}: {
  node: FolderTreeNode;
  depth: number;
  currentPath: string;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onNavigate: (path: string) => void;
}) {
  const isRoot = depth === 0;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedPaths.has(node.pathLower);
  const isActive = node.pathLower === currentPath;

  return (
    <div>
      <div
        style={{ paddingLeft: `${8 + depth * 16}px` }}
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
          {hasChildren ? (
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
          <span className="truncate">{node.name}</span>
          {node.error ? (
            <AlertTriangle size={11} className="ml-auto shrink-0 text-rose-500" aria-label={node.error} />
          ) : node.isPartial ? (
            <span className="ml-auto shrink-0 text-[10px] leading-none text-ink-400" title="More subfolders not shown">
              +
            </span>
          ) : null}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <FolderTreeRow
              key={child.pathLower}
              node={child}
              depth={depth + 1}
              currentPath={currentPath}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onNavigate={onNavigate}
            />
          ))}
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
  onToggleExpand,
  onNavigate,
  onRetry,
}: FolderSidebarProps) {
  const showPartialWarning = !treeLoading && tree !== null && treeHasPartialOrError(tree);

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {showPartialWarning && (
        <div className="mb-1 flex items-start gap-1.5 rounded-lg border border-gold-400/50 bg-gold-300/20 px-2.5 py-2 text-xs text-gold-600">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Some folders may not have fully loaded.
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 inline-flex items-center gap-1 font-medium underline hover:no-underline"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </span>
        </div>
      )}
      {tree && (
        <FolderTreeRow
          node={tree}
          depth={0}
          currentPath={currentPath}
          expandedPaths={expandedPaths}
          onToggleExpand={onToggleExpand}
          onNavigate={onNavigate}
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
