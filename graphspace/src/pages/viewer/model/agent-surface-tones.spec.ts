import { describe, expect, it } from "vitest";
import { agentSurfaceTone } from "./agent-surface-tones";

describe("agentSurfaceTone", () => {
  it("marks elevated gap severities as actionable tones", () => {
    expect(agentSurfaceTone("critical")).toBe("danger");
    expect(agentSurfaceTone("high")).toBe("danger");
    expect(agentSurfaceTone("medium")).toBe("warn");
    expect(agentSurfaceTone("low")).toBe("warn");
  });

  it("keeps readiness statuses visually distinct from blockers", () => {
    expect(agentSurfaceTone("ready_for_handoff")).toBe("ok");
    expect(agentSurfaceTone("available")).toBe("ok");
    expect(agentSurfaceTone("valid")).toBe("ok");
    expect(agentSurfaceTone("V3_schema_valid")).toBe("ok");
    expect(agentSurfaceTone("observed")).toBe("ok");
    expect(agentSurfaceTone("missing_passport")).toBe("warn");
    expect(agentSurfaceTone("not_attempted")).toBe("warn");
    expect(agentSurfaceTone("policy_only")).toBe("warn");
    expect(agentSurfaceTone("boundary_only")).toBe("warn");
    expect(agentSurfaceTone("deferred")).toBe("warn");
    expect(agentSurfaceTone("draft")).toBe("neutral");
  });
});
