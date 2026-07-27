/**
 * Regression coverage for the "organizational folders with no direct
 * photos disappear from the sidebar" bug: folder discovery (listFolderTree)
 * must never be influenced by whether a folder has supported images
 * directly inside it, must recurse past image-free intermediate folders,
 * and must paginate every level's listing fully.
 */
import { listFolderTree, collectFolderPaths, findFolderNode } from "../src/services/dropboxService";

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}
const checks: Check[] = [];

function assertTrue(name: string, cond: boolean, detail?: string) {
  checks.push({ name, pass: cond, detail: cond ? undefined : detail });
}
function assertEqual(name: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  checks.push({ name, pass, detail: pass ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
}

// --- Minimal Dropbox files/list_folder + list_folder/continue mock -------
// Keyed by lowercase path -> one or more "pages" of raw entries, so a
// specific folder can be made to paginate (has_more) while others don't.

interface RawFolder {
  ".tag": "folder";
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
}
interface RawFile {
  ".tag": "file";
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size: number;
  client_modified: string;
  server_modified: string;
}

function folderEntry(parentPath: string, name: string): RawFolder {
  const pathLower = `${parentPath}/${name}`.toLowerCase();
  return { ".tag": "folder", id: `id:${pathLower}`, name, path_lower: pathLower, path_display: `${parentPath}/${name}` };
}
function fileEntry(parentPath: string, name: string): RawFile {
  const pathLower = `${parentPath}/${name}`.toLowerCase();
  return {
    ".tag": "file",
    id: `id:${pathLower}`,
    name,
    path_lower: pathLower,
    path_display: `${parentPath}/${name}`,
    size: 100,
    client_modified: "2026-01-01T00:00:00Z",
    server_modified: "2026-01-01T00:00:00Z",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** `pages[path]` is an array of entry-arrays; if length > 1, the mock serves them across separate list_folder/continue calls to exercise pagination. */
function installFetchMock(pages: Record<string, (RawFolder | RawFile)[][]>) {
  const cursorState = new Map<string, { path: string; pageIndex: number }>();
  let cursorCounter = 0;

  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (urlStr.includes("/files/list_folder/continue")) {
      const state = cursorState.get(body.cursor);
      if (!state) return jsonResponse({ error_summary: "reset/.." }, 409);
      const pageList = pages[state.path] ?? [[]];
      const entries = pageList[state.pageIndex] ?? [];
      const hasMore = state.pageIndex + 1 < pageList.length;
      const nextCursor = `cursor-${cursorCounter++}`;
      if (hasMore) cursorState.set(nextCursor, { path: state.path, pageIndex: state.pageIndex + 1 });
      return jsonResponse({ entries, cursor: nextCursor, has_more: hasMore });
    }

    if (urlStr.includes("/files/list_folder")) {
      const path = String(body.path ?? "").toLowerCase();
      const pageList = pages[path];
      if (!pageList) return jsonResponse({ error_summary: "path/not_found/.." }, 409);
      const entries = pageList[0] ?? [];
      const hasMore = pageList.length > 1;
      const cursor = `cursor-${cursorCounter++}`;
      if (hasMore) cursorState.set(cursor, { path, pageIndex: 1 });
      return jsonResponse({ entries, cursor, has_more: hasMore });
    }

    throw new Error(`Unexpected fetch() in verify-folder-tree: ${urlStr}`);
  }) as typeof fetch;
}

function singlePage(path: string, subfolders: string[], files: string[] = []): (RawFolder | RawFile)[][] {
  return [[...subfolders.map((n) => folderEntry(path, n)), ...files.map((n) => fileEntry(path, n))]];
}

// ---------------------------------------------------------------------------
// Scenario 1 — Root/Level1/.../Level4/Level5_NoPhotos/Level6_NoPhotos/
//              Level7_WithPhotos/image001.jpg
// Level5 and Level6 have zero direct images but must still appear and must
// still be recursed into.
// ---------------------------------------------------------------------------
{
  const L4 = "/level1/level2/level3/level4";
  const L5 = `${L4}/level5_nophotos`;
  const L6 = `${L5}/level6_nophotos`;
  const L7 = `${L6}/level7_withphotos`;

  installFetchMock({
    "": singlePage("", ["Level1"]),
    "/level1": singlePage("/level1", ["Level2"]),
    "/level1/level2": singlePage("/level1/level2", ["Level3"]),
    "/level1/level2/level3": singlePage("/level1/level2/level3", ["Level4"]),
    [L4]: singlePage(L4, ["Level5_NoPhotos"]),
    [L5]: singlePage(L5, ["Level6_NoPhotos"]), // zero images directly here
    [L6]: singlePage(L6, ["Level7_WithPhotos"]), // zero images directly here
    [L7]: singlePage(L7, [], ["image001.jpg"]),
  });

  const tree = await listFolderTree("");
  const allPaths = collectFolderPaths(tree);

  for (const p of [L4, L5, L6, L7]) {
    assertTrue(`Scenario 1: tree contains ${p}`, allPaths.includes(p), `not found in [${allPaths.join(", ")}]`);
  }

  const level5Node = findFolderNode(tree, L5);
  assertTrue("Scenario 1: Level5_NoPhotos node exists despite 0 direct images", level5Node !== null);
  assertEqual("Scenario 1: Level5_NoPhotos.directImageCount", level5Node?.directImageCount, 0);
  assertEqual("Scenario 1: Level5_NoPhotos still has its child folder (Level6)", level5Node?.children.length, 1);

  const level6Node = findFolderNode(tree, L6);
  assertTrue("Scenario 1: Level6_NoPhotos node exists despite 0 direct images", level6Node !== null);
  assertEqual("Scenario 1: Level6_NoPhotos still has its child folder (Level7)", level6Node?.children.length, 1);

  const level7Node = findFolderNode(tree, L7);
  assertTrue("Scenario 1: Level7_WithPhotos node found", level7Node !== null);
  assertEqual("Scenario 1: Level7_WithPhotos.directImageCount", level7Node?.directImageCount, 1);
  assertEqual("Scenario 1: Level7_WithPhotos has no child folders (it's the leaf)", level7Node?.children.length, 0);
}

// ---------------------------------------------------------------------------
// Scenario 2 — Root/A_NoPhotos/B_NoPhotos/C_NoPhotos/D_NoPhotos, every
// folder image-free, D is a dead-end leaf with no children either.
// ---------------------------------------------------------------------------
{
  const A = "/a_nophotos";
  const B = `${A}/b_nophotos`;
  const C = `${B}/c_nophotos`;
  const D = `${C}/d_nophotos`;

  installFetchMock({
    "": singlePage("", ["A_NoPhotos"]),
    [A]: singlePage(A, ["B_NoPhotos"]),
    [B]: singlePage(B, ["C_NoPhotos"]),
    [C]: singlePage(C, ["D_NoPhotos"]),
    [D]: singlePage(D, []), // leaf: no subfolders, no images
  });

  const tree = await listFolderTree("");
  const allPaths = collectFolderPaths(tree);

  for (const p of [A, B, C, D]) {
    assertTrue(`Scenario 2: tree contains ${p}`, allPaths.includes(p), `not found in [${allPaths.join(", ")}]`);
  }

  const dNode = findFolderNode(tree, D);
  assertTrue("Scenario 2: D_NoPhotos node found (genuine leaf)", dNode !== null);
  assertEqual("Scenario 2: D_NoPhotos.directImageCount", dNode?.directImageCount, 0);
  assertEqual("Scenario 2: D_NoPhotos has no child folders", dNode?.children.length, 0);
}

// ---------------------------------------------------------------------------
// Scenario 3 — pagination: a folder's own listing spans two
// list_folder/continue pages; both pages' subfolders must end up in the
// tree (this is what actually enables level 5+ to appear on a real,
// larger Dropbox account where a single folder has many entries).
// ---------------------------------------------------------------------------
{
  installFetchMock({
    "": [[folderEntry("", "PageOneFolder")], [folderEntry("", "PageTwoFolder")]],
    "/pageonefolder": singlePage("/pageonefolder", []),
    "/pagetwofolder": singlePage("/pagetwofolder", []),
  });

  const tree = await listFolderTree("");
  const allPaths = collectFolderPaths(tree);
  assertTrue("Scenario 3: page 1 folder discovered", allPaths.includes("/pageonefolder"));
  assertTrue("Scenario 3: page 2 folder discovered (via list_folder/continue)", allPaths.includes("/pagetwofolder"));
}

// ---------------------------------------------------------------------------

for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} - ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
}
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${checks.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed.`);
