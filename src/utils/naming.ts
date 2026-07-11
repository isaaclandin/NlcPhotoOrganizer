export function sanitizeFilenamePart(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("_");
}

export function formatSequence(n: number, width: number): string {
  const clampedWidth = Math.max(1, Math.min(10, width));
  return String(Math.max(0, Math.trunc(n))).padStart(clampedWidth, "0");
}

export interface RenamePatternInput {
  prefix: string;
  location?: string | null;
  tags?: string[];
}

export function buildRenamePattern({ prefix, location, tags = [] }: RenamePatternInput): string[] {
  const parts = [prefix, location ?? "", ...tags]
    .map(sanitizeFilenamePart)
    .filter((part) => part.length > 0);
  return parts;
}

export interface PreviewFilenameInput extends RenamePatternInput {
  sequence: number;
  numberWidth: number;
  extension?: string;
}

export function buildPreviewFilename({
  prefix,
  location,
  tags = [],
  sequence,
  numberWidth,
  extension = "jpg",
}: PreviewFilenameInput): string {
  const parts = buildRenamePattern({ prefix, location, tags });
  const sequenceStr = formatSequence(sequence, numberWidth);
  const cleanExtension = extension.replace(/^\./, "");
  return `${[...parts, sequenceStr].join("_")}.${cleanExtension}`;
}
