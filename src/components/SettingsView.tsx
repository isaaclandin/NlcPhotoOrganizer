import { useEffect, useState } from "react";
import { Info, Plus, Cloud, CloudOff, AlertTriangle, Loader2, Leaf, FolderCog } from "lucide-react";
import Card from "./Card";
import Button from "./Button";
import SortableSettingsList from "./SortableSettingsList";
import type { SortableItem } from "./SortableSettingsList";
import { locationsRepository, tagsRepository } from "../services/labelsRepository";
import {
  beginDropboxAuth,
  disconnectDropbox,
  getDropboxConnectionInfo,
  getConfiguredRedirectUri,
} from "../services/dropboxAuth";
import type { AppSettings, LabelItem } from "../services/types";

/** "" is a valid, deliberately-chosen path (Dropbox root) — only null means "no folder selected". */
function describeDropboxPath(path: string): string {
  return path === "" ? "Dropbox root" : path;
}

type DropboxConnectionState =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "connected"; email: string | null; name: string | null }
  | { status: "connecting" }
  | { status: "error"; message: string };

interface SettingsViewProps {
  settings: AppSettings;
  locations: LabelItem[];
  tags: LabelItem[];
  /** The folder currently open in the photo browser — what "Use Current Folder" would save. */
  currentDropboxPath: string;
  onSettingsSaved: (patch: Partial<AppSettings>) => void;
  onLabelsChanged: () => void;
}

