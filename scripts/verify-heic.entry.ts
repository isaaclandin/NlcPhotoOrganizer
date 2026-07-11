import { isSupportedImageFile, rawExtensionOf } from "../src/services/dropboxService";
import { buildPreviewFilename } from "../src/utils/naming";

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  checks.push({
    name,
    pass,
    detail: pass ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  });
}

// Detection — case-insensitive, both HEIC and HEIF.
check('isSupportedImageFile("IMG_1234.HEIC")', isSupportedImageFile("IMG_1234.HEIC"), true);
check('isSupportedImageFile("IMG_1234.heic")', isSupportedImageFile("IMG_1234.heic"), true);
check('isSupportedImageFile("IMG_1234.HEIF")', isSupportedImageFile("IMG_1234.HEIF"), true);
check('isSupportedImageFile("IMG_1234.heif")', isSupportedImageFile("IMG_1234.heif"), true);

// Pre-existing types must keep working.
for (const ext of ["jpg", "jpeg", "png", "tiff", "tif", "gif", "webp", "bmp"]) {
  check(`isSupportedImageFile("photo.${ext}")`, isSupportedImageFile(`photo.${ext}`), true);
}
check('isSupportedImageFile("notes.txt")', isSupportedImageFile("notes.txt"), false);

// Extension extraction preserves the original casing (used to build the
// renamed filename) while detection above stays case-insensitive.
check('rawExtensionOf("IMG_1234.HEIC")', rawExtensionOf("IMG_1234.HEIC"), "HEIC");
check('rawExtensionOf("IMG_1235.heif")', rawExtensionOf("IMG_1235.heif"), "heif");

// End-to-end: building the renamed filename must preserve extension casing.
check(
  "buildPreviewFilename preserves .HEIC casing",
  buildPreviewFilename({
    prefix: "NLC",
    location: "South",
    tags: ["Books"],
    sequence: 1,
    numberWidth: 5,
    extension: rawExtensionOf("IMG_1234.HEIC"),
  }),
  "NLC_South_Books_00001.HEIC",
);
check(
  "buildPreviewFilename preserves .heif casing",
  buildPreviewFilename({
    prefix: "NLC",
    location: "South",
    tags: ["Books"],
    sequence: 2,
    numberWidth: 5,
    extension: rawExtensionOf("IMG_1235.heif"),
  }),
  "NLC_South_Books_00002.heif",
);

for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} - ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
}

const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${checks.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed.`);
