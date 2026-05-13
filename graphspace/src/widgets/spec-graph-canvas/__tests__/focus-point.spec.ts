import { describe, expect, it } from "vitest";
import { getSpecGraphNodeFocusPoint } from "../model/focus-point";

describe("getSpecGraphNodeFocusPoint", () => {
  it("uses measured dimensions when React Flow has them", () => {
    expect(
      getSpecGraphNodeFocusPoint({
        position: { x: 360, y: 172 },
        measured: { width: 280, height: 120 },
      }),
    ).toEqual({ x: 500, y: 232 });
  });

  it("falls back to deterministic node dimensions before measurement", () => {
    expect(
      getSpecGraphNodeFocusPoint({
        position: { x: 720, y: 344 },
      }),
    ).toEqual({ x: 830, y: 400 });
  });
});