export default function SettingsView({
  settings,
  locations,
  tags,
  currentDropboxPath,
  onSettingsSaved,
  onLabelsChanged,
}: SettingsViewProps) {
  const [prefix, setPrefix] = useState(settings.basePrefix);
  const [numberWidth, setNumberWidth] = useState(settings.numberWidth);
  const [dropboxConnection, setDropboxConnection] = useState<DropboxConnectionState>({ status: "loading" });
  // Static per build (baked in from VITE_DROPBOX_REDIRECT_URI at build time),
  // not user data — shown so a trailing-slash mismatch against the Dropbox
  // App Console's registered redirect URI is visible without devtools.
  const configuredRedirectUri = getConfiguredRedirectUri();
  const redirectUriMissingSlash = configuredRedirectUri !== "" && !configuredRedirectUri.endsWith("/");

  // keep local editable copies in sync if settings are reloaded from elsewhere
  useEffect(() => setPrefix(settings.basePrefix), [settings.basePrefix]);
  useEffect(() => setNumberWidth(settings.numberWidth), [settings.numberWidth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await getDropboxConnectionInfo();
      if (cancelled) return;
      setDropboxConnection(
        info.connected ? { status: "connected", email: info.email, name: info.name } : { status: "disconnected" },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = String(1).padStart(numberWidth, "0");

  const commitPrefix = () => {
    const trimmed = prefix.trim() || "NLC";
    setPrefix(trimmed);
    if (trimmed !== settings.basePrefix) onSettingsSaved({ basePrefix: trimmed });
  };

  const commitNumberWidth = (value: number) => {
    const clamped = Math.min(10, Math.max(1, value || 1));
    setNumberWidth(clamped);
    if (clamped !== settings.numberWidth) onSettingsSaved({ numberWidth: clamped });
  };

  const handleConnectDropbox = async () => {
    setDropboxConnection({ status: "connecting" });
    try {
      // Redirects the whole page to Dropbox — nothing runs after this on success.
      await beginDropboxAuth();
    } catch (err) {
      setDropboxConnection({
        status: "error",
        message: err instanceof Error ? err.message : "Could not start connecting to Dropbox.",
      });
    }
  };

  const handleDisconnectDropbox = async () => {
    await disconnectDropbox();
    setDropboxConnection({ status: "disconnected" });
  };

  const addLocation = async () => {
    const label = window.prompt("New location name:");
    if (!label || !label.trim()) return;
    await locationsRepository.add(label.trim());
    onLabelsChanged();
  };

  const addTag = async () => {
    const label = window.prompt("New tag name:");
    if (!label || !label.trim()) return;
    await tagsRepository.add(label.trim());
    onLabelsChanged();
  };

  const editLocation = async (id: string) => {
    const current = locations.find((l) => l.id === id);
    const label = window.prompt("Rename location:", current?.label ?? "");
    if (!label || !label.trim()) return;
    await locationsRepository.update(id, label.trim());
    onLabelsChanged();
  };

  const editTag = async (id: string) => {
    const current = tags.find((t) => t.id === id);
    const label = window.prompt("Rename tag:", current?.label ?? "");
    if (!label || !label.trim()) return;
    await tagsRepository.update(id, label.trim());
    onLabelsChanged();
  };

  const deleteLocation = async (id: string) => {
    try {
      await locationsRepository.remove(id);
      onLabelsChanged();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete location.");
    }
  };

  const deleteTag = async (id: string) => {
    await tagsRepository.remove(id);
    onLabelsChanged();
  };

  const reorderLocations = async (ordered: SortableItem[]) => {
    await locationsRepository.reorder(ordered.map((item) => item.id));
    onLabelsChanged();
  };

  const reorderTags = async (ordered: SortableItem[]) => {
    await tagsRepository.reorder(ordered.map((item) => item.id));
    onLabelsChanged();
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card className="relative overflow-hidden">
            <Leaf size={64} className="pointer-events-none absolute -right-3 -top-3 rotate-12 text-sage-200" />
            <div className="relative flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-ink-900">Base Prefix</h2>
              <Info size={13} className="text-ink-400" />
            </div>
            <p className="relative mt-1 text-xs text-ink-500">
              This prefix will be used at the beginning of every renamed file.
            </p>
            <div className="relative mt-3 flex items-center justify-between rounded-xl border border-beige-300 bg-cream-50 px-3.5 py-2.5">
              <input
                value={prefix}
                maxLength={20}
                onChange={(e) => setPrefix(e.target.value)}
                onBlur={commitPrefix}
                className="w-full bg-transparent text-sm text-ink-900 outline-none"
              />
              <span className="shrink-0 pl-2 text-xs text-ink-400">{prefix.length} / 20</span>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-ink-900">Locations</h2>
                <Info size={13} className="text-ink-400" />
              </div>
              <Button variant="secondary" icon={<Plus size={14} />} onClick={addLocation} className="!px-3 !py-1.5 text-xs">
                Add Location
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              These locations will be used as part of your rename structure.
            </p>
            <div className="mt-3">
              <SortableSettingsList
                items={locations}
                onReorder={reorderLocations}
                onEdit={editLocation}
                onDelete={deleteLocation}
              />
            </div>
            <p className="mt-2 text-xs text-ink-400">Tip: Drag to reorder locations.</p>
          </Card>

          <Card>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-ink-900">Numbering</h2>
              <Info size={13} className="text-ink-400" />
            </div>
            <p className="mt-1 text-xs text-ink-500">Configure how sequence numbers are generated.</p>
            <div className="mt-3 flex items-end gap-6">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-ink-700">Number Width</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={numberWidth}
                  onChange={(e) => commitNumberWidth(Number(e.target.value))}
                  className="w-full rounded-xl border border-beige-300 bg-cream-50 px-3.5 py-2.5 text-sm text-ink-900 outline-none"
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-ink-700">Preview</span>
                <div className="rounded-xl bg-sage-100 px-4 py-2.5 text-center font-mono text-sm font-semibold text-forest-700">
                  {preview}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-400">Sequence will increment for each photo.</p>
          </Card>

          <Card>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-ink-900">Log Retention</h2>
              <Info size={13} className="text-ink-400" />
            </div>
            <p className="mt-1 text-xs text-ink-500">NLC Photo Renamer keeps a limited history of your rename batches.</p>
            <div className="mt-3 rounded-xl bg-sage-100 px-4 py-3 text-sm text-forest-700">
              <Leaf size={14} className="mr-1.5 inline-block -translate-y-0.5 text-sage-500" />
              Keep the last <strong>{settings.logRetentionDays} days</strong> or{" "}
              <strong>{settings.logRetentionMinBatches} batches</strong>, whichever is more.
            </div>
            <p className="mt-2 text-xs text-ink-400">Old logs beyond this setting will be automatically removed.</p>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-ink-900">Optional Tags</h2>
                <Info size={13} className="text-ink-400" />
              </div>
              <Button variant="secondary" icon={<Plus size={14} />} onClick={addTag} className="!px-3 !py-1.5 text-xs">
                Add Tag
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-500">Tags help you categorize photos. They are optional in the rename.</p>
            <div className="mt-3">
              <SortableSettingsList items={tags} onReorder={reorderTags} onEdit={editTag} onDelete={deleteTag} />
            </div>
            <p className="mt-2 text-xs text-ink-400">Tip: Drag to reorder tags.</p>
          </Card>

          <Card>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-ink-900">Dropbox Connection</h2>
              <Info size={13} className="text-ink-400" />
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Connect your Dropbox account to browse and rename files. No credentials to manage — sign in with
              Dropbox and stay connected.
            </p>

            <div className="mt-3 rounded-xl border border-beige-300/70 bg-cream-50 px-3.5 py-3">
              {dropboxConnection.status === "loading" ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
                  <Loader2 size={14} className="animate-spin" />
                  Checking connection…
                </span>
              ) : dropboxConnection.status === "connected" ? (
                <div className="flex items-start gap-2">
                  <Cloud size={16} className="mt-0.5 shrink-0 text-forest-600" />
                  <span className="min-w-0 flex-1 text-xs font-medium text-forest-700">
                    Connected{dropboxConnection.name ? ` as ${dropboxConnection.name}` : ""}
                    {dropboxConnection.email && (
                      <span className="ml-1 block font-normal text-ink-500 sm:inline">
                        {dropboxConnection.email}
                      </span>
                    )}
                  </span>
                </div>
              ) : dropboxConnection.status === "error" ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" />
                  <span className="min-w-0 flex-1 break-words text-xs font-medium text-rose-600">
                    {dropboxConnection.message}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CloudOff size={16} className="shrink-0 text-ink-400" />
                  <span className="text-xs font-medium text-ink-500">Not connected.</span>
                </div>
              )}
            </div>

            <p className="mt-2 break-all text-[11px] text-ink-400">
              Redirect URI: <span className="font-mono">{configuredRedirectUri || "(not set)"}</span>
            </p>
            {redirectUriMissingSlash && (
              <p className="mt-1 flex items-start gap-1.5 text-[11px] font-medium text-gold-600">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>
                  This doesn't end with a slash. GitHub Pages project sites are served at a trailing-slash path
                  (e.g. .../repo-name/) — make sure VITE_DROPBOX_REDIRECT_URI and the redirect URI registered in
                  the Dropbox App Console both end with "/", exactly matching.
                </span>
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {dropboxConnection.status === "connected" ? (
                <>
                  <Button
                    variant="secondary"
                    icon={<Cloud size={14} />}
                    className="!px-3.5 !py-2 text-xs"
                    onClick={handleConnectDropbox}
                  >
                    Reconnect Dropbox
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<CloudOff size={14} />}
                    className="!px-3.5 !py-2 text-xs"
                    onClick={handleDisconnectDropbox}
                  >
                    Disconnect Dropbox
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  icon={
                    dropboxConnection.status === "connecting" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Cloud size={14} />
                    )
                  }
                  className="!px-3.5 !py-2 text-xs"
                  onClick={handleConnectDropbox}
                  disabled={dropboxConnection.status === "connecting"}
                >
                  {dropboxConnection.status === "connecting" ? "Connecting…" : "Connect Dropbox"}
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-1.5">
              <FolderCog size={14} className="text-sage-500" />
              <h2 className="text-sm font-semibold text-ink-900">Startup Folder</h2>
              <Info size={13} className="text-ink-400" />
            </div>
            <p className="mt-1 text-xs text-ink-500">Choose which Dropbox folder opens when the app starts.</p>

            <div className="mt-3 rounded-xl border border-beige-300/70 bg-cream-50 px-3.5 py-2.5">
              <p className="text-xs font-medium text-ink-700">Current default</p>
              <p className="mt-0.5 truncate font-mono text-xs text-ink-900">
                {settings.defaultStartupDropboxPath === null
                  ? "None set."
                  : describeDropboxPath(settings.defaultStartupDropboxPath)}
              </p>
            </div>

            <p className="mt-3 text-xs text-ink-500">
              Folder open right now: <span className="font-mono text-ink-700">{describeDropboxPath(currentDropboxPath)}</span>
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                className="!px-3.5 !py-2 text-xs"
                onClick={() => onSettingsSaved({ defaultStartupDropboxPath: currentDropboxPath })}
              >
                Use Current Folder
              </Button>
              <Button
                variant="secondary"
                className="!px-3.5 !py-2 text-xs"
                onClick={() => onSettingsSaved({ defaultStartupDropboxPath: null })}
                disabled={settings.defaultStartupDropboxPath === null}
              >
                Clear Default
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
