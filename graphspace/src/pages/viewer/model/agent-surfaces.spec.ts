import { describe, expect, it } from "vitest";
import { parseAgentSurfaceIndex } from "./use-agent-surfaces";

const payload = {
  api_version: "v1",
  artifact_kind: "specspace_agent_surface_index",
  schema_version: 1,
  entry_count: 1,
  summary: {
    surface_count: 1,
    executor_backend_count: 1,
    missing_passport_count: 0,
    verification_gap_count: 1,
    verification_valid_count: 1,
    verification_invalid_count: 0,
    verification_unavailable_count: 0,
    runtime_enforcement_unknown_count: 0,
    runtime_enforcement_policy_only_count: 1,
    runtime_enforcement_boundary_only_count: 0,
    runtime_enforcement_deferred_count: 0,
    runtime_enforcement_evidence_count: 1,
    runtime_enforcement_evidence_passed_count: 1,
    runtime_enforcement_evidence_failed_count: 0,
    runtime_enforcement_evidence_missing_count: 0,
    agent_passport_cli_status: "available",
    handoff_status: "ready_for_handoff",
    next_gap: "review_handoff_packet",
  },
  handoff: {
    available: true,
    handoff_id: "external_consumer_handoff::specspace",
    handoff_status: "ready_for_handoff",
    review_state: "ready_for_review",
    next_gap: "review_handoff_packet",
    source_gap: "specspace_agent_surface_visibility",
    source_proposal_ids: ["0065", "0068"],
    artifact_contract: {
      paths: [
        "runs/supervisor_executor_adapter_index.json",
        "runs/agent_surface_index.json",
        "runs/known_agent_passport_index.json",
        "runs/agent_passport_verification_report.json",
        "runs/agent_verification_gap_index.json",
        "runs/agent_runtime_enforcement_evidence_index.json",
      ],
    },
    expected_consumer_behavior: ["show Agent Passport verification states"],
    evidence_contract: { artifact_kind: "external_consumer_evidence" },
    privacy_boundary: { raw_passport_material_forbidden: true },
  },
  entries: [
    {
      surface_id: "specgraph.executor.codex",
      title: "Codex executor backend",
      surface_type: "executor_backend",
      source: "supervisor_executor_adapter_index",
      source_proposal_ids: ["0056", "0059"],
      requires_passport: true,
      launches_agents: true,
      prepares_handoffs: false,
      passport_ref: "agent-passport://executors/codex-cli/0.1.0",
      verification_state: "V3_schema_valid",
      verification_status: "valid",
      verification_tool_status: "available",
      verification_valid: true,
      runtime_enforcement_state: "policy_only",
      runtime_enforcement_observed: false,
      next_action: "define_runtime_enforcement_runtime",
      executor_backend_id: "codex",
      backend_status: "missing_executable",
      runtime_environment: {
        producer_environment: "static_publish_environment",
        intended_environment: "local_operator_environment",
        executable_probe_scope: "current_process_environment",
        backend_status_semantics: "executable_not_available_in_current_process_environment",
        static_publish_executable_required: false,
        local_operator_executable_required: true,
        missing_executable_is_static_publish_gap: true,
        operator_next_action: "configure_local_operator_executable",
      },
      gap_count: 1,
      gaps: [
        {
          gap_id: "agent_gap::specgraph.executor.codex::runtime_enforcement",
          gap: "runtime_enforcement_policy_only",
          severity: "low",
          reason: "Runtime enforcement posture is known but policy-only.",
          next_action: "define_runtime_enforcement_runtime",
          source_proposal_ids: ["0059"],
        },
      ],
      runtime_enforcement_evidence_count: 1,
      runtime_enforcement_evidence: [
        {
          evidence_id: "agent_runtime_enforcement_evidence::specgraph.executor.codex::runtime_smoke",
          evidence_kind: "runtime_smoke",
          status: "passed",
          runtime_enforcement_state: "policy_only",
          posture_claim: "runtime_enforcement_policy_only",
          evidence_ref: "runs/agent_runtime_enforcement_evidence/codex-smoke.json",
          result_status: "passed",
          source_proposal_ids: ["0077"],
          detail_status: "available",
          detail_reason: "",
          checks: [
            {
              check_id: "executor_adapter_invocation_boundary",
              status: "passed",
              message: "Structured invocation boundary passed.",
            },
          ],
        },
      ],
    },
  ],
  executor_adapters: [
    {
      backend_id: "codex",
      display_name: "Codex CLI",
      backend_status: "missing_executable",
      authority_state: "default",
      runtime_environment: {
        producer_environment: "static_publish_environment",
        intended_environment: "local_operator_environment",
        executable_probe_scope: "current_process_environment",
        backend_status_semantics: "executable_not_available_in_current_process_environment",
        static_publish_executable_required: false,
        local_operator_executable_required: true,
        missing_executable_is_static_publish_gap: true,
        operator_next_action: "configure_local_operator_executable",
      },
      command_surface: "cli",
      protocol_contract: "run_outcome_blocker",
      passport_ref: "agent-passport://executors/codex-cli/0.1.0",
      passport_validation: {
        validation_state: "not_attempted",
        tool_status: "available",
      },
      smoke_status: "not_run",
      canonical_trial_allowed: false,
      safe_next_action: "run_executor_adapter_smoke_benchmark",
      capability_gap_count: 1,
    },
  ],
  sources: {
    agent_surfaces: {
      available: true,
      artifact: "runs/agent_surface_index.json",
      entry_count: 1,
    },
  },
};

