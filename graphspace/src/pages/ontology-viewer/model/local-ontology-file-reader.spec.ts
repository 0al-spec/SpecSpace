import { describe, expect, it, vi } from "vitest";
import { readLocalOntologyFiles } from "./local-ontology-file-reader";
import { localOntologyLimits } from "./local-ontology-limits";

function fakeFile(name: string, content: string, size = content.length) {
  const bytes = new TextEncoder().encode(content);
  const read = vi.fn(() => Promise.resolve(bytes.buffer));
  return {
    file: { name, size, webkitRelativePath: "", arrayBuffer: read } as unknown as File,
    read,
  };
}

describe("local ontology file reader", () => {
  it("rejects the complete selection before reading any oversized input", async () => {
    const first = fakeFile("one.json", "one", 3);
    const second = fakeFile("two.zip", "two", 3);
    await expect(
      readLocalOntologyFiles([first.file, second.file], {
        ...localOntologyLimits,
        maxInputBytes: 5,
      }),
    ).rejects.toThrow("input limit");
    expect(first.read).not.toHaveBeenCalled();
    expect(second.read).not.toHaveBeenCalled();
    await expect(
      readLocalOntologyFiles([first.file, second.file], { ...localOntologyLimits, maxFiles: 1 }),
    ).rejects.toThrow("Too many files");
    expect(first.read).not.toHaveBeenCalled();
  });

  it("reads each file once and does not decode ZIP bytes as text", async () => {
    const json = fakeFile("ontology.graph.json", '{"ok":true}');
    const archive = fakeFile("example.ZIP", "binary");
    const loaded = await readLocalOntologyFiles([json.file, archive.file]);
    expect(loaded[0]).toMatchObject({ text: '{"ok":true}', name: "ontology.graph.json" });
    expect(loaded[0].bytes).toBeUndefined();
    expect(loaded[1].text).toBe("");
    expect(loaded[1].bytes).toEqual(new TextEncoder().encode("binary"));
    expect(json.read).toHaveBeenCalledTimes(1);
    expect(archive.read).toHaveBeenCalledTimes(1);
  });
});
