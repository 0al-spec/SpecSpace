import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseProductWorkspaceDecisions } from "./ui";

const golden = JSON.parse(readFileSync(new URL("./fixtures/golden.json", import.meta.url), "utf8"));
const asResponse = (value: Record<string, unknown>) => ({ ...value, status: "available", available: true });

describe("canonical Decision index", () => {
  it("accepts the shared v0.1 golden contract while keeping id and key distinct", () => {
    const parsed = parseProductWorkspaceDecisions(asResponse(golden));
    expect(parsed?.decisions.map(item => [item.id, item.key])).toEqual([
      ["01JQ4M8N7QAZP6Y4N2M8T5V9KS", "decision.zed"],
      ["01JQ4M8N7QAZP6Y4N2M8T5V9KR", "decision.alpha"],
    ]);
  });
  it("accepts an available empty index and rejects duplicate ids, keys, and unsafe refs", () => {
    expect(parseProductWorkspaceDecisions(asResponse({ ...golden, summary: { decision_count: 0 }, decisions: [] }))?.decisions).toEqual([]);
    const duplicateId = structuredClone(golden); duplicateId.decisions[1].id = duplicateId.decisions[0].id;
    expect(parseProductWorkspaceDecisions(asResponse(duplicateId))).toBeNull();
    const duplicateKey = structuredClone(golden); duplicateKey.decisions[1].key = duplicateKey.decisions[0].key;
    expect(parseProductWorkspaceDecisions(asResponse(duplicateKey))).toBeNull();
    const unsafe = structuredClone(golden); unsafe.decisions[0].source_ref = "specs/../../private.yaml";
    expect(parseProductWorkspaceDecisions(asResponse(unsafe))).toBeNull();
    const unavailable = { artifact_kind: golden.artifact_kind, schema_version: 1, contract_ref: golden.contract_ref, workspace_id: golden.workspace_id, status: "unavailable", available: false, decisions: [] };
    expect(parseProductWorkspaceDecisions(unavailable)?.available).toBe(false);
    const malformedStatus = structuredClone(golden); malformedStatus.decisions[0].status = "approved";
    expect(parseProductWorkspaceDecisions(asResponse(malformedStatus))).toBeNull();
    const badSources = structuredClone(golden); badSources.decisions[0].provenance.sources = [{ doc: "../../secret.md" }];
    expect(parseProductWorkspaceDecisions(asResponse(badSources))).toBeNull();
  });
});
