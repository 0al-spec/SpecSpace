import { describe, expect, it } from "vitest";
import {
  getSpecGraphEdgeEndpointBounds,
  getSpecGraphNodeFocusPoint,
} from "../model/focus-point";

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
    ).toEqual({ x: 830, y: 407 });
  });
});

describe("getSpecGraphEdgeEndpointBounds", () => {
  it("spans both endpoint nodes using measured dimensions", () => {
    expect(
      getSpecGraphEdgeEndpointBounds(
        {
          position: { x: 360, y: 172 },
          measured: { width: 280, height: 120 },
        },
        {
          position: { x: 860, y: 420 },
          measured: { width: 240, height: 100 },
        },
      ),
    ).toEqual({
      x: 360,
      y: 172,
      width: 740,
      height: 348,
    });
  });

  it("falls back to deterministic node dimensions before measurement", () => {
    expect(
      getSpecGraphEdgeEndpointBounds(
        { position: { x: 720, y: 344 } },
        { position: { x: 360, y: 172 } },
      ),
    ).toEqual({
      x: 360,
      y: 172,
      width: 580,
      height: 298,
    });
  });

  it("returns null when either endpoint is missing", () => {
    expect(
      getSpecGraphEdgeEndpointBounds({ position: { x: 360, y: 172 } }, null),
    ).toBeNull();
    expect(
      getSpecGraphEdgeEndpointBounds(undefined, {
        position: { x: 720, y: 344 },
      }),
    ).toBeNull();
  });
});
