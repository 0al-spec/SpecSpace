import {
  projectOntologyNormalizedIr,
  type OntologyGraphProjection,
} from "@/shared/ontology-graph-contract";

export type LocalOntologyArtifactFile = {
  name: string;
  path: string;
  text: string;
};

export type LocalOntologyArtifactDiagnostic = {
  severity: "warning" | "error";
  code: string;
  message: string;
  path: string | null;
};

export type LocalOntologyArtifactLoadResult =
  | {
      kind: "loaded";
      projection: OntologyGraphProjection;
      diagnostics: readonly LocalOntologyArtifactDiagnostic[];
    }
  | {
      kind: "failed";
      diagnostics: readonly LocalOntologyArtifactDiagnostic[];
    };

function isNormalizedIrPath(path: string): boolean {
  return path === "ontology.normalized.json" || path.endsWith("/ontology.normalized.json");
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

export function loadLocalOntologyArtifact(
  files: readonly LocalOntologyArtifactFile[],
): LocalOntologyArtifactLoadResult {
  const normalizedIr = selectOntologyNormalizedIrFile(files);
  if (!normalizedIr) {
    return {
      kind: "failed",
      diagnostics: [
        {
          severity: "error",
          code: "normalized_ir_missing",
          message: "No ontology.normalized.json file was found in the selected files.",
          path: null,
        },
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedIr.text);
  } catch {
    return {
      kind: "failed",
      diagnostics: [
        {
          severity: "error",
          code: "normalized_ir_invalid_json",
          message: "ontology.normalized.json is not valid JSON.",
          path: normalizedIr.path,
        },
      ],
    };
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
    return {
      kind: "failed",
      diagnostics: projected.issues.map((issue) => ({
        severity: "error",
        code: "normalized_ir_shape_invalid",
        message: issue.message,
        path:
          issue.path.length > 0
            ? `${normalizedIr.path}#${issue.path.join(".")}`
            : normalizedIr.path,
      })),
    };
  }

  return {
    kind: "loaded",
    projection: projected.data,
    diagnostics: [],
  };
}
