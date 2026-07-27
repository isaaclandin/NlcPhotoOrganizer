import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import AppShell from "./components/AppShell";
import FolderSidebar from "./components/FolderSidebar";
import SettingsSidebar from "./components/SettingsSidebar";
import type { SettingsSection } from "./components/SettingsSidebar";
import PhotoBrowserView from "./components/PhotoBrowserView";
import { getTagIcon } from "./components/PhotoBrowserView";
import type { DropboxLoadError, FolderDebugInfo } from "./components/PhotoBrowserView";
import RenameActionBar from "./components/RenameActionBar";
import type { TagOption, RenameProgress, RenameResult } from "./components/RenameActionBar";
import RenameConfirmModal from "./components/RenameConfirmModal";
import UndoConfirmModal from "./components/UndoConfirmModal";
import SettingsView from "./components/SettingsView";
import LogsView from "./components/LogsView";
import DuckLogo from "./components/DuckLogo";
import { getSettings, updateSettings } from "./services/settingsRepository";
import { locationsRepository, tagsRepository } from "./services/labelsRepository";
import { peekNextSequence, recordHighestUsedSequence } from "./services/countersRepository";
import { applyRetention, createBatch, deleteAllBatches, markBatchUndone } from "./services/logsRepository";
import {
  listFolder,
  listFolderTree,
  collectFolderPaths,
  findFolderNode,
  getThumbnails,
  renameFiles,
  DropboxServiceError,
} from "./services/dropboxService";
import type { ThumbnailResultMap } from "./services/dropboxService";
import { completeDropboxAuthIfRedirected, hasDropboxRefreshToken } from "./services/dropboxAuth";
import type { DropboxEntry, DropboxFileItem, FolderTreeNode } from "./services/dropboxTypes";
import {
  ancestorDropboxPaths,
  breadcrumbSegments,
  folderNameFromPath,
  pathForBreadcrumbIndex,
} from "./utils/dropboxPath";
import { buildPreviewFilename, buildRenamePattern, formatSequence } from "./utils/naming";
import type { AppSettings, BatchItemRecord, BatchRecord, LabelItem, NewBatchItem } from "./services/types";

type View = "browser" | "settings" | "logs";

const DEFAULT_SETTINGS: AppSettings = {
  basePrefix: "NLC",
  numberWidth: 5,
  logRetentionDays: 7,
  logRetentionMinBatches: 10,
  lastDropboxPath: "",
  defaultStartupDropboxPath: null,
};

