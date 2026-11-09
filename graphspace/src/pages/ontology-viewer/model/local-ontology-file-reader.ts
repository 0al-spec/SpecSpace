import type { LocalOntologyArtifactFile } from "./local-ontology-artifact";
import { localOntologyLimits, type LocalOntologyLimits } from "./local-ontology-limits";

/** Reject oversized selections before reading; read each file only once. */
export async function readLocalOntologyFiles(
  input: Iterable<File>,
  limits: LocalOntologyLimits = localOntologyLimits,
): Promise<LocalOntologyArtifactFile[]> {
  const files = [...input];
  if (files.length > limits.maxFiles) {
    throw new Error(`Too many files; select at most ${limits.maxFiles}.`);
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (!Number.isSafeInteger(total) || total > limits.maxInputBytes) {
    throw new Error(`Selected files exceed the ${limits.maxInputBytes} byte input limit.`);
  }
  const result: LocalOntologyArtifactFile[] = [];
  const decoder = new TextDecoder();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = file.webkitRelativePath || file.name;
    const isZip = path.toLowerCase().endsWith(".zip");
    result.push({
      name: file.name,
      path,
      text: isZip ? "" : decoder.decode(bytes),
      ...(isZip ? { bytes } : {}),
    });
  }
  return result;
}
