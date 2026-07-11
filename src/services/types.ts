export interface AppSettings {
  basePrefix: string;
  numberWidth: number;
  logRetentionDays: number;
  logRetentionMinBatches: number;
  dropboxAppKey: string;
  dropboxAppSecret: string;
  dropboxRefreshToken: string;
  /** Last Dropbox folder path browsed, "" = root. Restored on next launch. */
  lastDropboxPath: string;
}

export interface LabelItem {
  id: string;
  label: string;
  sortOrder: number;
}

export type BatchStatus = "Success" | "Partial" | "Failed";
export type ItemResult = "Success" | "Failed";

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
}

export interface BatchItemRecord {
  id: number;
  batchId: string;
  originalName: string;
  newName: string;
  result: ItemResult;
  error: string | null;
}

export interface NewBatchItem {
  originalName: string;
  newName: string;
  result: ItemResult;
  error?: string | null;
}
