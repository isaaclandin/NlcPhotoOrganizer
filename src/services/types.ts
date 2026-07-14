export interface AppSettings {
  basePrefix: string;
  numberWidth: number;
  logRetentionDays: number;
  logRetentionMinBatches: number;
  /** Last Dropbox folder path browsed, "" = root. Restored on next launch. */
  lastDropboxPath: string;
  /**
   * Explicit user-chosen startup folder, set via Settings' "Use Current
   * Folder". null = not set. "" = Dropbox root, deliberately chosen (distinct
   * from null so a saved root preference doesn't look unset). Takes priority
   * over lastDropboxPath on launch.
   */
  defaultStartupDropboxPath: string | null;
}

export interface LabelItem {
  id: string;
  label: string;
  sortOrder: number;
}

export type BatchStatus = "Success" | "Partial" | "Failed";
export type ItemResult = "Success" | "Failed";
export type BatchOperationType = "rename" | "undo";
/** none = never undone, partial = some items restored, complete = all restored. Rename batches only. */
export type UndoStatus = "none" | "partial" | "complete";

export interface BatchRecord {
  id: string;
  name: string;
  createdAt: string;
  status: BatchStatus;
  folderName: string;
  folderPath: string;
  location: string;
  locationGroup: string;
  tags: string[];
  numberingRange: string;
  fileCount: number;
  operationType: BatchOperationType;
  /** Set on an undo batch: the rename batch it reverses. */
  undoOfBatchId: string | null;
  /** Set on a rename batch once undone: the undo batch that reversed it. */
  undoneByBatchId: string | null;
  undoStatus: UndoStatus;
  undoneAt: string | null;
}

export interface BatchItemRecord {
  id: number;
  batchId: string;
  originalName: string;
  newName: string;
  /** Full Dropbox path this row moved from. */
  originalPath: string;
  /** Full Dropbox path this row moved to. */
  newPath: string;
  result: ItemResult;
  error: string | null;
}

export interface NewBatchItem {
  originalName: string;
  newName: string;
  originalPath: string;
  newPath: string;
  result: ItemResult;
  error?: string | null;
}
