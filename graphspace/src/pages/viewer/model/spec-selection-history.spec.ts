import { describe, expect, it } from "vitest";
import {
  createSpecSelectionHistory,
  goBackSpecSelectionHistory,
  goForwardSpecSelectionHistory,
  pruneSpecSelectionHistory,
  pushSpecSelectionHistory,
} from "./spec-selection-history";

describe("spec selection history", () => {
  it("pushes previous selections and clears forward history", () => {
    let history = createSpecSelectionHistory();

    history = pushSpecSelectionHistory(history, null, "SG-SPEC-0001");
    expect(history).toEqual({ back: [], forward: [] });

    history = pushSpecSelectionHistory(history, "SG-SPEC-0001", "SG-SPEC-0002");
    expect(history).toEqual({ back: ["SG-SPEC-0001"], forward: [] });

    const back = goBackSpecSelectionHistory(history, "SG-SPEC-0002");
    expect(back.selectedNodeId).toBe("SG-SPEC-0001");
    expect(back.history).toEqual({ back: [], forward: ["SG-SPEC-0002"] });

    const changed = pushSpecSelectionHistory(
      back.history,
      "SG-SPEC-0001",
      "SG-SPEC-0003",
    );
    expect(changed).toEqual({ back: ["SG-SPEC-0001"], forward: [] });
  });

  it("restores forward selections without duplicating the current node", () => {
    const history = {
      back: ["SG-SPEC-0001"],
      forward: ["SG-SPEC-0003"],
    };

    const forward = goForwardSpecSelectionHistory(history, "SG-SPEC-0002");

    expect(forward.selectedNodeId).toBe("SG-SPEC-0003");
    expect(forward.history).toEqual({
      back: ["SG-SPEC-0001", "SG-SPEC-0002"],
      forward: [],
    });
  });

  it("does not push duplicate or missing current selections", () => {
    const history = pushSpecSelectionHistory(
      { back: ["SG-SPEC-0001"], forward: [] },
      "SG-SPEC-0001",
      "SG-SPEC-0001",
    );
    expect(history).toEqual({ back: ["SG-SPEC-0001"], forward: [] });

    const firstSelection = pushSpecSelectionHistory(history, null, "SG-SPEC-0002");
    expect(firstSelection).toEqual(history);
  });

  it("bounds history and prunes unavailable nodes", () => {
    let history = createSpecSelectionHistory();
    history = pushSpecSelectionHistory(history, "SG-SPEC-0001", "SG-SPEC-0002", 2);
    history = pushSpecSelectionHistory(history, "SG-SPEC-0002", "SG-SPEC-0003", 2);
    history = pushSpecSelectionHistory(history, "SG-SPEC-0003", "SG-SPEC-0004", 2);

    expect(history.back).toEqual(["SG-SPEC-0002", "SG-SPEC-0003"]);

    expect(
      pruneSpecSelectionHistory(
        { back: ["SG-SPEC-0001", "SG-SPEC-0002"], forward: ["SG-SPEC-0003"] },
        new Set(["SG-SPEC-0002"]),
      ),
    ).toEqual({ back: ["SG-SPEC-0002"], forward: [] });
  });

  it("skips unavailable nodes during traversal", () => {
    const back = goBackSpecSelectionHistory(
      { back: ["SG-SPEC-0001", "SG-SPEC-0002"], forward: [] },
      "SG-SPEC-0003",
      new Set(["SG-SPEC-0001", "SG-SPEC-0003"]),
    );

    expect(back.selectedNodeId).toBe("SG-SPEC-0001");
    expect(back.history).toEqual({
      back: [],
      forward: ["SG-SPEC-0003"],
    });

    const forward = goForwardSpecSelectionHistory(
      { back: [], forward: ["SG-SPEC-0004", "SG-SPEC-0005"] },
      "SG-SPEC-0003",
      new Set(["SG-SPEC-0003", "SG-SPEC-0004"]),
    );

    expect(forward.selectedNodeId).toBe("SG-SPEC-0004");
    expect(forward.history).toEqual({
      back: ["SG-SPEC-0003"],
      forward: [],
    });
  });
});
