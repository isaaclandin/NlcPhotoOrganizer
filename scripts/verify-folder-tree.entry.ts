/**
 * Regression coverage for the "organizational folders with no direct
 * photos disappear from the sidebar" bug: folder discovery (listFolderTree)
 * must never be influenced by whether a folder has supported images
 * directly inside it, must recurse past image-free intermediate folders,
 * and must paginate every level's listing fully.
 */
import { listFolderTree, collectFolderPaths, findFolderNode, refreshFolderNode } from "../src/services/dropboxService";
import type { FolderCrawlHandle } from "../src/services/dropboxService";
import type { FolderTreeNode, FolderChildrenStatus } from "../src/services/dropboxTypes";

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

/**
 * `flaky[path]` makes the mock return `status` (with an error_summary body)
 * for the first `failTimes` calls to that exact path's list_folder, then
 * fall through to real data — for testing retry-on-transient-error.
 */
interface FlakyPathState {
  failTimes: number;
  status: number;
}

/** `pages[path]` is an array of entry-arrays; if length > 1, the mock serves them across separate list_folder/continue calls to exercise pagination. Returns the exact `path` values received by list_folder, in call order, so tests can assert special characters/casing survive untouched. */
function installFetchMock(
  pages: Record<string, (RawFolder | RawFile)[][]>,
  flaky: Record<string, FlakyPathState> = {},
  /** `delays[path]` (ms) artificially slows that exact path's *initial* list_folder response — for simulating a deep/slow branch while other branches resolve fast, to verify progressive rendering doesn't block on the slowest branch. */
  delays: Record<string, number> = {},
) {
  const cursorState = new Map<string, { path: string; pageIndex: number }>();
  const receivedPaths: string[] = [];
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
      const path = String(body.path ?? "");
      receivedPaths.push(path);

      const delayMs = delays[path.toLowerCase()];
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));

      const flakyState = flaky[path.toLowerCase()];
      if (flakyState && flakyState.failTimes > 0) {
        flakyState.failTimes -= 1;
        return jsonResponse({ error_summary: "internal_error/.." }, flakyState.status);
      }

      const pageList = pages[path.toLowerCase()];
      if (!pageList) return jsonResponse({ error_summary: "path/not_found/.." }, 409);
      const entries = pageList[0] ?? [];
      const hasMore = pageList.length > 1;
      const cursor = `cursor-${cursorCounter++}`;
      if (hasMore) cursorState.set(cursor, { path: path.toLowerCase(), pageIndex: 1 });
      return jsonResponse({ entries, cursor, has_more: hasMore });
    }

    throw new Error(`Unexpected fetch() in verify-folder-tree: ${urlStr}`);
  }) as typeof fetch;

  return { receivedPaths };
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
// Scenario 4 — Root/Base/SubfolderA/{ChildFolderA1, ChildFolderA2},
//              Root/Base/SubfolderB/{ChildFolderB1}
// The exact structure from the live bug report: depth-2 folders (SubfolderA,
// SubfolderB) visible, but their depth-3 children were missing with an
// error icon. ChildFolderA1 has a photo; the rest don't.
// ---------------------------------------------------------------------------
{
  const BASE = "/base";
  const SUB_A = `${BASE}/subfoldera`;
  const SUB_B = `${BASE}/subfolderb`;
  const CHILD_A1 = `${SUB_A}/childfoldera1`;
  const CHILD_A2 = `${SUB_A}/childfoldera2`;
  const CHILD_B1 = `${SUB_B}/childfolderb1`;

  installFetchMock({
    "": singlePage("", ["Base"]),
    [BASE]: singlePage(BASE, ["SubfolderA", "SubfolderB"]),
    [SUB_A]: singlePage(SUB_A, ["ChildFolderA1", "ChildFolderA2"]),
    [SUB_B]: singlePage(SUB_B, ["ChildFolderB1"]),
    [CHILD_A1]: singlePage(CHILD_A1, [], ["photo.jpg"]),
    [CHILD_A2]: singlePage(CHILD_A2, []),
    [CHILD_B1]: singlePage(CHILD_B1, []),
  });

  const tree = await listFolderTree("");
  const allPaths = collectFolderPaths(tree);

  for (const p of [BASE, SUB_A, SUB_B, CHILD_A1, CHILD_A2, CHILD_B1]) {
    assertTrue(`Scenario 4: tree contains ${p}`, allPaths.includes(p), `not found in [${allPaths.join(", ")}]`);
  }

  function hasAnyError(node: FolderTreeNode): boolean {
    return Boolean(node.error) || node.children.some(hasAnyError);
  }
  assertTrue("Scenario 4: no error state anywhere in the tree", !hasAnyError(tree));
  assertEqual("Scenario 4: ChildFolderA1.directImageCount", findFolderNode(tree, CHILD_A1)?.directImageCount, 1);
}

