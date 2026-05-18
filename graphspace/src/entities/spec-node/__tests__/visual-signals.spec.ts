import { describe, expect, it } from "vitest";
import {
  formatSpecNodeGapLabel,
  formatSpecNodeMaturity,
  getSpecNodeMaturityPercent,
  getSpecNodeMaturityTone,
  getSpecNodeGapMarks,
  getSpecNodeStatusTone,
} from "../lib/visual-signals";
import type { SpecNode } from "../model/types";

describe("SpecNode visual signals", () => {
  it("maps known lifecycle-like spec statuses to stable tones", () => {
    expect(getSpecNodeStatusTone("linked")).toBe("linked");
    expect(getSpecNodeStatusTone("REVIEWED")).toBe("reviewed");
    expect(getSpecNodeStatusTone(" frozen ")).toBe("frozen");
    expect(getSpecNodeStatusTone("draft")).toBe("unknown");
    expect(getSpecNodeStatusTone(null)).toBe("unknown");
  });

  it("normalizes maturity into percentage labels and quality tones", () => {
    expect(getSpecNodeMaturityPercent(0.2)).toBe(20);
    expect(getSpecNodeMaturityPercent(0.795)).toBe(80);
    expect(getSpecNodeMaturityPercent(1.4)).toBe(100);
    expect(getSpecNodeMaturityPercent(-0.2)).toBe(0);
    expect(getSpecNodeMaturityPercent(null)).toBeNull();

    expect(getSpecNodeMaturityTone(0.49)).toBe("weak");
    expect(getSpecNodeMaturityTone(0.5)).toBe("medium");
    expect(getSpecNodeMaturityTone(0.795)).toBe("medium");
    expect(getSpecNodeMaturityTone(0.8)).toBe("strong");
    expect(getSpecNodeMaturityTone(null)).toBe("unknown");

    expect(formatSpecNodeMaturity(0.73)).toBe("73%");
    expect(formatSpecNodeMaturity(null)).toBeNull();
  });

  it("formats gap labels with zero and singular forms", () => {
    expect(formatSpecNodeGapLabel(0)).toBe("0 gaps");
    expect(formatSpecNodeGapLabel(1)).toBe("1 gap");
    expect(formatSpecNodeGapLabel(2)).toBe("2 gaps");
  });

  it("uses distinct short labels for gap marks", () => {
    const node = {
      evidence_gap: 1,
      input_gap: 2,
      execution_gap: 3,
    } as SpecNode;

    expect(getSpecNodeGapMarks(node).map((mark) => [mark.kind, mark.shortLabel])).toEqual([
      ["evidence", "EV"],
      ["input", "IN"],
      ["execution", "EX"],
    ]);
  });
});
