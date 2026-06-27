import {
  projectOntologyNormalizedIr,
  type OntologyGraphProjection,
} from "./ontology-graph-contract";

export type LocalOntologyArtifactFile = {
  name: string;
  path: string;
  text: string;
  bytes?: Uint8Array;
};

export type LocalOntologyArtifactDiagnostic = {
  severity: "warning" | "error";
  code: string;
  message: string;
  path: string | null;
};

export type LocalOntologyPackageMetadata = {
  path: string;
  id: string | null;
  namespace: string | null;
  version: string | null;
  publisher: string | null;
  source: string | null;
  approvalStatus: string | null;
};

export type LocalOntologyPackageShape = {
  sourceFileCount: number;
  archiveFileCount: number;
  manifestPath: string | null;
  normalizedIrPath: string | null;
  packageMetadataPath: string | null;
  generatedFileCount: number;
  sdkFileCount: number;
  compatibilityArtifactCount: number;
  governanceArtifactCount: number;
};

type LocalOntologyViewerArchiveManifest = {
  path: string;
  package: {
    id: string | null;
    namespace: string | null;
    version: string | null;
  };
  artifacts: readonly {
    path: string;
    role: string;
    required: boolean;
  }[];
};

export type LocalOntologyArtifactLoadResult =
  | {
      kind: "loaded";
      projection: OntologyGraphProjection;
      diagnostics: readonly LocalOntologyArtifactDiagnostic[];
      packageMetadata: LocalOntologyPackageMetadata | null;
      packageShape: LocalOntologyPackageShape;
    }
  | {
      kind: "failed";
      diagnostics: readonly LocalOntologyArtifactDiagnostic[];
      packageMetadata: LocalOntologyPackageMetadata | null;
      packageShape: LocalOntologyPackageShape;
    };

function isNormalizedIrPath(path: string): boolean {
  return path === "ontology.normalized.json" || path.endsWith("/ontology.normalized.json");
}

function isPackageMetadataPath(path: string): boolean {
  return path === "domain-ontology-package.yaml" || path.endsWith("/domain-ontology-package.yaml");
}

function isGeneratedPath(path: string): boolean {
  return path.startsWith("generated/") || path.includes("/generated/");
}

function isSdkPath(path: string): boolean {
  return path.startsWith("generated/sdk/") || path.includes("/generated/sdk/");
}

function isCompatibilityPath(path: string): boolean {
  return path.includes("/compatibility/") || path.startsWith("compatibility/");
}

function isGovernancePath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes("governance") || lower.includes("decision") || lower.includes("approval");
}

function isZipPath(path: string): boolean {
  return path.toLowerCase().endsWith(".zip");
}

function isViewerArchiveManifestPath(path: string): boolean {
  return (
    path === "ontology-viewer-archive-manifest.json" ||
    path.endsWith("/ontology-viewer-archive-manifest.json") ||
    path === "ontology_viewer_archive_manifest.json" ||
    path.endsWith("/ontology_viewer_archive_manifest.json")
  );
}

function normalizeArchivePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/");
}

function isUnsafeArchivePath(path: string): boolean {
  return (
    path.length === 0 ||
    path.startsWith("/") ||
    /^[A-Za-z]:\//.test(path) ||
    path.split("/").includes("..")
  );
}

function byShortestPath(left: LocalOntologyArtifactFile, right: LocalOntologyArtifactFile) {
  return left.path.length - right.path.length || left.path.localeCompare(right.path);
}

export function selectOntologyNormalizedIrFile(
  files: readonly LocalOntologyArtifactFile[],
): LocalOntologyArtifactFile | null {
  const candidates = files
    .filter((file) => isNormalizedIrPath(file.path) || isNormalizedIrPath(file.name))
    .sort(byShortestPath);
  return candidates[0] ?? null;
}

export function selectDomainOntologyPackageFile(
  files: readonly LocalOntologyArtifactFile[],
): LocalOntologyArtifactFile | null {
  const candidates = files
    .filter((file) => isPackageMetadataPath(file.path) || isPackageMetadataPath(file.name))
    .sort(byShortestPath);
  return candidates[0] ?? null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function objectField(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseViewerArchiveManifest(
  file: LocalOntologyArtifactFile,
): LocalOntologyViewerArchiveManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text);
  } catch {
    return null;
  }

  const root = objectField(parsed);
  if (!root || root.artifact_kind !== "ontology_viewer_archive_manifest") return null;
  if (root.schema_version !== 1) return null;

  const packageObject = objectField(root.package) ?? {};
  const artifactRecords = Array.isArray(root.artifacts) ? root.artifacts : [];
  const artifacts = artifactRecords.flatMap((record): LocalOntologyViewerArchiveManifest["artifacts"][number][] => {
    const artifact = objectField(record);
    if (!artifact) return [];
    const path = stringField(artifact.path);
    const role = stringField(artifact.role);
    if (!path || !role) return [];
    return [
      {
        path,
        role,
        required: artifact.required === true,
      },
    ];
  });

  return {
    path: file.path,
    package: {
      id: stringField(packageObject.id),
      namespace: stringField(packageObject.namespace),
      version: stringField(packageObject.version),
    },
    artifacts,
  };
}

