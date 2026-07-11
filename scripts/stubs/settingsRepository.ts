// Stand-in for src/services/settingsRepository.ts used only when bundling
// scripts/verify-heic.entry.ts for a plain-Node run. The real module pulls
// in db.ts's Vite-only `?url` wasm import, which esbuild can't resolve
// outside of Vite. Neither export is actually called by the code under
// test (isSupportedImageFile / rawExtensionOf / buildPreviewFilename are
// all pure), so these bodies are never reached.
export async function getSettings(): Promise<never> {
  throw new Error("getSettings() stub should not be called by verify-heic checks");
}

export async function updateSettings(): Promise<never> {
  throw new Error("updateSettings() stub should not be called by verify-heic checks");
}