export default function App() {
  const [view, setView] = useState<View>("browser");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [columns, setColumns] = useState(6);
  const [photoViewMode, setPhotoViewMode] = useState<"grid" | "list">("grid");

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [locations, setLocations] = useState<LabelItem[]>([]);
  const [tags, setTags] = useState<LabelItem[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [previewSequence, setPreviewSequence] = useState(1);
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);

  const [dropboxPath, setDropboxPath] = useState("");
  // mirrors dropboxPath for reads from inside long-running async handlers
  // (handleRename) where a closure over state would otherwise go stale
  const dropboxPathRef = useRef("");
  const [dropboxEntries, setDropboxEntries] = useState<DropboxEntry[]>([]);
  const [dropboxLoading, setDropboxLoading] = useState(false);
  const [dropboxError, setDropboxError] = useState<DropboxLoadError | null>(null);
  // Set once at most, right after startup path resolution falls back from an
  // invalid saved folder. Persists until manually dismissed rather than being
  // cleared by every subsequent folder load (see loadDropboxFolder below).
  const [startupWarning, setStartupWarning] = useState<string | null>(null);

  const [thumbnails, setThumbnails] = useState<ThumbnailResultMap>(new Map());
  const [thumbnailWarning, setThumbnailWarning] = useState<string | null>(null);
  const thumbnailAbortRef = useRef<AbortController | null>(null);
  const thumbnailFolderRef = useRef<string>("");

  const [folderTree, setFolderTree] = useState<FolderTreeNode | null>(null);
  const [folderTreeLoading, setFolderTreeLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const folderTreeAbortRef = useRef<AbortController | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [renameProgress, setRenameProgress] = useState<RenameProgress | null>(null);
  const [renameResult, setRenameResult] = useState<RenameResult | null>(null);
  const [pendingRename, setPendingRename] = useState<{
    targetPath: string;
    pattern: string;
    startSequence: number;
    plannedItems: { photo: DropboxFileItem; sequence: number; newName: string; toPath: string }[];
  } | null>(null);

  const [undoing, setUndoing] = useState(false);
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null);
  const [undoProgress, setUndoProgress] = useState<RenameProgress | null>(null);
  const [undoResult, setUndoResult] = useState<RenameResult | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{
    batch: BatchRecord;
    reverseMoves: { itemId: number; fromPath: string; toPath: string; fromName: string; toName: string }[];
  } | null>(null);

  const dropboxImageFiles = dropboxEntries.filter(
    (e): e is DropboxFileItem => e.type === "file" && e.isImage,
  );
  // Whether the *current* folder has subfolders — independent of the
  // recursive sidebar tree crawl, since this comes straight from the same
  // listFolder() call that already populated dropboxEntries. Used to tell
  // "no photos here, but keep browsing" apart from "genuinely empty."
  const dropboxChildFolderCount = dropboxEntries.filter((e) => e.type === "folder").length;
  const dropboxHasSubfolders = dropboxChildFolderCount > 0;

  // Production-safe folder-tree diagnostics (no tokens, no request bodies) —
  // surfaced in the UI so nested-folder-discovery issues can be verified
  // directly on a live deployment without needing devtools. childFolderCount
  // / hasDirectImages come straight from the current folder's own listFolder
  // result (always fresh); limitHit/nodeError reflect that same folder's
  // node in the separately-crawled sidebar tree, if the crawl has reached it.
  const selectedFolderNode = folderTree ? findFolderNode(folderTree, dropboxPath) : null;
  const folderDebugInfo: FolderDebugInfo = {
    path: dropboxPath || "/",
    depth: ancestorDropboxPaths(dropboxPath).length - 1,
    childFolderCount: dropboxChildFolderCount,
    hasDirectImages: dropboxImageFiles.length > 0,
    hasChildFolders: dropboxHasSubfolders,
    treeLoading: folderTreeLoading,
    limitHit: selectedFolderNode?.isPartial ?? false,
    nodeError: selectedFolderNode?.error ?? null,
  };

  const buildFolderTree = () => {
    folderTreeAbortRef.current?.abort();
    const controller = new AbortController();
    folderTreeAbortRef.current = controller;
    setFolderTreeLoading(true);
    listFolderTree("", { signal: controller.signal }).then((tree) => {
      if (controller.signal.aborted) return;
      setFolderTree(tree);
      setFolderTreeLoading(false);
      // Auto-expand every folder the crawl found (this Dropbox isn't
      // massive) so nested folders are visible immediately instead of
      // requiring the user to manually click through each parent first.
      // Merged onto whatever's already expanded, so a manual collapse made
      // earlier in the session isn't clobbered by a later refresh picking
      // up newly-created folders.
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        collectFolderPaths(tree).forEach((p) => next.add(p));
        return next;
      });
    });
  };

  const toggleExpandPath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const loadThumbnailsForFolder = (path: string, imageFiles: DropboxFileItem[]) => {
    // a fresh folder load supersedes any thumbnails still in flight for the old one
    thumbnailAbortRef.current?.abort();
    const controller = new AbortController();
    thumbnailAbortRef.current = controller;
    thumbnailFolderRef.current = path;

    setThumbnails(new Map(imageFiles.map((f) => [f.id, { status: "loading" as const }])));
    setThumbnailWarning(null);

    if (imageFiles.length === 0) return;

    getThumbnails(
      imageFiles,
      (batch) => {
        if (thumbnailFolderRef.current !== path) return; // stale folder, ignore
        setThumbnails((prev) => {
          const next = new Map(prev);
          batch.forEach((value, key) => next.set(key, value));
          return next;
        });
      },
      { signal: controller.signal },
    )
      .then(({ hadRequestFailure }) => {
        if (thumbnailFolderRef.current !== path) return;
        if (hadRequestFailure) {
          setThumbnailWarning("Couldn't load some thumbnails. You can still select and rename these photos.");
        }
      })
      .catch(() => {
        if (thumbnailFolderRef.current !== path) return;
        setThumbnailWarning("Couldn't load some thumbnails. You can still select and rename these photos.");
      });
  };

  const loadDropboxFolder = async (path: string) => {
    setDropboxLoading(true);
    setDropboxError(null);
    setDropboxPath(path);
    dropboxPathRef.current = path;
    setSelectedIds(new Set());
    setRenameResult(null);
    setUndoResult(null);
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      ancestorDropboxPaths(path).forEach((p) => next.add(p));
      return next;
    });
    try {
      const result = await listFolder(path);
      setDropboxEntries(result.entries);
      // best-effort — the current folder isn't critical enough to block navigation on
      void updateSettings({ lastDropboxPath: path }).catch(() => {});
      const imageFiles = result.entries.filter(
        (e): e is DropboxFileItem => e.type === "file" && e.isImage,
      );
      loadThumbnailsForFolder(path, imageFiles);
    } catch (err) {
      setDropboxEntries([]);
      thumbnailAbortRef.current?.abort();
      thumbnailFolderRef.current = path;
      setThumbnails(new Map());
      setThumbnailWarning(null);
      if (err instanceof DropboxServiceError) {
        setDropboxError({ message: err.message, kind: err.kind });
      } else {
        setDropboxError({ message: "Something went wrong loading this folder.", kind: "unknown" });
      }
    } finally {
      setDropboxLoading(false);
    }
  };

  /**
   * Picks which folder to open on launch: an explicit defaultStartupDropboxPath
   * beats lastDropboxPath (the user chose it on purpose), which beats root.
   * Each non-root candidate is validated with a real listFolder call so a
   * folder that was since deleted/renamed/access-revoked doesn't get opened
   * blindly; root is always the final, unconditionally-valid fallback, so
   * this can never get stuck without landing somewhere.
   */
  const resolveStartupPath = async (
    loadedSettings: AppSettings,
  ): Promise<{ path: string; warning: string | null }> => {
    // No Dropbox connection yet — every candidate (including root) would
    // fail the same way, so skip straight to root and let the existing
    // missing-credentials panel handle it instead of showing a confusing
    // "saved folder could not be opened" warning first.
    if (!(await hasDropboxRefreshToken())) return { path: "", warning: null };

    const candidates: string[] = [];
    if (loadedSettings.defaultStartupDropboxPath !== null) {
      candidates.push(loadedSettings.defaultStartupDropboxPath);
    }
    candidates.push(loadedSettings.lastDropboxPath);

    let anyCandidateFailed = false;
    for (const candidate of candidates) {
      if (candidate === "") {
        return { path: "", warning: anyCandidateFailed ? "Saved startup folder could not be opened." : null };
      }
      try {
        await listFolder(candidate);
        return { path: candidate, warning: anyCandidateFailed ? "Saved startup folder could not be opened." : null };
      } catch {
        anyCandidateFailed = true;
      }
    }
    return { path: "", warning: anyCandidateFailed ? "Saved startup folder could not be opened." : null };
  };

  // initial load of everything persisted
  useEffect(() => {
    (async () => {
      const [loadedSettings, loadedLocations, loadedTags] = await Promise.all([
        getSettings(),
        locationsRepository.list(),
        tagsRepository.list(),
      ]);
      setSettings(loadedSettings);
      setLocations(loadedLocations);
      setTags(loadedTags);
      setSelectedLocation(
        loadedLocations.find((l) => l.label === "South")?.label ?? loadedLocations[0]?.label ?? "",
      );
      setSelectedTags(
        loadedTags
          .filter((t) => t.label === "Books" || t.label === "Clothing")
          .map((t) => t.label),
      );
      setDataLoaded(true);

      // If this load is Dropbox redirecting back after the user clicked
      // Connect Dropbox, finish the PKCE exchange (and strip the auth params
      // from the URL) before anything below tries to use the connection —
      // a no-op ({ status: "not-a-callback" }) on every normal page load.
      const authCallback = await completeDropboxAuthIfRedirected();
      if (authCallback.status === "error") setStartupWarning(authCallback.message);

      // Independent of resolving which folder to open, so it starts right away.
      buildFolderTree();
      const { path: startupPath, warning } = await resolveStartupPath(loadedSettings);
      if (warning) setStartupWarning(warning);
      loadDropboxFolder(startupPath);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the rename-preview sequence in sync with the real persisted counter
  useEffect(() => {
    if (!dataLoaded) return;
    let cancelled = false;
    const pattern = buildRenamePattern({
      prefix: settings.basePrefix,
      location: selectedLocation,
      tags: selectedTags,
    }).join("_");
    peekNextSequence(pattern).then((value) => {
      if (!cancelled) setPreviewSequence(value);
    });
    return () => {
      cancelled = true;
    };
  }, [dataLoaded, settings.basePrefix, selectedLocation, selectedTags]);

  const reloadLabels = async () => {
    const [loadedLocations, loadedTags] = await Promise.all([
      locationsRepository.list(),
      tagsRepository.list(),
    ]);
    setLocations(loadedLocations);
    setTags(loadedTags);
    // if the currently selected location/tags were edited or removed, reconcile
    setSelectedLocation((current) =>
      loadedLocations.some((l) => l.label === current) ? current : (loadedLocations[0]?.label ?? ""),
    );
    setSelectedTags((current) => current.filter((label) => loadedTags.some((t) => t.label === label)));
  };

  const handleSettingsSaved = async (patch: Partial<AppSettings>) => {
    const next = await updateSettings(patch);
    setSettings(next);
  };

  const togglePhoto = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === dropboxImageFiles.length ? new Set() : new Set(dropboxImageFiles.map((p) => p.id)),
    );
  };

  const toggleTag = (label: string) => {
    setSelectedTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label],
    );
  };

  const handleSelectSettingsSection = (section: SettingsSection) => {
    if (section === "logs") {
      setView("logs");
      return;
    }
    setSettingsSection(section);
    setView("settings");
  };

  const openRenameConfirm = async () => {
    if (selectedIds.size === 0 || !selectedLocation || renaming) return;

    const photosToRename = dropboxImageFiles.filter((p) => selectedIds.has(p.id));
    const targetPath = dropboxPath; // the folder these files live in right now
    const pattern = buildRenamePattern({
      prefix: settings.basePrefix,
      location: selectedLocation,
      tags: selectedTags,
    }).join("_");

    // Sequence numbers are pre-assigned here (same naming utility the real
    // rename uses) so the modal's preview list is guaranteed to match what
    // executeRename actually sends to Dropbox — it reuses this exact data
    // rather than recomputing it.
    const startSequence = await peekNextSequence(pattern);
    const folderPrefix = targetPath ? `${targetPath}/` : "/";

    const plannedItems = photosToRename.map((photo, index) => {
      const sequence = startSequence + index;
      const newName = buildPreviewFilename({
        prefix: settings.basePrefix,
        location: selectedLocation,
        tags: selectedTags,
        sequence,
        numberWidth: settings.numberWidth,
        extension: photo.extension || "jpg",
      });
      return { photo, sequence, newName, toPath: `${folderPrefix}${newName}` };
    });

    setPendingRename({ targetPath, pattern, startSequence, plannedItems });
  };

  const cancelRenameConfirm = () => {
    if (renaming) return;
    setPendingRename(null);
  };

  const executeRename = async () => {
    if (!pendingRename || renaming) return;
    const { targetPath, pattern, startSequence, plannedItems } = pendingRename;
    setPendingRename(null);

    setRenaming(true);
    setRenameResult(null);
    setRenameProgress({ done: 0, total: plannedItems.length });

    const { results, aborted, abortReason } = await renameFiles(
      plannedItems.map((item) => ({ key: item.photo.id, fromPath: item.photo.pathLower, toPath: item.toPath })),
      () => {
        // per-file outcomes are collected from renameFiles' return value below;
        // this callback only drives the live "N of M" progress label
        setRenameProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
      },
    );

    if (aborted) {
      setRenaming(false);
      setRenameProgress(null);
      setRenameResult({ tone: "error", message: abortReason ?? "Could not rename photos in Dropbox." });
      return;
    }

    const outcomeByKey = new Map(results.map((r) => [r.key, r]));
    let highestUsedSequence: number | null = null;

    const items = plannedItems.map((item) => {
      const outcome = outcomeByKey.get(item.photo.id);
      const succeeded = outcome?.ok ?? false;
      if (succeeded) {
        highestUsedSequence =
          highestUsedSequence === null ? item.sequence : Math.max(highestUsedSequence, item.sequence);
      }
      return {
        originalName: item.photo.name,
        newName: succeeded ? item.newName : "",
        originalPath: item.photo.pathLower,
        newPath: succeeded ? item.toPath : "",
        result: succeeded ? ("Success" as const) : ("Failed" as const),
        error: succeeded ? null : (outcome?.error ?? "Rename failed"),
      };
    });

    const successCount = items.filter((item) => item.result === "Success").length;
    const failCount = items.length - successCount;
    const folderName = folderNameFromPath(targetPath);
    const folderPath = targetPath || "/";

    await createBatch(
      {
        id: `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${folderName} Rename`,
        createdAt: new Date().toISOString(),
        status: successCount === items.length ? "Success" : successCount === 0 ? "Failed" : "Partial",
        folderName,
        folderPath,
        location: selectedLocation,
        locationGroup: selectedLocation,
        tags: selectedTags,
        numberingRange:
          highestUsedSequence === null
            ? "—"
            : `${formatSequence(startSequence, settings.numberWidth)} – ${formatSequence(
                highestUsedSequence,
                settings.numberWidth,
              )}`,
        fileCount: items.length,
        operationType: "rename",
        undoOfBatchId: null,
        undoneByBatchId: null,
        undoStatus: "none",
        undoneAt: null,
      },
      items,
    );
    await recordHighestUsedSequence(pattern, highestUsedSequence);
    await applyRetention();
    setLogsRefreshKey((k) => k + 1);

    const resultMessage =
      failCount === 0
        ? `Renamed ${successCount} photo${successCount === 1 ? "" : "s"} in Dropbox.`
        : successCount === 0
          ? `Couldn't rename ${failCount} photo${failCount === 1 ? "" : "s"}. See Logs for details.`
          : `Renamed ${successCount} of ${items.length} photos — ${failCount} failed. See Logs for details.`;

    // The preview reflects the counter for the current naming pattern, which
    // is independent of which folder is on screen, so update it regardless.
    setPreviewSequence(highestUsedSequence === null ? startSequence : highestUsedSequence + 1);

    // Refresh this folder's contents/thumbnails (not the sidebar tree —
    // renaming files doesn't change folder structure) only if the user is
    // still looking at the folder the rename happened in.
    if (dropboxPathRef.current === targetPath) {
      await loadDropboxFolder(targetPath);
      setRenameResult({ tone: failCount === 0 ? "success" : successCount === 0 ? "error" : "warning", message: resultMessage });
    }

    setRenaming(false);
    setRenameProgress(null);
  };

  const openUndoConfirm = (batch: BatchRecord, items: BatchItemRecord[]) => {
    if (undoing) return;
    if (batch.operationType !== "rename" || batch.undoStatus !== "none") return;
    const successfulItems = items.filter((item) => item.result === "Success");
    if (successfulItems.length === 0) return;
    const reverseMoves = successfulItems.map((item) => ({
      itemId: item.id,
      fromPath: item.newPath,
      toPath: item.originalPath,
      fromName: item.newName,
      toName: item.originalName,
    }));
    setPendingUndo({ batch, reverseMoves });
  };

  const cancelUndoConfirm = () => {
    if (undoing) return;
    setPendingUndo(null);
  };

  const executeUndo = async () => {
    if (!pendingUndo || undoing) return;
    const { batch, reverseMoves } = pendingUndo;
    setPendingUndo(null);

    setUndoing(true);
    setUndoingBatchId(batch.id);
    setUndoResult(null);
    setUndoProgress({ done: 0, total: reverseMoves.length });

    // Undo reuses the same batch-move orchestrator as forward renames — a
    // Dropbox move is symmetric, so undoing is just that move run backwards
    // (new path -> original path). Per-item existence/conflict checks come
    // for free from move_v2's own atomic validation (surfaced as
    // "not_found"/"conflict" via renameFile's existing error classification)
    // rather than doing a separate pre-check round trip, which would just
    // race the move itself (TOCTOU) without adding any real safety.
    const { results, aborted, abortReason } = await renameFiles(
      reverseMoves.map((move) => ({ key: String(move.itemId), fromPath: move.fromPath, toPath: move.toPath })),
      () => {
        setUndoProgress((prev) => (prev ? { done: prev.done + 1, total: prev.total } : prev));
      },
    );

    if (aborted) {
      setUndoing(false);
      setUndoingBatchId(null);
      setUndoProgress(null);
      setUndoResult({ tone: "error", message: abortReason ?? "Could not undo rename in Dropbox." });
      return;
    }

    const outcomeByKey = new Map(results.map((r) => [r.key, r]));
    const undoItems: NewBatchItem[] = reverseMoves.map((move) => {
      const outcome = outcomeByKey.get(String(move.itemId));
      const succeeded = outcome?.ok ?? false;
      return {
        originalName: move.fromName,
        newName: move.toName,
        originalPath: move.fromPath,
        newPath: succeeded ? move.toPath : "",
        result: succeeded ? ("Success" as const) : ("Failed" as const),
        error: succeeded ? null : (outcome?.error ?? "Undo failed"),
      };
    });

    const successCount = undoItems.filter((item) => item.result === "Success").length;
    const failCount = undoItems.length - successCount;
    const undoBatchId = `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    await createBatch(
      {
        id: undoBatchId,
        name: `Undo of ${batch.name}`,
        createdAt: new Date().toISOString(),
        status: successCount === undoItems.length ? "Success" : successCount === 0 ? "Failed" : "Partial",
        folderName: batch.folderName,
        folderPath: batch.folderPath,
        location: batch.location,
        locationGroup: batch.locationGroup,
        tags: batch.tags,
        // Undo never assigns or consumes sequence numbers, so there's no range to report.
        numberingRange: "—",
        fileCount: undoItems.length,
        operationType: "undo",
        undoOfBatchId: batch.id,
        undoneByBatchId: null,
        undoStatus: "none",
        undoneAt: null,
      },
      undoItems,
    );

    // Only mark the original batch undone if at least one file actually
    // moved back — per spec, a fully-failed undo must leave the original
    // batch's undo_status untouched at its default "none".
    if (successCount > 0) {
      const undoStatus = successCount === reverseMoves.length ? "complete" : "partial";
      await markBatchUndone(batch.id, undoBatchId, undoStatus);
    }

    // Deliberately not touching countersRepository anywhere in this
    // function — undo must never decrement or otherwise modify name
    // counters, so the counter-mutating functions are simply never called.
    await applyRetention();
    setLogsRefreshKey((k) => k + 1);

    const resultMessage =
      failCount === 0
        ? "Rename batch undone."
        : successCount === 0
          ? "Undo failed. No files were restored."
          : `Partially undone — ${successCount} of ${undoItems.length} files restored.`;

    if (dropboxPathRef.current === batch.folderPath) {
      await loadDropboxFolder(batch.folderPath);
    }

    setUndoResult({ tone: failCount === 0 ? "success" : successCount === 0 ? "error" : "warning", message: resultMessage });
    setUndoing(false);
    setUndoingBatchId(null);
    setUndoProgress(null);
  };

  const handleClearAllLogs = async () => {
    const confirmed = window.confirm(
      "Clear all rename logs? This removes every persisted batch and cannot be undone.",
    );
    if (!confirmed) return;
    await deleteAllBatches();
    setLogsRefreshKey((k) => k + 1);
  };

  const baseBreadcrumb = breadcrumbSegments(dropboxPath);
  const breadcrumbItems = view === "logs" ? [...baseBreadcrumb, "Logs / Batch History"] : baseBreadcrumb;

  const tagOptions: TagOption[] = tags.map((t) => ({ label: t.label, icon: getTagIcon(t.label) }));
  const locationLabels = locations.map((l) => l.label);

  return (
    <AppShell
      breadcrumbItems={breadcrumbItems}
      onBreadcrumbNavigate={(index) => {
        const isLogsCrumb = view === "logs" && index === breadcrumbItems.length - 1;
        if (isLogsCrumb) return;
        setView("browser");
        loadDropboxFolder(pathForBreadcrumbIndex(dropboxPath, index));
      }}
      onRefresh={() => {
        loadDropboxFolder(dropboxPath);
        buildFolderTree();
      }}
      onOpenSettings={() => setView("settings")}
      onTitleClick={() => setView("browser")}
      settingsActive={view === "settings"}
      sidebar={
        view === "settings" ? (
          <SettingsSidebar active={settingsSection} onSelect={handleSelectSettingsSection} />
        ) : (
          <FolderSidebar
            tree={folderTree}
            treeLoading={folderTreeLoading}
            currentPath={dropboxPath}
            expandedPaths={expandedPaths}
            onToggleExpand={toggleExpandPath}
            onNavigate={(path) => {
              setView("browser");
              loadDropboxFolder(path);
            }}
            onRetry={buildFolderTree}
          />
        )
      }
      bottomBar={
        view === "browser" ? (
          <RenameActionBar
            locations={locationLabels}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
            tagOptions={tagOptions}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            prefix={settings.basePrefix}
            numberWidth={settings.numberWidth}
            previewSequence={previewSequence}
            selectedCount={selectedIds.size}
            renaming={renaming}
            renameProgress={renameProgress}
            renameResult={renameResult}
            onClearSelection={() => setSelectedIds(new Set())}
            onRename={openRenameConfirm}
          />
        ) : view === "settings" ? (
          <div className="flex items-center justify-between border-t border-beige-300/60 bg-cream-100 px-6 py-3.5 text-sm">
            <span className="flex items-center gap-2 text-ink-500">
              <Sparkles size={15} className="text-gold-500" />
              Tip: Your settings are saved automatically.
            </span>
            <span className="flex items-center gap-2 text-ink-500">
              Thank you for keeping things organized.
              <DuckLogo size={20} />
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-beige-300/60 bg-cream-100 px-6 py-3.5 text-sm">
            <span className="flex items-center gap-2 text-ink-500">
              <Sparkles size={15} className="text-gold-500" />
              Tip: Export logs to keep a record of your rename activity.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearAllLogs}
                className="inline-flex items-center gap-2 rounded-xl border border-beige-300 bg-cream-50 px-4 py-2.5 text-sm font-medium text-ink-700 shadow-soft transition-colors hover:bg-beige-200"
              >
                Clear All Logs
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-xl border border-forest-700/40 bg-forest-600 px-4 py-2.5 text-sm font-medium text-cream-50 opacity-50 shadow-soft"
              >
                View Log File
              </button>
            </div>
          </div>
        )
      }
    >
      {view === "browser" && (
        <PhotoBrowserView
          files={dropboxImageFiles}
          thumbnails={thumbnails}
          thumbnailWarning={thumbnailWarning}
          loading={dropboxLoading}
          error={dropboxError}
          isRoot={dropboxPath === ""}
          hasSubfolders={dropboxHasSubfolders}
          debugInfo={folderDebugInfo}
          startupWarning={startupWarning}
          onDismissStartupWarning={() => setStartupWarning(null)}
          selectedIds={selectedIds}
          onTogglePhoto={togglePhoto}
          onToggleSelectAll={toggleSelectAll}
          columns={columns}
          onColumnsChange={setColumns}
          viewMode={photoViewMode}
          onViewModeChange={setPhotoViewMode}
          onGoToSettings={() => setView("settings")}
          onRetry={() => loadDropboxFolder(dropboxPath)}
          onGoToRoot={() => loadDropboxFolder("")}
        />
      )}
      {view === "settings" && (
        <SettingsView
          settings={settings}
          locations={locations}
          tags={tags}
          currentDropboxPath={dropboxPath}
          onSettingsSaved={handleSettingsSaved}
          onLabelsChanged={reloadLabels}
        />
      )}
      {view === "logs" && (
        <LogsView
          key={logsRefreshKey}
          onRequestUndo={openUndoConfirm}
          undoing={undoing}
          undoingBatchId={undoingBatchId}
          undoProgress={undoProgress}
          undoResult={undoResult}
        />
      )}

      <RenameConfirmModal
        isOpen={pendingRename !== null}
        count={pendingRename?.plannedItems.length ?? 0}
        folderPath={pendingRename?.targetPath || "/"}
        location={selectedLocation}
        tags={selectedTags}
        plannedFilenames={pendingRename?.plannedItems.map((item) => item.newName) ?? []}
        isRenaming={renaming}
        onCancel={cancelRenameConfirm}
        onConfirm={executeRename}
      />

      <UndoConfirmModal
        isOpen={pendingUndo !== null}
        batchTimestamp={pendingUndo?.batch.createdAt ?? ""}
        folderPath={pendingUndo?.batch.folderPath || "/"}
        count={pendingUndo?.reverseMoves.length ?? 0}
        reverseMoves={pendingUndo?.reverseMoves.map((m) => ({ fromName: m.fromName, toName: m.toName })) ?? []}
        isUndoing={undoing}
        onCancel={cancelUndoConfirm}
        onConfirm={executeUndo}
      />
    </AppShell>
  );
}
