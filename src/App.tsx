import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import AppShell from "./components/AppShell";
import FolderSidebar from "./components/FolderSidebar";
import SettingsSidebar from "./components/SettingsSidebar";
import type { SettingsSection } from "./components/SettingsSidebar";
import PhotoBrowserView from "./components/PhotoBrowserView";
import { getTagIcon } from "./components/PhotoBrowserView";
import type { DropboxLoadError } from "./components/PhotoBrowserView";
import RenameActionBar from "./components/RenameActionBar";
import type { TagOption, RenameProgress, RenameResult } from "./components/RenameActionBar";
import RenameConfirmModal from "./components/RenameConfirmModal";
import SettingsView from "./components/SettingsView";
import LogsView from "./components/LogsView";
import DuckLogo from "./components/DuckLogo";
import { getSettings, updateSettings } from "./services/settingsRepository";
import { locationsRepository, tagsRepository } from "./services/labelsRepository";
import { peekNextSequence, recordHighestUsedSequence } from "./services/countersRepository";
import { applyRetention, createBatch, deleteAllBatches } from "./services/logsRepository";
import {
  listFolder,
  listFolderTree,
  getThumbnails,
  renameFiles,
  DropboxServiceError,
} from "./services/dropboxService";
import type { ThumbnailResultMap } from "./services/dropboxService";
import type { DropboxEntry, DropboxFileItem, FolderTreeNode } from "./services/dropboxTypes";
import {
  ancestorDropboxPaths,
  breadcrumbSegments,
  folderNameFromPath,
  pathForBreadcrumbIndex,
} from "./utils/dropboxPath";
import { buildPreviewFilename, buildRenamePattern, formatSequence } from "./utils/naming";
import type { AppSettings, LabelItem } from "./services/types";

type View = "browser" | "settings" | "logs";

const DEFAULT_SETTINGS: AppSettings = {
  basePrefix: "NLC",
  numberWidth: 5,
  logRetentionDays: 7,
  logRetentionMinBatches: 10,
  dropboxAppKey: "",
  dropboxAppSecret: "",
  dropboxRefreshToken: "",
  lastDropboxPath: "",
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

  const dropboxImageFiles = dropboxEntries.filter(
    (e): e is DropboxFileItem => e.type === "file" && e.isImage,
  );

  const buildFolderTree = () => {
    folderTreeAbortRef.current?.abort();
    const controller = new AbortController();
    folderTreeAbortRef.current = controller;
    setFolderTreeLoading(true);
    listFolderTree("", { signal: controller.signal }).then((tree) => {
      if (controller.signal.aborted) return;
      setFolderTree(tree);
      setFolderTreeLoading(false);
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
      loadDropboxFolder(loadedSettings.lastDropboxPath || "");
      buildFolderTree();
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
          onSettingsSaved={handleSettingsSaved}
          onLabelsChanged={reloadLabels}
        />
      )}
      {view === "logs" && <LogsView key={logsRefreshKey} />}

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
    </AppShell>
  );
}
