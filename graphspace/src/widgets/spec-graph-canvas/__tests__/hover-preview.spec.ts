import { describe, expect, it } from "vitest";
import type { SpecNode } from "@/entities/spec-node";
import type { SpecNodeDetail } from "@/shared/spec-graph-contract";
import {
  buildSpecNodeHoverPreview,
  extractSpecNodeObjective,
  placeSpecNodeHoverPreview,
} from "../model/hover-preview";

const node = (overrides: Partial<SpecNode> = {}): SpecNode => ({
  node_id: "SG-SPEC-0001",
  file_name: "SG-SPEC-0001.yaml",
  title: "SpecGraph - The Executable Product Ontology",
  kind: "spec",
  status: "linked",
  maturity: 0.73,
  acceptance_count: 4,
  decisions_count: 2,
  evidence_gap: 1,
  input_gap: 0,
  execution_gap: 1,
  gap_count: 2,
  depends_on: [],
  refines: [],
  relates_to: [],
  diagnostics: [],
  ...overrides,
});

describe("buildSpecNodeHoverPreview", () => {
  it("uses specification.objective as the preview body", () => {
    const specNode = node();
    const detail = {
      id: "SG-SPEC-0001",
      specification: {
        objective:
          "Define the SpecGraph node model and the rules that make graph traversal stable.",
      },
    } satisfies SpecNodeDetail;

    expect(buildSpecNodeHoverPreview(specNode, detail)).toEqual({
      node: specNode,
      nodeId: "SG-SPEC-0001",
      title: "SpecGraph - The Executable Product Ontology",
      objectivePreview:
        "Define the SpecGraph node model and the rules that make graph traversal stable.",
      status: "linked",
      maturityPercent: 73,
      maturityLabel: "73%",
      gapLabel: "2 gaps",
    });
  });

  it("falls back to detail.objective and truncates to 80 visible characters", () => {
    const detail = {
      id: "SG-SPEC-0001",
      objective:
        "Keep hover previews lightweight enough for dense graph inspection without opening the inspector.",
    } satisfies SpecNodeDetail;

    const preview = buildSpecNodeHoverPreview(node({ maturity: null }), detail);

    expect(preview.objectivePreview).toBe(
      "Keep hover previews lightweight enough for dense graph inspection without ope...",
    );
    expect(preview.objectivePreview).toHaveLength(80);
    expect(preview.maturityPercent).toBeNull();
    expect(preview.maturityLabel).toBeNull();
  });

  it("normalizes empty objective values and gap labels", () => {
    expect(extractSpecNodeObjective({ id: "SG-SPEC-0001", specification: {} })).toBeNull();
    expect(
      extractSpecNodeObjective({
        id: "SG-SPEC-0001",
        specification: { objective: { text: "not a string" } },
      }),
    ).toBeNull();
    expect(buildSpecNodeHoverPreview(node({ gap_count: 0 })).gapLabel).toBe("0 gaps");
    expect(buildSpecNodeHoverPreview(node({ gap_count: 1 })).gapLabel).toBe("1 gap");
  });
});

describe("placeSpecNodeHoverPreview", () => {
  const size = { width: 280, height: 150 };
  const viewport = { width: 900, height: 600 };

  it("places the preview to the right of the node when there is room", () => {
    expect(
      placeSpecNodeHoverPreview(
        { left: 120, right: 340, top: 200, bottom: 312, width: 220, height: 112 },
        viewport,
        size,
      ),
    ).toEqual({ left: 350, top: 181, placement: "right" });
  });

  it("flips to the left near the right viewport edge", () => {
    expect(
      placeSpecNodeHoverPreview(
        { left: 640, right: 860, top: 200, bottom: 312, width: 220, height: 112 },
        viewport,
        size,
      ),
    ).toEqual({ left: 350, top: 181, placement: "left" });
  });

  it("uses bottom or top fallback when neither side has enough space", () => {
    expect(
      placeSpecNodeHoverPreview(
        { left: 140, right: 360, top: 120, bottom: 232, width: 220, height: 112 },
        { width: 400, height: 600 },
        size,
      ),
    ).toEqual({ left: 108, top: 242, placement: "bottom" });

    expect(
      placeSpecNodeHoverPreview(
        { left: 140, right: 360, top: 420, bottom: 532, width: 220, height: 112 },
        { width: 400, height: 600 },
        size,
      ),
    ).toEqual({ left: 108, top: 260, placement: "top" });
  });

  it("keeps coordinates non-negative when the viewport is smaller than the card", () => {
    expect(
      placeSpecNodeHoverPreview(
        { left: 20, right: 240, top: 18, bottom: 130, width: 220, height: 112 },
        { width: 240, height: 120 },
        size,
      ),
    ).toEqual({ left: 12, top: 12, placement: "top" });
  });
});
