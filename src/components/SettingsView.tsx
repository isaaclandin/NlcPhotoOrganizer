import { useEffect, useState } from "react";
import { Info, Plus, Eye, EyeOff, Link2, CheckCircle2, AlertTriangle, Loader2, Leaf, FolderCog } from "lucide-react";
import Card from "./Card";
import Button from "./Button";
import SortableSettingsList from "./SortableSettingsList";
import type { SortableItem } from "./SortableSettingsList";
import { locationsRepository, tagsRepository } from "../services/labelsRepository";
import { testConnection } from "../services/dropboxService";
import type { AppSettings, LabelItem } from "../services/types";

/** "" is a valid, deliberately-chosen path (Dropbox root) — only null means "no folder selected". */
function describeDropboxPath(path: string): string {
  return path === "" ? "Dropbox root" : path;
}

type ConnectionState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; accountName: string; email: string }
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
  const [appKey, setAppKey] = useState(settings.dropboxAppKey);
  const [appSecret, setAppSecret] = useState(settings.dropboxAppSecret);
  const [refreshToken, setRefreshToken] = useState(settings.dropboxRefreshToken);
  const [showAppKey, setShowAppKey] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "idle" });

  // keep local editable copies in sync if settings are reloaded from elsewhere
  useEffect(() => setPrefix(settings.basePrefix), [settings.basePrefix]);
  useEffect(() => setNumberWidth(settings.numberWidth), [settings.numberWidth]);
  useEffect(() => setAppKey(settings.dropboxAppKey), [settings.dropboxAppKey]);
  useEffect(() => setAppSecret(settings.dropboxAppSecret), [settings.dropboxAppSecret]);
  useEffect(() => setRefreshToken(settings.dropboxRefreshToken), [settings.dropboxRefreshToken]);

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

  const commitDropboxField = (field: keyof AppSettings, value: string) => {
    if (value !== settings[field]) {
      onSettingsSaved({ [field]: value } as Partial<AppSettings>);
      // a prior "Connection successful" no longer reflects the edited credentials
      setConnectionState({ status: "idle" });
    }
  };

  const handleTestConnection = async () => {
    setConnectionState({ status: "testing" });
    const result = await testConnection();
    setConnectionState(
      result.ok
        ? { status: "success", accountName: result.accountName, email: result.email }
        : { status: "error", message: result.message },
    );
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
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
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
              <h2 className="text-sm font-semibold text-ink-900">Dropbox Credentials</h2>
              <Info size={13} className="text-ink-400" />
            </div>
            <p className="mt-1 text-xs text-ink-500">Use your Dropbox app credentials to access files.</p>

            <CredentialField
              label="App Key"
              value={appKey}
              visible={showAppKey}
              onToggle={() => setShowAppKey((v) => !v)}
              onChange={setAppKey}
              onBlur={() => commitDropboxField("dropboxAppKey", appKey)}
            />
            <CredentialField
              label="App Secret"
              value={appSecret}
              visible={showAppSecret}
              onToggle={() => setShowAppSecret((v) => !v)}
              onChange={setAppSecret}
              onBlur={() => commitDropboxField("dropboxAppSecret", appSecret)}
            />
            <CredentialField
              label="Refresh Token"
              value={refreshToken}
              visible={showRefreshToken}
              onToggle={() => setShowRefreshToken((v) => !v)}
              onChange={setRefreshToken}
              onBlur={() => commitDropboxField("dropboxRefreshToken", refreshToken)}
            />

            <div className="mt-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <Button
                variant="secondary"
                icon={connectionState.status === "testing" ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                className="!px-3.5 !py-2 text-xs"
                onClick={handleTestConnection}
                disabled={connectionState.status === "testing"}
              >
                {connectionState.status === "testing" ? "Testing…" : "Test Connection"}
              </Button>

              {connectionState.status === "success" ? (
                <span className="flex min-w-0 flex-1 items-start gap-1.5 text-xs font-medium text-forest-600">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  <span className="break-words">
                    Connection successful.
                    {connectionState.email && (
                      <span className="ml-1 font-normal text-ink-400">{connectionState.email}</span>
                    )}
                  </span>
                </span>
              ) : connectionState.status === "error" ? (
                <span className="flex min-w-0 flex-1 items-start gap-1.5 text-xs font-medium text-rose-600">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span className="break-words">{connectionState.message}</span>
                </span>
              ) : connectionState.status === "testing" ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
                  <Loader2 size={15} className="animate-spin" />
                  Testing…
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-400">Not tested yet.</span>
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

function CredentialField({
  label,
  value,
  visible,
  onToggle,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="mt-3">
      <label className="mb-1.5 block text-xs font-medium text-ink-700">{label}</label>
      <div className="flex items-center justify-between rounded-xl border border-beige-300 bg-cream-50 px-3.5 py-2.5">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Not set"
          className="w-full truncate bg-transparent font-mono text-sm text-ink-900 outline-none placeholder:font-sans placeholder:text-ink-400"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide" : "Show"}
          className="ml-2 shrink-0 text-ink-400 hover:text-ink-700"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}
