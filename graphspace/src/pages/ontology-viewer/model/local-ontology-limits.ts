/** Resource limits for one local import, shared across all selected archives. */
export type LocalOntologyLimits = {
  maxFiles: number;
  maxInputBytes: number;
  maxEntryBytes: number;
  maxExpandedBytes: number;
  maxArchiveEntries: number;
};

export const localOntologyLimits: LocalOntologyLimits = {
  maxFiles: 128,
  maxInputBytes: 64 * 1024 * 1024,
  maxEntryBytes: 32 * 1024 * 1024,
  maxExpandedBytes: 64 * 1024 * 1024,
  maxArchiveEntries: 512,
};