describe("parseAgentSurfaceIndex", () => {
  it("parses ready SpecSpace handoff surfaces", () => {
    const parsed = parseAgentSurfaceIndex(payload);

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.handoff.handoffStatus).toBe("ready_for_handoff");
    expect(parsed.data.handoff.reviewState).toBe("ready_for_review");
    expect(parsed.data.summary.agentPassportCliStatus).toBe("available");
    expect(parsed.data.summary.verificationValidCount).toBe(1);
    expect(parsed.data.summary.runtimeEnforcementPolicyOnlyCount).toBe(1);
    expect(parsed.data.summary.runtimeEnforcementEvidencePassedCount).toBe(1);
    expect(parsed.data.handoff.expectedConsumerBehavior).toEqual(["show Agent Passport verification states"]);
    expect(parsed.data.entries[0]).toMatchObject({
      surfaceId: "specgraph.executor.codex",
      gapCount: 1,
      passportRef: "agent-passport://executors/codex-cli/0.1.0",
      verificationStatus: "valid",
      runtimeEnforcementState: "policy_only",
      nextAction: "define_runtime_enforcement_runtime",
      backendStatus: "missing_executable",
    });
    expect(parsed.data.entries[0].runtimeEnvironment).toMatchObject({
      producerEnvironment: "static_publish_environment",
      intendedEnvironment: "local_operator_environment",
      backendStatusSemantics: "executable_not_available_in_current_process_environment",
      missingExecutableIsStaticPublishGap: true,
      operatorNextAction: "configure_local_operator_executable",
    });
    expect(parsed.data.entries[0].gaps[0].nextAction).toBe("define_runtime_enforcement_runtime");
    expect(parsed.data.entries[0].runtimeEnforcementEvidence[0]).toMatchObject({
      evidenceKind: "runtime_smoke",
      status: "passed",
      evidenceRef: "runs/agent_runtime_enforcement_evidence/codex-smoke.json",
      detailStatus: "available",
    });
    expect(parsed.data.entries[0].runtimeEnforcementEvidence[0].checks[0]).toMatchObject({
      checkId: "executor_adapter_invocation_boundary",
      status: "passed",
      message: "Structured invocation boundary passed.",
    });
    expect(parsed.data.executorAdapters[0]).toMatchObject({
      backendId: "codex",
      backendStatus: "missing_executable",
      smokeStatus: "not_run",
    });
    expect(parsed.data.executorAdapters[0].runtimeEnvironment).toMatchObject({
      producerEnvironment: "static_publish_environment",
      intendedEnvironment: "local_operator_environment",
      missingExecutableIsStaticPublishGap: true,
    });
  });

  it("degrades optional collections without dropping the handoff", () => {
    const parsed = parseAgentSurfaceIndex({
      artifact_kind: "specspace_agent_surface_index",
      schema_version: 1,
      entry_count: 0,
      handoff: {
        available: false,
        handoff_status: "missing",
        review_state: "missing",
      },
      entries: "not-an-array",
      executor_adapters: null,
      sources: {},
    });

    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.data.entries).toEqual([]);
    expect(parsed.data.handoff.handoffStatus).toBe("missing");
  });

  it("rejects unexpected artifact kinds", () => {
    const parsed = parseAgentSurfaceIndex({
      artifact_kind: "metrics_source_promotion_index",
      schema_version: 1,
    });

    expect(parsed).toMatchObject({
      kind: "parse-error",
      reason: "unexpected agent surfaces artifact_kind",
    });
  });
});