// ---------------------------------------------------------------------------
// Scenario 5 — same shape as Scenario 4, but every folder has zero images.
// ---------------------------------------------------------------------------
{
  const BASE = "/base5";
  const SUB_A = `${BASE}/subfoldera`;
  const SUB_B = `${BASE}/subfolderb`;
  const CHILD_A1 = `${SUB_A}/childfoldera1`;
  const CHILD_A2 = `${SUB_A}/childfoldera2`;
  const CHILD_B1 = `${SUB_B}/childfolderb1`;

  installFetchMock({
    "": singlePage("", ["Base5"]),
    [BASE]: singlePage(BASE, ["SubfolderA", "SubfolderB"]),
    [SUB_A]: singlePage(SUB_A, ["ChildFolderA1", "ChildFolderA2"]),
    [SUB_B]: singlePage(SUB_B, ["ChildFolderB1"]),
    [CHILD_A1]: singlePage(CHILD_A1, []),
    [CHILD_A2]: singlePage(CHILD_A2, []),
    [CHILD_B1]: singlePage(CHILD_B1, []),
  });

  const tree = await listFolderTree("");
  const allPaths = collectFolderPaths(tree);

  for (const p of [BASE, SUB_A, SUB_B, CHILD_A1, CHILD_A2, CHILD_B1]) {
    assertTrue(`Scenario 5: tree contains ${p} (zero-image folders still appear)`, allPaths.includes(p));
  }
  for (const p of [BASE, SUB_A, SUB_B, CHILD_A1, CHILD_A2, CHILD_B1]) {
    const node = findFolderNode(tree, p);
    assertTrue(`Scenario 5: ${p} has no error`, !node?.error);
    assertEqual(`Scenario 5: ${p}.directImageCount is accurately 0`, node?.directImageCount, 0);
  }
}

