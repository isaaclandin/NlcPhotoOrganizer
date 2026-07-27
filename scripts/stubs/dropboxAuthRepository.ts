// Stub for scripts/verify-folder-tree.mjs — the real dropboxAuthRepository.ts
// imports db.ts, which has Vite-only `?url`/wasm imports esbuild can't
// resolve standalone. Returns an already-valid, made-up access token so
// dropboxAuth.ts's refreshAccessToken() short-circuits without a real
// network call or real IndexedDB. Not a real credential — never sent
// anywhere except the test's own mocked fetch.
export async function getDropboxAuthRecord() {
  return {
    refreshToken: "test-refresh-token",
    accessToken: "test-access-token",
    accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
    accountEmail: null,
    accountName: null,
  };
}

export async function saveDropboxAuthRecord() {
  return getDropboxAuthRecord();
}

export async function clearDropboxAuthRecord() {}
