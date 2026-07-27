#!/usr/bin/env node
// Regression test for nested Dropbox folder discovery — the project has no
// test runner configured, so this bundles scripts/verify-folder-tree.entry.ts
// with esbuild (already a transitive dep of vite) and runs it under Node,
// with global fetch mocked to simulate Dropbox's API (including pagination).
// Run with:
//   node scripts/verify-folder-tree.mjs
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dir = mkdtempSync(path.join(tmpdir(), "nlc-verify-folder-tree-"));
const outfile = path.join(dir, "bundle.mjs");

try {
  await build({
    entryPoints: [path.join(repoRoot, "scripts/verify-folder-tree.entry.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    plugins: [
      {
        // Only listFolderTree/listFolder/collectFolderPaths/findFolderNode
        // are exercised here. dropboxService.ts -> dropboxAuth.ts ->
        // dropboxAuthRepository.ts -> db.ts, which has Vite-only `?url`/wasm
        // imports esbuild can't resolve standalone. Redirect the auth
        // repository to a stub that hands back an already-valid fake access
        // token, so refreshAccessToken() never needs real IndexedDB or a
        // real network call — the test's own fetch mock handles the rest.
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
