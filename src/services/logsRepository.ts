import { execute, select } from "./db";
import { getSettings } from "./settingsRepository";
import type { BatchItemRecord, BatchRecord, BatchStatus, ItemResult, NewBatchItem } from "./types";

interface BatchRow {
  id: string;
  name: string;
  created_at: string;
  status: BatchStatus;
  folder_name: string;
  folder_path: string;
  location: string;
  location_group: string;
  tags: string;
  numbering_range: string;
  file_count: number;
}

interface BatchItemRow {
  id: number;
  batch_id: string;
  original_name: string;
  new_name: string;
  result: ItemResult;
  error: string | null;
}

function mapBatchRow(row: BatchRow): BatchRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    status: row.status,
    folderName: row.folder_name,
    folderPath: row.folder_path,
    location: row.location,
    locationGroup: row.location_group,
    tags: JSON.parse(row.tags) as string[],
    numberingRange: row.numbering_range,
    fileCount: row.file_count,
  };
}

function mapItemRow(row: BatchItemRow): BatchItemRecord {
  return {
    id: row.id,
    batchId: row.batch_id,
    originalName: row.original_name,
    newName: row.new_name,
    result: row.result,
    error: row.error,
  };
}

export async function listBatches(): Promise<BatchRecord[]> {
  const rows = await select<BatchRow>("SELECT * FROM batches ORDER BY created_at DESC");
  return rows.map(mapBatchRow);
}

export async function getBatchItems(batchId: string): Promise<BatchItemRecord[]> {
  const rows = await select<BatchItemRow>(
    "SELECT * FROM batch_items WHERE batch_id = ? ORDER BY id ASC",
    [batchId],
  );
  return rows.map(mapItemRow);
}

export async function createBatch(
  batch: Omit<BatchRecord, "tags"> & { tags: string[] },
  items: NewBatchItem[],
): Promise<BatchRecord> {
  await execute(
    `INSERT INTO batches
       (id, name, created_at, status, folder_name, folder_path, location, location_group, tags, numbering_range, file_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.id,
      batch.name,
      batch.createdAt,
      batch.status,
      batch.folderName,
      batch.folderPath,
      batch.location,
      batch.locationGroup,
      JSON.stringify(batch.tags),
      batch.numberingRange,
      batch.fileCount,
    ],
  );

  for (const item of items) {
    await execute(
      `INSERT INTO batch_items (batch_id, original_name, new_name, result, error) VALUES (?, ?, ?, ?, ?)`,
      [batch.id, item.originalName, item.newName, item.result, item.error ?? null],
    );
  }

  return { ...batch };
}

export async function deleteAllBatches(): Promise<void> {
  await execute("DELETE FROM batch_items");
  await execute("DELETE FROM batches");
}

export async function deleteBatch(id: string): Promise<void> {
  await execute("DELETE FROM batch_items WHERE batch_id = ?", [id]);
  await execute("DELETE FROM batches WHERE id = ?", [id]);
}

/**
 * Keep the most recent `logRetentionMinBatches` batches no matter their age,
 * and otherwise drop anything older than `logRetentionDays`.
 */
export async function applyRetention(): Promise<number> {
  const settings = await getSettings();
  const rows = await select<{ id: string; created_at: string }>(
    "SELECT id, created_at FROM batches ORDER BY created_at DESC",
  );

  const keepIds = new Set(rows.slice(0, settings.logRetentionMinBatches).map((r) => r.id));
  const cutoff = Date.now() - settings.logRetentionDays * 24 * 60 * 60 * 1000;

  let deleted = 0;
  for (const row of rows) {
    if (keepIds.has(row.id)) continue;
    if (new Date(row.created_at).getTime() < cutoff) {
      await deleteBatch(row.id);
      deleted += 1;
    }
  }
  return deleted;
}
