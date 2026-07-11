import { execute, genId, select } from "./db";
import type { LabelItem } from "./types";

type LabelKind = "locations" | "tags";

interface LabelRow {
  id: string;
  label: string;
  sort_order: number;
}

function mapRow(row: LabelRow): LabelItem {
  return { id: row.id, label: row.label, sortOrder: row.sort_order };
}

async function list(kind: LabelKind): Promise<LabelItem[]> {
  const rows = await select<LabelRow>(`SELECT id, label, sort_order FROM ${kind} ORDER BY sort_order ASC`);
  return rows.map(mapRow);
}

async function add(kind: LabelKind, label: string): Promise<LabelItem> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label cannot be empty.");
  const existing = await list(kind);
  const id = genId(kind === "locations" ? "loc" : "tag");
  const sortOrder = existing.length;
  await execute(`INSERT INTO ${kind} (id, label, sort_order) VALUES (?, ?, ?)`, [id, trimmed, sortOrder]);
  return { id, label: trimmed, sortOrder };
}

async function update(kind: LabelKind, id: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label cannot be empty.");
  await execute(`UPDATE ${kind} SET label = ? WHERE id = ?`, [trimmed, id]);
}

async function remove(kind: LabelKind, id: string): Promise<void> {
  const existing = await list(kind);
  if (kind === "locations" && existing.length <= 1) {
    throw new Error("At least one location is required — cannot delete the last one.");
  }
  await execute(`DELETE FROM ${kind} WHERE id = ?`, [id]);
  // keep sort_order dense after a deletion (sequential: the browser fallback
  // persists to IndexedDB after every write, and concurrent persists can race)
  const remaining = await list(kind);
  for (let index = 0; index < remaining.length; index++) {
    const item = remaining[index];
    if (item.sortOrder !== index) {
      await execute(`UPDATE ${kind} SET sort_order = ? WHERE id = ?`, [index, item.id]);
    }
  }
}

async function reorder(kind: LabelKind, orderedIds: string[]): Promise<void> {
  for (let index = 0; index < orderedIds.length; index++) {
    await execute(`UPDATE ${kind} SET sort_order = ? WHERE id = ?`, [index, orderedIds[index]]);
  }
}

export const locationsRepository = {
  list: () => list("locations"),
  add: (label: string) => add("locations", label),
  update: (id: string, label: string) => update("locations", id, label),
  remove: (id: string) => remove("locations", id),
  reorder: (orderedIds: string[]) => reorder("locations", orderedIds),
};

export const tagsRepository = {
  list: () => list("tags"),
  add: (label: string) => add("tags", label),
  update: (id: string, label: string) => update("tags", id, label),
  remove: (id: string) => remove("tags", id),
  reorder: (orderedIds: string[]) => reorder("tags", orderedIds),
};
