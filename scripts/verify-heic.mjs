#!/usr/bin/env node
// Dev verification for HEIC/HEIF support — the project has no test runner
// configured, so this bundles scripts/verify-heic.entry.ts with esbuild
// (already a transitive dep of vite) and runs it under Node. Run with:
//   node scripts/verify-heic.mjs
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dir = mkdtempSync(path.join(tmpdir(), "nlc-verify-heic-"));
const outfile = path.join(dir, "bundle.mjs");

try {
  await build({
    entryPoints: [path.join(repoRoot, "scripts/verify-heic.entry.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    plugins: [
      {
        // Only isSupportedImageFile/rawExtensionOf/buildPreviewFilename are
        // exercised here (all pure functions); dropboxService.ts imports
        // dropboxAuth -> dropboxAuthRepository -> db.ts, which has
        // Vite-only `?url`/wasm imports esbuild can't resolve standalone.
        // Redirect that one import to a stub — its exports are never
        // called by the code under test.
        name: "stub-dropbox-auth-repository",
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^\.\/dropboxAuthRepository$/ }, () => ({
            path: path.join(repoRoot, "scripts/stubs/dropboxAuthRepository.ts"),
          }));
        },
      },
    ],
  });

  await import(pathToFileURL(outfile).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