// ---------------------------------------------------------------------------
// Scenario 6 — depth-3+ path with spaces, parentheses: exact Dropbox paths
// (not URL-encoded, not case-mangled beyond Dropbox's own lowercase
// convention) must be what's actually sent to list_folder.
//   Root/Marketing Photos/2026 Events/Summer Picnic (Edited)/Final Picks
// ---------------------------------------------------------------------------
{
  const L1 = "/marketing photos";
  const L2 = `${L1}/2026 events`;
  const L3 = `${L2}/summer picnic (edited)`;
  const L4 = `${L3}/final picks`;

  const mock = installFetchMock({
    "": singlePage("", ["Marketing Photos"]),
    [L1]: singlePage(L1, ["2026 Events"]),
    [L2]: singlePage(L2, ["Summer Picnic (Edited)"]),
    [L3]: singlePage(L3, ["Final Picks"]),
    [L4]: singlePage(L4, []),
  });

  const tree = await listFolderTree("");
  const allPaths = collectFolderPaths(tree);

  for (const p of [L1, L2, L3, L4]) {
    assertTrue(`Scenario 6: tree contains "${p}"`, allPaths.includes(p), `not found in [${allPaths.join(", ")}]`);
  }
  assertTrue(
    'Scenario 6: exact path with spaces/parens sent to list_folder for depth-3 folder',
    mock.receivedPaths.includes(L3),
    `receivedPaths: ${JSON.stringify(mock.receivedPaths)}`,
  );
  assertTrue(
    'Scenario 6: exact path sent to list_folder for depth-4 folder',
    mock.receivedPaths.includes(L4),
    `receivedPaths: ${JSON.stringify(mock.receivedPaths)}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario 7 — transient 429/5xx handling for a depth-3 folder.
// (a) Fails once (429), succeeds on the built-in retry -> no error, node
//     is fully populated, exactly as if it had never failed.
// (b) Fails every attempt -> error is visible with status/summary attached,
//     then the per-node refreshFolderNode "Retry" recovers it once the
//     mock stops failing.
// ---------------------------------------------------------------------------
{
  const BASE = "/flakybase";
  const SUB = `${BASE}/subfolder`;
  const FLAKY_ONCE = `${SUB}/recovers-after-one-429`;
  const FLAKY_ALWAYS = `${SUB}/always-429`;

  const flakyOnceState: FlakyPathState = { failTimes: 1, status: 429 };
  const alwaysFailState: FlakyPathState = { failTimes: 99, status: 429 };

  installFetchMock(
    {
      "": singlePage("", ["FlakyBase"]),
      [BASE]: singlePage(BASE, ["Subfolder"]),
      [SUB]: singlePage(SUB, ["Recovers-After-One-429", "Always-429"]),
      [FLAKY_ONCE]: singlePage(FLAKY_ONCE, ["Child"]),
      [`${FLAKY_ONCE}/child`]: singlePage(`${FLAKY_ONCE}/child`, []),
      [FLAKY_ALWAYS]: singlePage(FLAKY_ALWAYS, ["Child"]),
    },
    { [FLAKY_ONCE]: flakyOnceState, [FLAKY_ALWAYS]: alwaysFailState },
  );

  const tree = await listFolderTree("");

  const recoveredNode = findFolderNode(tree, FLAKY_ONCE);
  assertTrue("Scenario 7a: folder that failed once then succeeded has no error", !recoveredNode?.error);
  assertEqual("Scenario 7a: recovered folder still has its child", recoveredNode?.children.length, 1);

  const alwaysFailedNode = findFolderNode(tree, FLAKY_ALWAYS);
  assertTrue("Scenario 7b: folder that never recovers shows an error", Boolean(alwaysFailedNode?.error));
  assertEqual("Scenario 7b: error carries the HTTP status for diagnostics", alwaysFailedNode?.errorStatus, 429);
  assertTrue(
    "Scenario 7b: error carries a Dropbox error_summary for diagnostics",
    Boolean(alwaysFailedNode?.errorSummary),
  );
  assertEqual("Scenario 7b: failed folder has no children (fetch never succeeded)", alwaysFailedNode?.children.length, 0);

  // Now simulate the user clicking "Retry" on that node: the underlying
  // problem clears, and the per-node retry (not a whole-tree rebuild)
  // should bring it back clean.
  alwaysFailState.failTimes = 0;
  const retried = await refreshFolderNode(FLAKY_ALWAYS, alwaysFailedNode!.name, alwaysFailedNode!.pathDisplay, 3);
  assertTrue("Scenario 7b: after clearing the failure, per-node retry succeeds with no error", !retried.error);
  assertEqual("Scenario 7b: retried node now has its child folder", retried.children.length, 1);
}

// ---------------------------------------------------------------------------
// Scenario 8 — progressive rendering: root-level folders (and a fast
// sibling branch) must be reported via onNodeUpdate *before* a slow
// sibling branch's own listing finishes, instead of the whole crawl
// blocking on the slowest branch. This is the actual bug being fixed:
// previously nothing rendered until every one of ~900 requests resolved.
// ---------------------------------------------------------------------------
{
  const FAST = "/fastbranch";
  const FAST_LEAF = `${FAST}/fastleaf`;
  const SLOW = "/slowbranch";
  const SLOW_LEAF = `${SLOW}/slowleaf`;

  installFetchMock(
    {
      "": singlePage("", ["FastBranch", "SlowBranch"]),
      [FAST]: singlePage(FAST, ["FastLeaf"]),
      [FAST_LEAF]: singlePage(FAST_LEAF, []),
      [SLOW]: singlePage(SLOW, ["SlowLeaf"]),
      [SLOW_LEAF]: singlePage(SLOW_LEAF, []),
    },
    {},
    { [SLOW]: 40 }, // SlowBranch's own listing is artificially slow
  );

  // The parent's own "loaded" emission carries its children as immediate
  // stubs (childrenStatus "unknown") — that's the actual mechanism that
  // makes a folder "appear" in the sidebar right away, before its own
  // listing has even been fetched; there's no separate onNodeUpdate call
  // per stub, so we look inside root's "loaded" node for them.
  const updateLog: { path: string; node: FolderTreeNode }[] = [];
  const tree = await listFolderTree("", {
    onNodeUpdate: (path, node) => updateLog.push({ path, node }),
  });

  const rootLoadedEntry = updateLog.find((u) => u.path === "" && u.node.childrenStatus === "loaded");
  assertTrue("Scenario 8: root reports loaded (with stub children) via onNodeUpdate", Boolean(rootLoadedEntry));
  const fastStub = rootLoadedEntry?.node.children.find((c) => c.pathLower === FAST);
  const slowStub = rootLoadedEntry?.node.children.find((c) => c.pathLower === SLOW);
  assertEqual("Scenario 8: FastBranch appears as an unknown stub the instant root loads", fastStub?.childrenStatus, "unknown");
  assertEqual("Scenario 8: SlowBranch appears as an unknown stub the instant root loads", slowStub?.childrenStatus, "unknown");

  const rootLoadedIndex = updateLog.indexOf(rootLoadedEntry!);
  const fastBranchLoadedIndex = updateLog.findIndex((u) => u.path === FAST && u.node.childrenStatus === "loaded");
  const slowBranchLoadedIndex = updateLog.findIndex((u) => u.path === SLOW && u.node.childrenStatus === "loaded");
  assertTrue(
    "Scenario 8: both branches finish loading after root's own stub emission (never before it's known to exist)",
    fastBranchLoadedIndex > rootLoadedIndex && slowBranchLoadedIndex > rootLoadedIndex,
  );
  assertTrue(
    "Scenario 8: FastBranch finishes loading before SlowBranch (crawl doesn't block on the slow branch)",
    fastBranchLoadedIndex >= 0 && slowBranchLoadedIndex >= 0 && fastBranchLoadedIndex < slowBranchLoadedIndex,
  );

  // Final resolved tree is still fully correct once everything settles.
  const allPaths = collectFolderPaths(tree);
  for (const p of [FAST, FAST_LEAF, SLOW, SLOW_LEAF]) {
    assertTrue(`Scenario 8: final tree still contains ${p}`, allPaths.includes(p));
  }
}

// ---------------------------------------------------------------------------
// Scenario 9 — every node's childrenStatus visits unknown -> loading ->
// loaded/error in that relative order, and never gets stuck: a folder must
// not remain "loading" forever, and a zero-photo (but successfully listed)
// folder must resolve to "loaded", never "error".
// ---------------------------------------------------------------------------
{
  const EMPTY = "/emptybutok";
  installFetchMock({
    "": singlePage("", ["EmptyButOk"]),
    [EMPTY]: singlePage(EMPTY, []), // zero subfolders, zero images, succeeds
  });

  const statusesByPath = new Map<string, FolderChildrenStatus[]>();
  const updateLog: { path: string; node: FolderTreeNode }[] = [];
  await listFolderTree("", {
    onNodeUpdate: (path, node) => {
      updateLog.push({ path, node });
      const list = statusesByPath.get(path) ?? [];
      list.push(node.childrenStatus ?? "loaded");
      statusesByPath.set(path, list);
    },
  });

  const rootLoadedEntry = updateLog.find((u) => u.path === "" && u.node.childrenStatus === "loaded");
  const emptyStub = rootLoadedEntry?.node.children.find((c) => c.pathLower === EMPTY);
  assertEqual(
    "Scenario 9: EmptyButOk is visible as an unknown stub the instant root loads, before its own fetch runs",
    emptyStub?.childrenStatus,
    "unknown",
  );

  const rootStatuses = statusesByPath.get("") ?? [];
  assertEqual("Scenario 9: root's own status sequence is loading -> loaded", rootStatuses.join(","), "loading,loaded");

  const emptyStatuses = statusesByPath.get(EMPTY) ?? [];
  assertEqual(
    "Scenario 9: a zero-child, zero-image folder's own status sequence is loading -> loaded (never error, never stuck)",
    emptyStatuses.join(","),
    "loading,loaded",
  );
}

// ---------------------------------------------------------------------------
// Scenario 10 — a folder whose fetch fails transitions to "error" (not left
// hanging on "loading"), distinct from a folder that's merely empty.
// ---------------------------------------------------------------------------
{
  const BAD = "/willfail";
  installFetchMock(
    { "": singlePage("", ["WillFail"]) },
    { [BAD]: { failTimes: 99, status: 500 } },
  );

  const statusesByPath = new Map<string, FolderChildrenStatus[]>();
  const tree = await listFolderTree("", {
    onNodeUpdate: (path, node) => {
      const list = statusesByPath.get(path) ?? [];
      list.push(node.childrenStatus ?? "loaded");
      statusesByPath.set(path, list);
    },
  });

  const badStatuses = statusesByPath.get(BAD) ?? [];
  assertEqual("Scenario 10: failed node's own status sequence is loading -> error (never left stuck on loading)", badStatuses.join(","), "loading,error");
  const badNode = findFolderNode(tree, BAD);
  assertTrue("Scenario 10: failed node carries an error message distinct from 'no photos'", Boolean(badNode?.error));
}

// ---------------------------------------------------------------------------
// Scenario 11 — prioritize(): when the user navigates to (or expands) a
// folder that's still queued behind others under the concurrency limit,
// its fetch should jump to the front of the queue instead of waiting its
// turn, without disturbing the fetch that's already in flight.
// ---------------------------------------------------------------------------
{
  const A = "/a";
  const B = "/b";
  const C = "/c";

  const mock = installFetchMock(
    {
      "": singlePage("", ["A", "B", "C"]),
      [A]: singlePage(A, []),
      [B]: singlePage(B, []),
      [C]: singlePage(C, []),
    },
    {},
    // A stays "active" for a while so there's a real window in which B and
    // C are both queued (but not yet started) and prioritize(C) can still
    // change what runs next. Without this, an all-microtask race can
    // resolve the entire queue before a same-tick prioritize() call lands.
    { [A]: 20 },
  );

  let handle: FolderCrawlHandle | null = null;
  await listFolderTree("", {
    concurrency: 1, // force one fetch at a time so B/C's order is observable
    onCrawlHandle: (h) => {
      handle = h;
    },
    onNodeUpdate: (path, node) => {
      if (path === "" && node.childrenStatus === "loaded") {
        // By the time root itself is "loaded", A/B/C haven't been queued
        // yet (that happens synchronously right after this callback
        // returns) — deferring to a macrotask guarantees the queue is
        // populated (A active, B and C queued) before prioritizing C,
        // and A's own 20ms delay keeps it active long enough for this
        // macrotask to actually land before A finishes.
        setTimeout(() => handle?.prioritize(C), 0);
      }
    },
  });

  const bIndex = mock.receivedPaths.indexOf(B);
  const cIndex = mock.receivedPaths.indexOf(C);
  assertTrue("Scenario 11: both B and C were fetched", bIndex >= 0 && cIndex >= 0);
  assertTrue(
    "Scenario 11: prioritize(C) moved C ahead of B in fetch order despite C being queued behind B",
    cIndex < bIndex,
  );
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