export function selectViewerArchiveManifest(
  files: readonly LocalOntologyArtifactFile[],
): {
  file: LocalOntologyArtifactFile;
  manifest: LocalOntologyViewerArchiveManifest;
} | null {
  const candidates = files
    .filter((file) => isViewerArchiveManifestPath(file.path) || isViewerArchiveManifestPath(file.name))
    .sort(byShortestPath);

  for (const file of candidates) {
    const manifest = parseViewerArchiveManifest(file);
    if (manifest) return { file, manifest };
  }

  for (const file of files.filter((file) => file.name.endsWith(".json") || file.path.endsWith(".json"))) {
    const manifest = parseViewerArchiveManifest(file);
    if (manifest) return { file, manifest };
  }

  return null;
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseDomainOntologyPackageMetadata(
  file: LocalOntologyArtifactFile,
): {
  metadata: LocalOntologyPackageMetadata | null;
  diagnostics: LocalOntologyArtifactDiagnostic[];
} {
  const values = new Map<string, string>();
  let inMetadata = false;
  let metadataIndent = 0;

  for (const rawLine of file.text.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, "");
    if (!withoutComment.trim()) continue;
    const indent = withoutComment.length - withoutComment.trimStart().length;
    const line = withoutComment.trim();

    if (line === "metadata:") {
      inMetadata = true;
      metadataIndent = indent;
      continue;
    }

    if (inMetadata && indent <= metadataIndent) {
      inMetadata = false;
    }

    if (!inMetadata) continue;

    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    values.set(key, unquoteYamlScalar(value));
  }

  const metadata: LocalOntologyPackageMetadata = {
    path: file.path,
    id: values.get("id") || null,
    namespace: values.get("namespace") || null,
    version: values.get("version") || null,
    publisher: values.get("publisher") || null,
    source: values.get("source") || null,
    approvalStatus: values.get("approvalStatus") || null,
  };

  if (!metadata.id && !metadata.namespace && !metadata.version) {
    return {
      metadata: null,
      diagnostics: [
        {
          severity: "warning",
          code: "package_metadata_unreadable",
          message:
            "domain-ontology-package.yaml was found, but its metadata block could not be read by the local viewer.",
          path: file.path,
        },
      ],
    };
  }

  return { metadata, diagnostics: [] };
}

function metadataFromManifest(
  manifest: LocalOntologyViewerArchiveManifest | null,
): LocalOntologyPackageMetadata | null {
  if (!manifest) return null;
  if (!manifest.package.id && !manifest.package.namespace && !manifest.package.version) {
    return null;
  }
  return {
    path: manifest.path,
    id: manifest.package.id,
    namespace: manifest.package.namespace,
    version: manifest.package.version,
    publisher: null,
    source: null,
    approvalStatus: null,
  };
}

