import { describe, expect, it } from "vitest";
import {
  applySpecGraphCanvasLayoutOverrides,
  buildSpecGraphCanvasLayoutStorageKey,
  readSpecGraphCanvasLayoutOverrides,
  removeSpecGraphCanvasLayoutOverrides,
  upsertSpecGraphCanvasLayoutOverride,
  writeSpecGraphCanvasLayoutOverrides,
  SAMPLE_SPEC_GRAPH,
} from "../index";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const cloneSample = () => JSON.parse(JSON.stringify(SAMPLE_SPEC_GRAPH));

describe("buildSpecGraphCanvasLayoutStorageKey", () => {
  it("keeps the key stable for reordered graph payloads", () => {
    const reordered = cloneSample();
    reordered.graph.nodes = [...reordered.graph.nodes].reverse();
    reordered.graph.edges = [...reordered.graph.edges].reverse();

    expect(buildSpecGraphCanvasLayoutStorageKey(reordered)).toBe(
      buildSpecGraphCanvasLayoutStorageKey(SAMPLE_SPEC_GRAPH),
    );
  });

  it("changes the key when the graph shape changes", () => {
    const changed = cloneSample();
    changed.graph.edges = changed.graph.edges.slice(1);

    expect(buildSpecGraphCanvasLayoutStorageKey(changed)).not.toBe(
      buildSpecGraphCanvasLayoutStorageKey(SAMPLE_SPEC_GRAPH),
    );
  });
});

describe("SpecGraph canvas layout overrides", () => {
  it("applies local positions without mutating base nodes", () => {
    const nodes = [
      { id: "SG-SPEC-0001", position: { x: 0, y: 0 } },
      { id: "SG-SPEC-0002", position: { x: 360, y: 0 } },
    ];
    const positioned = applySpecGraphCanvasLayoutOverrides(nodes, {
      "SG-SPEC-0002": { x: 42, y: 84 },
    });

    expect(positioned[1].position).toEqual({ x: 42, y: 84 });
    expect(nodes[1].position).toEqual({ x: 360, y: 0 });
  });

  it("persists only valid overrides for current nodes", () => {
    const storage = new MemoryStorage();
    const key = "layout-key";
    const overrides = upsertSpecGraphCanvasLayoutOverride(
      {},
      "SG-SPEC-0002",
      { x: 42, y: 84 },
    );

    writeSpecGraphCanvasLayoutOverrides(storage, key, overrides);

    expect(readSpecGraphCanvasLayoutOverrides(storage, key, [
      "SG-SPEC-0001",
      "SG-SPEC-0002",
    ])).toEqual({
      "SG-SPEC-0002": { x: 42, y: 84 },
    });
    expect(readSpecGraphCanvasLayoutOverrides(storage, key, ["SG-SPEC-0001"])).toEqual({});
  });

  it("removes the persisted payload on reset", () => {
    const storage = new MemoryStorage();
    const key = "layout-key";
    writeSpecGraphCanvasLayoutOverrides(storage, key, {
      "SG-SPEC-0001": { x: 10, y: 20 },
    });

    removeSpecGraphCanvasLayoutOverrides(storage, key);

    expect(readSpecGraphCanvasLayoutOverrides(storage, key, ["SG-SPEC-0001"])).toEqual({});
  });
});
