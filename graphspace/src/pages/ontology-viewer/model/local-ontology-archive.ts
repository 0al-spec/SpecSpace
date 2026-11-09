import type {
  LocalOntologyArtifactDiagnostic,
  LocalOntologyArtifactFile,
  LocalOntologyArchiveExpandResult,
} from "./local-ontology-artifact";
import type { LocalOntologyLimits } from "./local-ontology-limits";

type ArchiveBudget = { bytes: number; entries: number };
type ZipHeader = {
  flags: number;
  method: number;
  expandedSize: number;
  nameStart: number;
  nameEnd: number;
  dataStart: number;
  dataEnd: number;
};
type Decoded =
  | { kind: "ok"; bytes: Uint8Array }
  | { kind: "diagnostic"; diagnostic: LocalOntologyArtifactDiagnostic };

function readUint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readHeader(bytes: Uint8Array, offset: number): ZipHeader | null {
  if (offset + 30 > bytes.length || readUint32(bytes, offset) !== 0x04034b50) return null;
  const nameStart = offset + 30;
  const nameEnd = nameStart + readUint16(bytes, offset + 26);
  const dataStart = nameEnd + readUint16(bytes, offset + 28);
  return {
    flags: readUint16(bytes, offset + 6),
    method: readUint16(bytes, offset + 8),
    expandedSize: readUint32(bytes, offset + 22),
    nameStart,
    nameEnd,
    dataStart,
    dataEnd: dataStart + readUint32(bytes, offset + 18),
  };
}

function diagnostic(
  code: string,
  message: string,
  path: string,
  severity: "warning" | "error" = "error",
): LocalOntologyArtifactDiagnostic {
  return { severity, code, message, path };
}

function headerError(
  header: ZipHeader,
  bytes: Uint8Array,
  path: string,
  budget: ArchiveBudget,
  limits: LocalOntologyLimits,
): LocalOntologyArtifactDiagnostic | null {
  if (header.flags & 0x08) {
    return diagnostic(
      "zip_data_descriptor_unsupported",
      "ZIP archives using data descriptors are not supported by this local viewer.",
      path,
    );
  }
  if (header.nameEnd > bytes.length || header.dataEnd > bytes.length) {
    return diagnostic(
      "zip_entry_truncated",
      "ZIP archive ended before an entry could be read.",
      path,
    );
  }
  budget.entries += 1;
  if (budget.entries > limits.maxArchiveEntries) {
    return diagnostic(
      "zip_entry_count_limit",
      `Selected archives exceed the ${limits.maxArchiveEntries} entry limit.`,
      path,
    );
  }
  if (
    header.expandedSize > Math.min(limits.maxEntryBytes, limits.maxExpandedBytes - budget.bytes)
  ) {
    return diagnostic(
      "zip_expanded_limit",
      "Selected archives exceed the expanded-size limit.",
      path,
    );
  }
  return null;
}

class ArchiveLimitError extends Error {}

async function inflateRaw(bytes: Uint8Array, maximum: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined")
    throw new Error("DecompressionStream is not available");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new ArchiveLimitError("An archive entry exceeds the available expanded-size limit.");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function decodeMember(
  header: ZipHeader,
  bytes: Uint8Array,
  available: number,
  path: string,
): Promise<Decoded> {
  let expanded: Uint8Array;
  switch (header.method) {
    case 0:
      if (bytes.byteLength > available) {
        return {
          kind: "diagnostic",
          diagnostic: diagnostic(
            "zip_expanded_limit",
            "Selected archives exceed the expanded-size limit.",
            path,
          ),
        };
      }
      expanded = bytes;
      break;
    case 8:
      try {
        expanded = await inflateRaw(bytes, available);
      } catch (error) {
        const limited = error instanceof ArchiveLimitError;
        return {
          kind: "diagnostic",
          diagnostic: diagnostic(
            limited ? "zip_expanded_limit" : "zip_deflate_unavailable",
            limited
              ? error.message
              : "A deflated ZIP entry could not be decompressed in this browser environment.",
            path,
          ),
        };
      }
      break;
    default:
      return {
        kind: "diagnostic",
        diagnostic: diagnostic(
          "zip_entry_compression_unsupported",
          `Entry uses an unsupported ZIP compression method (${header.method}).`,
          path,
          "warning",
        ),
      };
  }
  if (expanded.byteLength !== header.expandedSize) {
    return {
      kind: "diagnostic",
      diagnostic: diagnostic(
        "zip_entry_size_mismatch",
        "Archive entry does not match its declared uncompressed size.",
        path,
      ),
    };
  }
  return { kind: "ok", bytes: expanded };
}

/** Decompress using one shared budget across every archive in the selection. */
export async function readZipEntries(
  file: LocalOntologyArtifactFile,
  budget: ArchiveBudget,
  limits: LocalOntologyLimits,
): Promise<LocalOntologyArchiveExpandResult> {
  const bytes = file.bytes;
  if (!bytes) {
    return {
      files: [],
      diagnostics: [
        diagnostic(
          "zip_bytes_missing",
          "ZIP file bytes are unavailable for local archive import.",
          file.path,
        ),
      ],
    };
  }
  const files: LocalOntologyArtifactFile[] = [];
  const diagnostics: LocalOntologyArtifactDiagnostic[] = [];
  const decoder = new TextDecoder();
  let offset = 0;
  for (;;) {
    const header = readHeader(bytes, offset);
    if (!header) break;
    const error = headerError(header, bytes, file.path, budget, limits);
    if (error) {
      diagnostics.push(error);
      break;
    }
    const entryPath = decoder
      .decode(bytes.subarray(header.nameStart, header.nameEnd))
      .replaceAll("\\", "/")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");
    offset = header.dataEnd;
    if (!entryPath || entryPath.endsWith("/")) continue;
    const path = `${file.path}!/${entryPath}`;
    if (/^[A-Za-z]:\//.test(entryPath) || entryPath.split("/").includes("..")) {
      diagnostics.push(
        diagnostic(
          "zip_entry_unsafe_path",
          `${entryPath} was skipped because archive paths must be relative and stay inside the archive.`,
          path,
          "warning",
        ),
      );
      continue;
    }
    const available = Math.min(limits.maxEntryBytes, limits.maxExpandedBytes - budget.bytes);
    const result = await decodeMember(
      header,
      bytes.subarray(header.dataStart, header.dataEnd),
      available,
      path,
    );
    if (result.kind === "diagnostic") {
      diagnostics.push(result.diagnostic);
      if (result.diagnostic.severity === "error") break;
      continue;
    }
    budget.bytes += result.bytes.byteLength;
    files.push({
      name: entryPath.split("/").at(-1) ?? entryPath,
      path,
      text: decoder.decode(result.bytes),
    });
  }
  return { files, diagnostics };
}