function resolveRelativePath(basePath: string, relativePath: string): string | null {
  if (
    relativePath.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    relativePath.includes("\\")
  ) {
    return null;
  }

  const archiveSeparator = basePath.indexOf("!/");
  const archivePrefix = archiveSeparator >= 0 ? basePath.slice(0, archiveSeparator + 2) : "";
  const innerBase = archiveSeparator >= 0 ? basePath.slice(archiveSeparator + 2) : basePath;
  const baseParts = innerBase.split("/").slice(0, -1);
  const parts: string[] = [...baseParts];

  for (const part of relativePath.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return `${archivePrefix}${parts.join("/")}`;
}

function findManifestArtifactFile(
  files: readonly LocalOntologyArtifactFile[],
  manifest: LocalOntologyViewerArchiveManifest | null,
  role: string,
): LocalOntologyArtifactFile | null {
  if (!manifest) return null;
  const artifact = manifest.artifacts.find((item) => item.role === role);
  if (!artifact) return null;
  const resolvedPath = resolveRelativePath(manifest.path, artifact.path);
  if (!resolvedPath) return null;
  return files.find((file) => file.path === resolvedPath) ?? null;
}

function buildPackageShape(
  files: readonly LocalOntologyArtifactFile[],
  manifest: LocalOntologyViewerArchiveManifest | null,
  normalizedIr: LocalOntologyArtifactFile | null,
  metadataFile: LocalOntologyArtifactFile | null,
): LocalOntologyPackageShape {
  return {
    sourceFileCount: files.length,
    archiveFileCount: files.filter((file) => file.path.includes("!/")).length,
    manifestPath: manifest?.path ?? null,
    normalizedIrPath: normalizedIr?.path ?? null,
    packageMetadataPath: metadataFile?.path ?? null,
    generatedFileCount: files.filter((file) => isGeneratedPath(file.path)).length,
    sdkFileCount: files.filter((file) => isSdkPath(file.path)).length,
    compatibilityArtifactCount: files.filter((file) => isCompatibilityPath(file.path)).length,
    governanceArtifactCount: files.filter((file) => isGovernancePath(file.path)).length,
  };
}

function failedResult(
  diagnostics: readonly LocalOntologyArtifactDiagnostic[],
  packageMetadata: LocalOntologyPackageMetadata | null,
  packageShape: LocalOntologyPackageShape,
): LocalOntologyArtifactLoadResult {
  return {
    kind: "failed",
    diagnostics,
    packageMetadata,
    packageShape,
  };
}

export function loadLocalOntologyArtifact(
  files: readonly LocalOntologyArtifactFile[],
): LocalOntologyArtifactLoadResult {
  const manifestSelection = selectViewerArchiveManifest(files);
  const manifest = manifestSelection?.manifest ?? null;
  const normalizedIr =
    findManifestArtifactFile(files, manifest, "normalized_ir") ??
    selectOntologyNormalizedIrFile(files);
  const metadataFile =
    findManifestArtifactFile(files, manifest, "package_source") ??
    selectDomainOntologyPackageFile(files);
  const parsedMetadata = metadataFile
    ? parseDomainOntologyPackageMetadata(metadataFile)
    : { metadata: metadataFromManifest(manifest), diagnostics: [] };
  const packageShape = buildPackageShape(files, manifest, normalizedIr, metadataFile);
  const shapeDiagnostics: LocalOntologyArtifactDiagnostic[] = [];

  if (manifest) {
    const requiredMissing = manifest.artifacts
      .filter((artifact) => artifact.required)
      .filter((artifact) => {
        const resolved = resolveRelativePath(manifest.path, artifact.path);
        return !resolved || !files.some((file) => file.path === resolved);
      });
    for (const artifact of requiredMissing) {
      shapeDiagnostics.push({
        severity: "error",
        code: "viewer_manifest_required_artifact_missing",
        message: `${artifact.role} artifact ${artifact.path} declared by viewer manifest was not found.`,
        path: manifest.path,
      });
    }
  }

  if (!metadataFile && !manifest) {
    shapeDiagnostics.push({
      severity: "warning",
      code: "package_metadata_missing",
      message: "No domain-ontology-package.yaml file was found in the selected artifact.",
      path: null,
    });
  }

  if (packageShape.generatedFileCount === 0 && !manifest) {
    shapeDiagnostics.push({
      severity: "warning",
      code: "generated_folder_missing",
      message: "No generated/ compiler output folder was detected.",
      path: null,
    });
  }

  if (!normalizedIr) {
    return failedResult(
      [
        ...parsedMetadata.diagnostics,
        ...shapeDiagnostics,
        {
          severity: "error",
          code: "normalized_ir_missing",
          message: "No ontology.normalized.json file was found in the selected files.",
          path: null,
        },
      ],
      parsedMetadata.metadata,
      packageShape,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedIr.text);
  } catch {
    return failedResult(
      [
        ...parsedMetadata.diagnostics,
        ...shapeDiagnostics,
        {
          severity: "error",
          code: "normalized_ir_invalid_json",
          message: "ontology.normalized.json is not valid JSON.",
          path: normalizedIr.path,
        },
      ],
      parsedMetadata.metadata,
      packageShape,
    );
  }

  const projected = projectOntologyNormalizedIr(parsed, {
    sourceFiles: [
      {
        path: normalizedIr.path,
        role: "normalized_ir",
      },
    ],
  });
  if (projected.kind !== "ok") {
    return failedResult(
      [
        ...parsedMetadata.diagnostics,
        ...shapeDiagnostics,
        ...projected.issues.map((issue) => ({
          severity: "error" as const,
          code: "normalized_ir_shape_invalid",
          message: issue.message,
          path:
            issue.path.length > 0
              ? `${normalizedIr.path}#${issue.path.join(".")}`
              : normalizedIr.path,
        })),
      ],
      parsedMetadata.metadata,
      packageShape,
    );
  }

  return {
    kind: "loaded",
    projection: projected.data,
    diagnostics: [...parsedMetadata.diagnostics, ...shapeDiagnostics],
    packageMetadata: parsedMetadata.metadata,
    packageShape,
  };
}

export type LocalOntologyArchiveExpandResult = {
  files: readonly LocalOntologyArtifactFile[];
  diagnostics: readonly LocalOntologyArtifactDiagnostic[];
};

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not available");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function readZipEntries(
  file: LocalOntologyArtifactFile,
): Promise<LocalOntologyArchiveExpandResult> {
  const bytes = file.bytes;
  if (!bytes) {
    return {
      files: [],
      diagnostics: [
        {
          severity: "error",
          code: "zip_bytes_missing",
          message: "ZIP file bytes are unavailable for local archive import.",
          path: file.path,
        },
      ],
    };
  }

  const files: LocalOntologyArtifactFile[] = [];
  const diagnostics: LocalOntologyArtifactDiagnostic[] = [];
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = readUint32(bytes, offset);
    if (signature !== 0x04034b50) break;

    const flags = readUint16(bytes, offset + 6);
    const compressionMethod = readUint16(bytes, offset + 8);
    const compressedSize = readUint32(bytes, offset + 18);
    const fileNameLength = readUint16(bytes, offset + 26);
    const extraLength = readUint16(bytes, offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (flags & 0x08) {
      diagnostics.push({
        severity: "error",
        code: "zip_data_descriptor_unsupported",
        message: "ZIP archives using data descriptors are not supported by this local viewer.",
        path: file.path,
      });
      break;
    }

    if (nameEnd > bytes.length || dataEnd > bytes.length) {
      diagnostics.push({
        severity: "error",
        code: "zip_entry_truncated",
        message: "ZIP archive ended before an entry could be read.",
        path: file.path,
      });
      break;
    }

    const entryPath = normalizeArchivePath(decoder.decode(bytes.slice(nameStart, nameEnd)));
    const entryBytes = bytes.slice(dataStart, dataEnd);
    offset = dataEnd;

    if (!entryPath || entryPath.endsWith("/")) continue;

    if (isUnsafeArchivePath(entryPath)) {
      diagnostics.push({
        severity: "warning",
        code: "zip_entry_unsafe_path",
        message: `${entryPath} was skipped because archive paths must be relative and stay inside the archive.`,
        path: `${file.path}!/${entryPath}`,
      });
      continue;
    }

    let textBytes: Uint8Array;
    if (compressionMethod === 0) {
      textBytes = entryBytes;
    } else if (compressionMethod === 8) {
      try {
        textBytes = await inflateRaw(entryBytes);
      } catch {
        diagnostics.push({
          severity: "error",
          code: "zip_deflate_unavailable",
          message:
            "A deflated ZIP entry could not be decompressed in this browser environment.",
          path: `${file.path}!/${entryPath}`,
        });
        continue;
      }
    } else {
      diagnostics.push({
        severity: "warning",
        code: "zip_entry_compression_unsupported",
        message: `${entryPath} uses an unsupported ZIP compression method (${compressionMethod}).`,
        path: `${file.path}!/${entryPath}`,
      });
      continue;
    }

    files.push({
      name: entryPath.split("/").at(-1) ?? entryPath,
      path: `${file.path}!/${entryPath}`,
      text: decoder.decode(textBytes),
      bytes: textBytes,
    });
  }

  return { files, diagnostics };
}

export async function expandLocalOntologyArtifactFiles(
  files: readonly LocalOntologyArtifactFile[],
): Promise<LocalOntologyArchiveExpandResult> {
  const expandedFiles: LocalOntologyArtifactFile[] = [];
  const diagnostics: LocalOntologyArtifactDiagnostic[] = [];

  for (const file of files) {
    expandedFiles.push(file);
    if (!isZipPath(file.path) && !isZipPath(file.name)) continue;

    const expanded = await readZipEntries(file);
    expandedFiles.push(...expanded.files);
    diagnostics.push(...expanded.diagnostics);

    if (expanded.files.length === 0 && expanded.diagnostics.length === 0) {
      diagnostics.push({
        severity: "warning",
        code: "zip_archive_empty",
        message: "ZIP archive did not contain readable files.",
        path: file.path,
      });
    }
  }

  return { files: expandedFiles, diagnostics };
}
