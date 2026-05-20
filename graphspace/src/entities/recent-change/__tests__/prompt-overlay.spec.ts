import { describe, expect, it } from "vitest";
import {
  buildPromptOverlayDetails,
  promptOverlayReasonLabel,
  shortHash,
  toneForPromptOverlay,
} from "../lib/prompt-overlay";
import type { PromptOverlayProvenance } from "@/shared/spec-graph-contract";

describe("prompt overlay activity helpers", () => {
  it("maps contract statuses to UI tones", () => {
    expect(toneForPromptOverlay("core")).toBe("neutral");
    expect(toneForPromptOverlay("enabled")).toBe("active");
    expect(toneForPromptOverlay("legacy_unknown")).toBe("muted");
    expect(toneForPromptOverlay("unsafe")).toBe("danger");
  });

  it("formats compact hashes without exposing empty values", () => {
    expect(shortHash(undefined)).toBeNull();
    expect(shortHash("")).toBeNull();
    expect(shortHash("abc123")).toBe("abc123");
    expect(shortHash("abcdef1234567890")).toBe("abcdef1...");
  });

  it("turns legacy reasons into readable detail copy", () => {
    expect(promptOverlayReasonLabel("missing_exact_run_link")).toBe("No exact run link");
    expect(promptOverlayReasonLabel("legacy_run_without_provenance")).toBe(
      "Legacy run without provenance",
    );
  });

  it("builds safe details without raw prompt text", () => {
    const provenance = {
      status: "unsafe",
      source_kind: "profile",
      display_label: "unsafe",
      run_id: "20260519T214802Z-SG-SPEC-0063-80e51a2c",
      drift_key: "profile|default|prompt|policy",
      core_prompt_overridden: true,
      prompt_profile_id: "default",
      prompt_extension_path: "tools/supervisor_prompts/default.md",
      prompt_extension_sha256: "e".repeat(64),
      policy_reference: {
        artifact_path: "tools/supervisor_prompt_policy.json",
        artifact_sha256: "p".repeat(64),
        version: 1,
      },
      unsafe_reasons: ["core_prompt_overridden", "raw_prompt_text_present"],
      prompt_text: "do not render",
    } as PromptOverlayProvenance & { prompt_text: string };

    const details = buildPromptOverlayDetails(provenance);

    expect(details.map((detail) => detail.value).join("\n")).not.toContain("do not render");
    expect(details).toContainEqual({
      label: "Core overridden",
      value: "true",
      tone: "danger",
    });
    expect(details).toContainEqual({
      label: "Run ID",
      value: "20260519T214802Z-SG-SPEC-0063-80e51a2c",
    });
    expect(details.find((detail) => detail.label === "Prompt SHA")?.value).toBe("eeeeeee...");
  });
});
