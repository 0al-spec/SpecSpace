import { expect, test, type Page, type Route } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ideaToSpecWorkspace } from "../src/pages/viewer/model/idea-to-spec-workspace.fixture";

const workspaceId = "team-decision-log";
const executionBackedWorkspaceId = "household-pantry-rotation";
const executionBackedRawIdea =
  "A household pantry rotation planner that tracks expiring food, shared shopping tasks, and meal-prep inventory gaps.";
const executionBackedPublicSummary = "Household pantry rotation planner";
const fullLifecycleRawIdea = executionBackedRawIdea;
const fullLifecyclePublicSummary = executionBackedPublicSummary;

test.describe.configure({ mode: "serial" });

type SpecSpaceBackend = {
  baseUrl: string;
  runsDir: string;
  stateDir: string;
  tmpRoot: string;
  stop: () => Promise<void>;
};

async function stopChildProcess(
  child: ChildProcessWithoutNullStreams,
  timeoutMs = 5_000,
) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
      finish();
    }, timeoutMs);
    child.once("exit", finish);
    child.kill("SIGTERM");
  });
}

type UiStartedIdeaScenario = {
  intakeExecutionPublished: boolean;
  answerContinuationPublished?: boolean;
  partialBlockingClarification?: boolean;
  blockedAnswerContinuationPublished?: boolean;
};

declare global {
  interface Window {
    __specspaceEmitRunsChange?: () => void;
  }
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repoPython = path.join(repoRoot, ".venv/bin/python");
const clarificationRequestId =
  "clarification.intake.question-active-frame-domain-refs";

type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address !== null) {
        const port = address.port;
        server.close(() => resolve(port));
        return;
      }
      server.close(() => reject(new Error("Could not allocate a TCP port")));
    });
  });
}

function executablePythonForSubprocess(baseDir: string): string {
  const configured = process.env.PYTHON;
  if (configured) {
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.join(repoRoot, configured);
    if (existsSync(resolved)) return resolved;
  }
  const baseVenv = path.join(baseDir, ".venv/bin/python");
  if (existsSync(baseVenv)) return baseVenv;
  if (existsSync(repoPython)) return repoPython;
  return "python3";
}

function platformCliInvocation(
  platformDir: string,
  platformScript: string,
  args: string[],
) {
  const uv = process.env.UV ?? "uv";
  return existsSync(path.join(platformDir, "requirements-dev.txt"))
    ? {
        command: uv,
        args: [
          "run",
          "--with-requirements",
          "requirements-dev.txt",
          "python",
          platformScript,
          ...args,
        ],
      }
    : {
        command: executablePythonForSubprocess(platformDir),
        args: [platformScript, ...args],
      };
}

async function waitForBackend(baseUrl: string, child: ChildProcessWithoutNullStreams) {
  const deadline = Date.now() + 10_000;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`SpecSpace backend exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`SpecSpace backend did not become ready: ${String(lastError)}`);
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk.toString("utf8")));
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve({ code, stdout: stdout.join(""), stderr: stderr.join("") });
    });
  });
}

async function startSpecSpaceBackend(options: {
  seedIntakeRuns?: boolean;
} = {}): Promise<SpecSpaceBackend> {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "specspace-ui-e2e-"));
  const dialogDir = path.join(tmpRoot, "dialogs");
  const stateDir = path.join(tmpRoot, "state");
  const runsDir = path.join(tmpRoot, "runs");
  await mkdir(dialogDir, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  if (options.seedIntakeRuns !== false) {
    await writeRealIdeaIntakeRuns(runsDir);
  } else {
    await mkdir(runsDir, { recursive: true });
  }
  const port = await freePort();
  const python = executablePythonForSubprocess(repoRoot);
  const child = spawn(
    python,
    [
      "viewer/server.py",
      "--port",
      String(port),
      "--dialog-dir",
      dialogDir,
      "--runs-dir",
      runsDir,
      "--specspace-state-dir",
      stateDir,
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stderr: string[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderr.push(chunk.toString("utf8"));
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForBackend(baseUrl, child);
  } catch (error) {
    await stopChildProcess(child);
    await rm(tmpRoot, { recursive: true, force: true });
    throw new Error(`${String(error)}\n${stderr.join("")}`);
  }
  return {
    baseUrl,
    runsDir,
    stateDir,
    tmpRoot,
    stop: async () => {
      await stopChildProcess(child);
      await rm(tmpRoot, { recursive: true, force: true });
    },
  };
}

async function writeJson(filePath: string, payload: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function writeRealIdeaIntakeRuns(runsDir: string) {
  await writeJson(path.join(runsDir, "idea_intake_clarification_requests.json"), {
    artifact_kind: "idea_to_spec_clarification_requests",
    schema_version: 1,
    proposal_id: "0186",
    contract_ref: "specgraph.idea-to-spec.clarification-requests.v0.1",
    canonical_mutations_allowed: false,
    tracked_artifacts_written: false,
    readiness: {
      ready: false,
      review_state: "clarification_required",
      blocked_by: [clarificationRequestId],
      next_artifact: "idea_intake_clarification_answers",
    },
    clarification_requests: [
      {
        id: clarificationRequestId,
        kind: "intake_context_gap",
        severity: "blocking",
        status: "open",
        target_artifact: "user_idea_intake_session",
        target_ref: "active_frame.domain_refs",
        question: "Which product domain refs bound this idea?",
        suggested_actions: ["answer_question", "defer"],
      },
    ],
    request_counts: {
      total: 1,
      blocking: 1,
      by_kind: { intake_context_gap: 1 },
      by_status: { open: 1 },
    },
  });
  await writeJson(path.join(runsDir, "real_idea_smoke/real_idea_answer_template.json"), {
    artifact_kind: "real_idea_answer_template",
    schema_version: 1,
    proposal_id: "0194",
    contract_ref: "specgraph.real-idea.answer-template.v0.1",
    stage: "intake",
    run_dir: "runs/real_idea_smoke",
    answer_targets: [
      {
        target_id: "answer-target.active-frame-domain-refs",
        target_type: "active_frame_ref",
        request_id: clarificationRequestId,
        request_kind: "intake_context_gap",
        severity: "blocking",
        status: "open",
        question: "Which product domain refs bound this idea?",
        target_artifact: "user_idea_intake_session",
        target_ref: "active_frame.domain_refs",
        accepted_actions: ["answer_question", "defer"],
        suggested_answer_shape: "refs[]",
        value_templates_by_action: {
          answer_question: { refs: [""] },
          defer: { follow_up: "" },
        },
        required_fields_by_action: {
          answer_question: ["value.refs[]"],
          defer: ["value.follow_up"],
        },
      },
    ],
    readiness: {
      ready: true,
      review_state: "answer_template_ready",
      blocked_by: [],
      next_artifact: "real_idea_answer_set.json",
    },
    authority_boundary: {
      may_execute_specgraph: false,
      may_write_ontology_package: false,
      may_accept_ontology_terms: false,
      may_create_branch_or_commit: false,
    },
    privacy_boundary: { raw_idea_text_published: false },
    summary: {
      status: "answer_template_ready",
      stage: "intake",
      target_count: 1,
      blocking_target_count: 1,
      finding_count: 0,
    },
  });
}

async function proxyRouteToBackend(route: Route, baseUrl: string) {
  const request = route.request();
  const sourceUrl = new URL(request.url());
  try {
    const response = await route.fetch({
      url: `${baseUrl}${sourceUrl.pathname}${sourceUrl.search}`,
      method: request.method(),
      headers: request.headers(),
      postData: request.postData() ?? undefined,
    });
    await route.fulfill({ response });
  } catch (error) {
    await route.fulfill({
      status: 502,
      json: {
        error: "specspace_e2e_backend_proxy_unavailable",
        detail: String(error),
      },
    });
  }
}

async function installRealBackendApiRoutes(page: Page, baseUrl: string) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/runs-watch") {
      await route.fulfill({
        json: {
          artifact_kind: "specspace_runs_watch",
          version: 1,
        },
      });
      return;
    }
    await proxyRouteToBackend(route, baseUrl);
  });
}

async function installBootstrapChromeApiRoutes(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/runs-watch") {
      await route.fulfill({
        json: {
          artifact_kind: "specspace_runs_watch",
          version: 1,
        },
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: {
        error: "mocked_api_surface_not_needed_for_bootstrap_chrome",
      },
    });
  });
}

async function installRunsWatchMock(page: Page) {
  await page.addInitScript(() => {
    type Listener = () => void;

    class MockEventSource {
      static instances: MockEventSource[] = [];

      readonly url: string;
      private readonly listeners = new Map<string, Set<Listener>>();

      constructor(url: string) {
        this.url = url;
        MockEventSource.instances.push(this);
      }

      addEventListener(type: string, listener: Listener) {
        const listeners = this.listeners.get(type) ?? new Set<Listener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: Listener) {
        this.listeners.get(type)?.delete(listener);
      }

      close() {
        const index = MockEventSource.instances.indexOf(this);
        if (index >= 0) MockEventSource.instances.splice(index, 1);
        this.listeners.clear();
      }

      emit(type: string) {
        for (const listener of this.listeners.get(type) ?? []) listener();
      }
    }

    window.EventSource = MockEventSource as unknown as typeof EventSource;
    window.__specspaceEmitRunsChange = () => {
      for (const instance of [...MockEventSource.instances]) {
        instance.emit("change");
      }
    };
  });
}

async function emitRunsChange(page: Page) {
  await page.evaluate(() => {
    window.__specspaceEmitRunsChange?.();
  });
}

async function submitRawIdeaEntryFromUi(
  page: Page,
  ideaText: string,
  summary: string,
) {
  await page.goto(`/${workspaceId}`);
  await page.getByTestId("real-idea-entry-text").fill(ideaText);
  await page.getByTestId("real-idea-entry-summary").fill(summary);
  await page.getByTestId("real-idea-entry-submit").click();
}

async function copyIfPresent(source: string, destination: string) {
  if (!existsSync(source)) return;
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

async function publishRealIdeaIntakeExecutionArtifacts(args: {
  backendRunsDir: string;
  platformReportPath: string;
  specGraphRunDir: string;
}) {
  await copyIfPresent(
    args.platformReportPath,
    path.join(args.backendRunsDir, "platform_real_idea_entry_intake_execution_report.json"),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "idea_intake_clarification_requests.json"),
    path.join(args.backendRunsDir, "idea_intake_clarification_requests.json"),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "real_idea_answer_template.json"),
    path.join(args.backendRunsDir, "real_idea_smoke", "real_idea_answer_template.json"),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "real_idea_answer_authoring_report.json"),
    path.join(
      args.backendRunsDir,
      "real_idea_smoke",
      "real_idea_answer_authoring_report.json",
    ),
  );
}

async function writeWorkspaceInitializationReport(args: {
  runsDir: string;
  workspaceId: string;
  displayName: string;
}) {
  const reportPath = path.join(
    args.runsDir,
    "platform_product_workspace_initialization_execution_report.json",
  );
  await writeJson(
    reportPath,
    {
      artifact_kind: "platform_product_workspace_initialization_execution_report",
      schema_version: 1,
      ok: true,
      dry_run: false,
      canonical_mutations_allowed: false,
      tracked_artifacts_written: false,
      plan_ref: `runs/${args.workspaceId}/platform_product_workspace_initialization_plan.json`,
      catalog_ref: "workspaces.local.yaml",
      specgraph_initialization_report_ref:
        "runs/product_workspace_initialization.json",
      workspace: {
        workspace_id: args.workspaceId,
        display_name: args.displayName,
        route: `/${args.workspaceId}`,
        repository_role: "product_spec_workspace",
      },
      summary: {
        status: "workspace_initialization_executed",
        specgraph_executed: true,
        catalog_written: true,
        workspace_files_created: true,
        error_count: 0,
      },
      executed_operations: [
        "validate_product_workspace_creation_request",
        "execute_specgraph_product_workspace_initialization",
        "write_workspace_catalog_entry",
      ],
      authority_boundary: {
        executes_platform: true,
        executes_specgraph: true,
        creates_workspace_files: true,
        updates_workspace_catalog: true,
        creates_git_commits: false,
        opens_pull_requests: false,
        publishes_read_models: false,
        mutates_canonical_specs: false,
        writes_ontology_packages: false,
        accepts_ontology_terms: false,
      },
    },
  );
  return reportPath;
}

async function publishRealIdeaContinuationArtifacts(args: {
  backendRunsDir: string;
  platformReportPath: string;
  specGraphRunDir: string;
}) {
  await copyIfPresent(
    args.platformReportPath,
    path.join(args.backendRunsDir, "platform_real_idea_answer_continuation_execution_report.json"),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "idea_intake_clarification_answers.json"),
    path.join(args.backendRunsDir, "idea_intake_clarification_answers.json"),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "real_idea_answer_set.json"),
    path.join(args.backendRunsDir, "real_idea_smoke", "real_idea_answer_set.json"),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "specspace_real_idea_answer_import_preview.json"),
    path.join(
      args.backendRunsDir,
      "real_idea_smoke",
      "specspace_real_idea_answer_import_preview.json",
    ),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "real_idea_answer_continuation_report.json"),
    path.join(
      args.backendRunsDir,
      "real_idea_smoke",
      "real_idea_answer_continuation_report.json",
    ),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "clarified_user_idea_intake_session.json"),
    path.join(args.backendRunsDir, "clarified_user_idea_intake_session.json"),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "clarified_user_idea_intake_source.json"),
    path.join(args.backendRunsDir, "clarified_user_idea_intake_source.json"),
  );
  for (const artifactName of [
    "idea_event_storming_intake.json",
    "candidate_spec_graph_seed.json",
    "candidate_spec_graph.json",
    "pre_sib_coherence_report.json",
    "candidate_repair_loop_report.json",
    "idea_to_spec_clarification_requests.json",
    "candidate_spec_materialization_report.json",
    "idea_to_spec_promotion_gate.json",
  ]) {
    await copyIfPresent(
      path.join(args.specGraphRunDir, artifactName),
      path.join(args.backendRunsDir, artifactName),
    );
  }
  await copyIfPresent(
    path.join(args.specGraphRunDir, "active_idea_to_spec_candidate.json"),
    path.join(args.backendRunsDir, "active_idea_to_spec_candidate.json"),
  );
}

async function readExistingFilesAsText(filePaths: string[]): Promise<string> {
  const chunks: string[] = [];
  for (const filePath of filePaths) {
    if (!existsSync(filePath)) continue;
    chunks.push(await readFile(filePath, "utf8"));
  }
  return chunks.join("\n");
}

async function publishRepairSessionJournalArtifacts(args: {
  backendRunsDir: string;
  specGraphRunDir: string;
}) {
  await copyIfPresent(
    path.join(args.specGraphRunDir, "idea_to_spec_repair_session.json"),
    path.join(args.backendRunsDir, "idea_to_spec_repair_session.json"),
  );
}

async function publishRepairImportPreviewExecutionArtifacts(args: {
  backendRunsDir: string;
  platformReportPath: string;
}) {
  await copyIfPresent(
    args.platformReportPath,
    path.join(
      args.backendRunsDir,
      "platform_product_repair_draft_import_preview_execution_report.json",
    ),
  );
}

async function publishRepairRequestGateArtifacts(args: {
  backendRunsDir: string;
  platformReportPath: string;
  specGraphRunDir: string;
}) {
  await copyIfPresent(
    args.platformReportPath,
    path.join(
      args.backendRunsDir,
      "platform_product_repair_rerun_request_gate_execution_report.json",
    ),
  );
  await copyIfPresent(
    path.join(args.specGraphRunDir, "specspace_repair_rerun_request_gate.json"),
    path.join(args.backendRunsDir, "specspace_repair_rerun_request_gate.json"),
  );
}

async function publishRepairRerunExecutionArtifacts(args: {
  backendRunsDir: string;
  platformReportPath: string;
  specGraphRunDir: string;
}) {
  await copyIfPresent(
    args.platformReportPath,
    path.join(
      args.backendRunsDir,
      "platform_product_repair_rerun_execution_report.json",
    ),
  );
  for (const artifactName of [
    "specspace_repair_draft_rerun_report.json",
    "idea_to_spec_answer_rerun_input.json",
    "idea_to_spec_rerun_preview.json",
    "idea_to_spec_rerun_materialization.json",
    "idea_to_spec_repair_session.json",
    "repaired_candidate_promotion_handoff_report.json",
    "repaired_active_idea_to_spec_candidate.json",
    "repaired_candidate_spec_graph.json",
    "repaired_pre_sib_coherence_report.json",
    "repaired_candidate_repair_loop_report.json",
    "repaired_candidate_spec_materialization_report.json",
    "repaired_idea_to_spec_repair_session.json",
    "repaired_idea_to_spec_promotion_gate.json",
  ]) {
    await copyIfPresent(
      path.join(args.specGraphRunDir, artifactName),
      path.join(args.backendRunsDir, artifactName),
    );
  }
}

async function publishRepairRerunPublicationArtifacts(args: {
  backendRunsDir: string;
  platformReportPath: string;
}) {
  await copyIfPresent(
    args.platformReportPath,
    path.join(
      args.backendRunsDir,
      "platform_product_repair_rerun_publication_report.json",
    ),
  );
}

async function publishProjectLocalOntologyReviewArtifacts(args: {
  backendRunsDir: string;
  specGraphRunDir: string;
}) {
  for (const artifactName of [
    "project_local_ontology_review_lane.json",
    "specspace_project_local_ontology_decision_import_preview.json",
    "project_local_ontology_decision_effect_report.json",
  ]) {
    await copyIfPresent(
      path.join(args.specGraphRunDir, artifactName),
      path.join(args.backendRunsDir, artifactName),
    );
  }
}

async function publishCandidateApprovalArtifacts(args: {
  backendRunsDir: string;
  executionReportPath: string;
  decisionPath: string;
}) {
  await copyIfPresent(
    args.executionReportPath,
    path.join(args.backendRunsDir, "platform_candidate_approval_execution_report.json"),
  );
  await copyIfPresent(
    args.decisionPath,
    path.join(args.backendRunsDir, "candidate_approval_decision.json"),
  );
}

async function publishPromotionRequestArtifacts(args: {
  backendRunsDir: string;
  promotionRequestPath: string;
}) {
  await copyIfPresent(
    args.promotionRequestPath,
    path.join(args.backendRunsDir, "graph_repository_promotion_request.json"),
  );
}

async function publishPromotionExecutionArtifacts(args: {
  backendRunsDir: string;
  executionReportPath: string;
}) {
  await copyIfPresent(
    args.executionReportPath,
    path.join(
      args.backendRunsDir,
      "product_candidate_promotion_execution_report.json",
    ),
  );
}

function safeActionBoundary() {
  return {
    inspect_only: true,
    acknowledge_only: true,
    may_execute_specgraph: false,
    may_execute_platform: false,
    may_execute_git_service: false,
    may_mutate_candidate_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
    may_open_pull_request: false,
    may_merge_review: false,
  };
}

function safeAnswerContinuationBoundary() {
  return {
    inspect_only: true,
    acknowledge_only: true,
    may_execute_specgraph: false,
    may_execute_platform: false,
    may_apply_answers: false,
    may_mutate_candidate_source_artifacts: false,
    may_mutate_canonical_specs: false,
    may_write_ontology_package: false,
    may_accept_ontology_terms: false,
    may_create_branch_or_commit: false,
  };
}

function pendingAnswerContinuation() {
  return {
    available: false,
    ready: false,
    import_preview: {
      available: false,
      readiness: {
        ready: false,
        review_state: "missing",
        blocked_by: [],
        next_artifact: "specspace_real_idea_answer_import_preview.json",
      },
      summary: {},
      accepted_answer_count: null,
      answer_count: null,
      findings: [],
      source_artifacts: {},
    },
    continuation_report: {
      available: false,
      readiness: {
        ready: false,
        review_state: "missing",
        blocked_by: [],
        next_artifact: "real_idea_answer_continuation_report.json",
      },
      summary: {},
      outputs: {},
      findings: [],
    },
    recommended_actions: [
      {
        id: "build_specspace_answer_import_preview",
        label: "Build answer import preview",
        next_action: "Run the controlled SpecGraph answer import preview handoff.",
      },
    ],
    action_boundary: safeAnswerContinuationBoundary(),
  };
}

async function workspacePayload(
  backendBaseUrl: string,
  scenario: UiStartedIdeaScenario,
) {
  const payload = JSON.parse(JSON.stringify(ideaToSpecWorkspace)) as Record<
    string,
    unknown
  >;
  const response = await fetch(
    `${backendBaseUrl}/api/v1/real-idea-entry-requests?workspace=${workspaceId}`,
  );
  const entryState = (await response.json()) as {
    summary?: { active_submitted_count?: number };
  };
  const hasSubmittedEntry =
    (entryState.summary?.active_submitted_count ?? 0) > 0;
  const realIdeaIntake = (payload.real_idea_intake as Record<string, unknown>) ?? {};
  const missingEntryExecution = {
    available: false,
    ok: false,
    dry_run: false,
    status: "missing",
    output_refs: [],
    output_artifact_count: 0,
    diagnostic_count: 0,
    operations: [],
    output_artifacts: [],
  };
  const actionBoundary = safeActionBoundary();

  if (!hasSubmittedEntry) {
    payload.real_idea_intake = {
      ...realIdeaIntake,
      available: false,
      status: "missing",
      next_action: "Submit a raw idea request before intake execution.",
      blockers: [],
      source_refs: [],
      entry_execution: missingEntryExecution,
    };
    return payload;
  }

  if (scenario.intakeExecutionPublished) {
    const continuationPublished = scenario.answerContinuationPublished === true;
    const blockedContinuationPublished =
      scenario.blockedAnswerContinuationPublished === true;
    const intakeClarification = (payload.intake_clarification as Record<string, unknown>) ?? {};
    if (scenario.partialBlockingClarification) {
      const clarificationRequests = {
        ...((intakeClarification.clarification_requests as Record<string, unknown>) ?? {}),
      };
      const requests = Array.isArray(clarificationRequests.requests)
        ? clarificationRequests.requests.map((request) =>
            JSON.parse(JSON.stringify(request)) as Record<string, unknown>,
          )
        : [];
      const firstRequest = requests[0] ?? {};
      const secondRequest = {
        ...firstRequest,
        id: "clarification.intake.question-active-frame-actor-refs",
        target_ref: "active_frame.actor_refs",
        question: "Which actor refs bound this idea?",
      };
      const template = {
        ...((((intakeClarification.answer_authoring as Record<string, unknown>) ?? {})
          .template as Record<string, unknown>) ?? {}),
      };
      const targets = Array.isArray(template.targets)
        ? template.targets.map((target) =>
            JSON.parse(JSON.stringify(target)) as Record<string, unknown>,
          )
        : [];
      const firstTarget = targets[0] ?? {};
      const secondTarget = {
        ...firstTarget,
        target_id: "answer-target.active-frame-actor-refs",
        target_type: "active_frame_ref",
        request_id: "clarification.intake.question-active-frame-actor-refs",
        question: "Which actor refs bound this idea?",
        target_ref: "active_frame.actor_refs",
      };
      payload.intake_clarification = {
        ...intakeClarification,
        clarification_requests: {
          ...clarificationRequests,
          requests: [...requests, secondRequest],
          request_count: 2,
          blocking_request_count: 2,
          summary: {
            ...((clarificationRequests.summary as Record<string, unknown>) ?? {}),
            total: 2,
            blocking: 2,
          },
        },
        answer_authoring: {
          ...((intakeClarification.answer_authoring as Record<string, unknown>) ?? {}),
          template: {
            ...template,
            targets: [...targets, secondTarget],
            target_count: 2,
            blocking_target_count: 2,
            summary: {
              ...((template.summary as Record<string, unknown>) ?? {}),
              target_count: 2,
              blocking_target_count: 2,
            },
          },
        },
        answer_continuation: pendingAnswerContinuation(),
      };
    } else if (!continuationPublished && !blockedContinuationPublished) {
      payload.intake_clarification = {
        ...intakeClarification,
        answer_continuation: pendingAnswerContinuation(),
      };
    } else if (blockedContinuationPublished) {
      payload.intake_clarification = {
        ...intakeClarification,
        answer_continuation: {
          ...pendingAnswerContinuation(),
          available: true,
          ready: false,
          import_preview: {
            ...pendingAnswerContinuation().import_preview,
            available: true,
            readiness: {
              ready: false,
              review_state: "specspace_real_idea_answers_blocked",
              blocked_by: ["answer_required_field_empty"],
              next_artifact: "real_idea_answer_continuation_report.json",
            },
            summary: {
              status: "specspace_real_idea_answers_blocked",
            },
            accepted_answer_count: 0,
            answer_count: 1,
            findings: [
              {
                finding_id: "answer_required_field_empty",
                severity: "blocking",
                message: "Required refs are missing.",
              },
            ],
          },
          continuation_report: {
            ...pendingAnswerContinuation().continuation_report,
            available: true,
            readiness: {
              ready: false,
              review_state: "real_idea_answer_continuation_blocked",
              blocked_by: ["answer_required_field_empty"],
              next_artifact: "specspace_real_idea_answer_import_preview.json",
            },
            summary: {
              status: "real_idea_answer_continuation_blocked",
            },
            findings: [
              {
                finding_id: "answer_required_field_empty",
                severity: "blocking",
                message: "Required refs are missing.",
              },
            ],
          },
        },
      };
    }
    payload.real_idea_intake = {
      ...realIdeaIntake,
      available: true,
      status: continuationPublished ? "active_candidate_ready" : "needs_clarification",
      next_action: continuationPublished
        ? "Continue with repair, ontology review, and promotion readiness."
        : "Answer intake clarification questions before candidate generation.",
      blockers: [],
      clarified_session_ref: continuationPublished
        ? "runs/real_idea_smoke/clarified_user_idea_intake_session.json"
        : null,
      candidate_source_ref: null,
      active_candidate_ref: continuationPublished
        ? "runs/active_idea_to_spec_candidate.json"
        : null,
      clarification_progress: {
        question_count: 1,
        answered_count: continuationPublished ? 1 : 0,
        missing_count: continuationPublished ? 0 : 1,
        invalid_answer_count: 0,
        stale_answer_count: 0,
        required_field_findings: [],
      },
      continuation_handoff: continuationPublished
        ? realIdeaIntake.continuation_handoff
        : {
            import_preview_status: "missing",
            materialization_status: "missing",
            safe_to_continue: false,
            output_refs: [],
            command_hint: null,
          },
      entry_execution: {
        available: true,
        ok: true,
        dry_run: false,
        status: "completed",
        run_dir: "runs/real_idea_smoke",
        target: "real-idea-intake-from-entry-request",
        entry_requests_handoff_ref:
          "runs/real_idea_smoke/real_idea_entry_requests.json",
        output_refs: [
          "runs/real_idea_smoke/real_idea_entry_request_intake_report.json",
          "runs/real_idea_smoke/idea_intake_clarification_requests.json",
        ],
        output_artifact_count: 2,
        diagnostic_count: 0,
        operations: [
          {
            name: "execute_specgraph_real_idea_entry_intake",
            status: "succeeded",
            evidence: ["real-idea-intake-from-entry-request"],
          },
        ],
        output_artifacts: [
          {
            key: "entry_intake_report",
            path: "runs/real_idea_smoke/real_idea_entry_request_intake_report.json",
            present: true,
            artifact_kind: "real_idea_entry_request_intake_report",
            status: "ready",
            ready: true,
          },
          {
            key: "clarification_requests",
            path: "runs/real_idea_smoke/idea_intake_clarification_requests.json",
            present: true,
            artifact_kind: "idea_intake_clarification_requests",
            status: "ready",
            ready: true,
          },
        ],
      },
      source_refs: [
        "runs/platform_real_idea_entry_intake_execution_report.json",
        "runs/real_idea_smoke/idea_intake_clarification_requests.json",
      ],
    };
    payload.guided_flow = {
      ...((payload.guided_flow as Record<string, unknown>) ?? {}),
      current_stage: "intake_clarification",
      current_stage_label: "Intake clarification",
      overall_status: "action_required",
      next_actions: [
        continuationPublished
          ? {
              id: "continue_real_idea_intake_candidate_source",
              label: "Continue with repair, ontology review, and promotion readiness.",
              status: "ready",
              target_section: "idea-to-spec-intake-clarification",
              evidence_refs: [
                "runs/real_idea_smoke/specspace_real_idea_answer_import_preview.json",
                "runs/real_idea_smoke/real_idea_answer_continuation_report.json",
              ],
              authority_boundary: actionBoundary,
            }
          : {
              id: "answer_real_idea_intake_clarifications",
              label: "Answer intake clarification questions before candidate generation.",
              status: "ready",
              target_section: "idea-to-spec-intake-clarification",
              evidence_refs: [
                "runs/real_idea_smoke/idea_intake_clarification_requests.json",
              ],
              authority_boundary: actionBoundary,
            },
      ],
    };
    return payload;
  }

  payload.real_idea_intake = {
    ...realIdeaIntake,
    available: true,
    status: "entry_submitted",
    next_action:
      "Import the submitted raw idea entry through SpecGraph/Platform intake handoff.",
    blockers: [],
    entry_execution: missingEntryExecution,
    source_refs: ["specspace-state://real_idea_entry_requests.json"],
  };
  payload.guided_flow = {
    ...((payload.guided_flow as Record<string, unknown>) ?? {}),
    current_stage: "idea_intake",
    current_stage_label: "Idea intake",
    overall_status: "action_required",
    next_actions: [
      {
        id: "import_real_idea_entry_request",
        label: "Import submitted raw idea entry through Platform.",
        status: "ready",
        target_section: "idea-to-spec-idea-intake",
        command_template:
          "scripts/platform.py product-real-idea-intake execute --entry-requests <SpecSpace state dir>/real_idea_entry_requests.json",
        evidence_refs: ["specspace-state://real_idea_entry_requests.json"],
        authority_boundary: actionBoundary,
      },
    ],
  };
  return payload;
}

async function installIdeaToSpecApiRoutes(
  page: Page,
  backendBaseUrl: string,
  scenario: UiStartedIdeaScenario = { intakeExecutionPublished: false },
) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/v1/idea-to-spec-workspace") {
      await route.fulfill({
        json: await workspacePayload(backendBaseUrl, scenario),
      });
      return;
    }

    if (path === "/api/v1/real-idea-entry-requests") {
      await proxyRouteToBackend(route, backendBaseUrl);
      return;
    }

    if (path === "/api/v1/real-idea-intake-execution-requests") {
      await proxyRouteToBackend(route, backendBaseUrl);
      return;
    }

    if (path === "/api/v1/real-idea-answer-continuation-execution-requests") {
      await proxyRouteToBackend(route, backendBaseUrl);
      return;
    }

    if (path === "/api/v1/product-workspace-creation-requests") {
      await proxyRouteToBackend(route, backendBaseUrl);
      return;
    }

    if (path === "/api/v1/idea-to-spec-intake-clarification-answers") {
      await proxyRouteToBackend(route, backendBaseUrl);
      return;
    }

    if (path === "/api/v1/runs-watch") {
      await route.fulfill({
        json: {
          artifact_kind: "specspace_runs_watch",
          version: 1,
        },
      });
      return;
    }

    await route.fulfill({
      status: 404,
      json: {
        error: "mocked_api_surface_not_needed_for_ui_started_real_idea_entry",
      },
    });
  });
}

test("submits a raw real idea entry request from the product workspace UI", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  try {
    await installRunsWatchMock(page);
    await installIdeaToSpecApiRoutes(page, backend.baseUrl);

    await page.goto(`/${workspaceId}`);
    await expect(page.getByText("Idea-to-Spec Workspace")).toBeVisible();

    const idea =
      "A lightweight cash-flow control app for recurring payments and overdraft avoidance.";
    const publicSummary = "Cash-flow control for recurring payments";

    await page.getByTestId("real-idea-entry-text").fill(idea);
    await page.getByTestId("real-idea-entry-summary").fill(publicSummary);
    await page.getByTestId("real-idea-entry-submit").click();

    await expect(page.getByTestId("real-idea-entry-submitted-status")).toContainText(
      "real-idea-entry.team-decision-log",
    );
    await expect(page.getByTestId("real-idea-entry-handoff-command")).toContainText(
      "product-real-idea-intake execute-requested",
    );
    await expect(page.getByTestId("real-idea-entry-handoff-command")).toContainText(
      "real_idea_intake_execution_requests.json",
    );
    await expect(page.getByTestId("real-idea-entry-handoff-command")).toContainText(
      "--specgraph-dir <specgraph-repository>",
    );
    await expect(page.getByTestId("real-idea-entry-handoff-command")).toContainText(
      "--request-id real-idea-entry.team-decision-log",
    );
    await page.reload();
    await expect(page.getByTestId("real-idea-entry-submitted-status")).toContainText(
      "real-idea-entry.team-decision-log",
    );
    await expect(page.getByTestId("real-idea-entry-handoff-command")).toContainText(
      "--specgraph-dir <specgraph-repository>",
    );
    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Import the submitted raw idea entry",
    );
    await expect(page.getByTestId("guided-flow-next-action")).toContainText(
      "Import submitted raw idea entry through Platform.",
    );
    await expect(page.getByText("Request state")).toBeVisible();
  } finally {
    await backend.stop();
  }
});

test("renders bootstrap workspace metadata as human-readable sidebar labels", async ({
  page,
}) => {
  await installRunsWatchMock(page);
  await installBootstrapChromeApiRoutes(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  const sidebar = page.getByLabel("SpecSpace Sidebar");
  await expect(sidebar.getByText("SpecGraph bootstrap showcase")).toBeVisible();
  await expect(sidebar.getByText("SpecGraph bootstrap", { exact: true })).toBeVisible();
  await expect(
    sidebar.getByText("specgraph_bootstrap_showcase", { exact: true }),
  ).toHaveCount(0);
  await expect(
    sidebar.getByText("specgraph_bootstrap", { exact: true }),
  ).toHaveCount(0);
});

test("switches workspaces through the compact sidebar dropdown", async ({ page }) => {
  await installRunsWatchMock(page);
  await installBootstrapChromeApiRoutes(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  const sidebar = page.getByLabel("SpecSpace Sidebar");
  const workspaceSelect = sidebar.getByLabel("Workspaces");
  await workspaceSelect.selectOption("/team-decision-log");
  await expect(page).toHaveURL(/\/$/);

  await sidebar.getByRole("button", { name: "Open selected workspace" }).click();
  await expect(page).toHaveURL(/\/team-decision-log$/);
});

test("opens a new idea workspace from the sidebar wizard entry point", async ({ page }) => {
  const backend = await startSpecSpaceBackend();
  try {
    await installRunsWatchMock(page);
    await installRealBackendApiRoutes(page, backend.baseUrl);

    await page.goto("/");
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();

    const sidebar = page.getByLabel("SpecSpace Sidebar");
    await expect(
      sidebar.getByRole("textbox", { name: "New idea workspace" }),
    ).toHaveCount(0);
    const newWorkspaceButton = sidebar.getByRole("button", {
      name: "New workspace",
    });
    await newWorkspaceButton.click();

    const wizard = page.getByRole("dialog", { name: "New workspace" });
    await expect(wizard).toBeVisible();
    const displayNameInput = wizard.getByRole("textbox", {
      name: "Workspace display name",
    });
    await expect(displayNameInput).toBeFocused();
    await wizard.getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(wizard.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(wizard.getByRole("button", { name: "Close" })).toBeFocused();
    await wizard.getByRole("button", { name: "Cancel" }).click();
    await expect(wizard).toBeHidden();
    await expect(newWorkspaceButton).toBeFocused();

    await newWorkspaceButton.click();
    await expect(displayNameInput).toBeFocused();
    await displayNameInput.fill("Pantry Rotation");
    await wizard.getByRole("textbox", { name: "Initial idea" }).fill(
      "A household pantry rotation planner.",
    );
    await expect(wizard.getByTestId("new-idea-workspace-route")).toContainText(
      "/pantry-rotation",
    );

    await wizard.getByRole("button", { name: "Create workspace request" }).click();

    await expect(page).toHaveURL(/\/pantry-rotation$/);
    await expect(
      page.getByLabel("SpecSpace Sidebar").getByLabel("Workspaces"),
    ).toHaveValue("/pantry-rotation");
    await expect(sidebar.getByText("Product idea-to-spec")).toBeVisible();
    await expect(sidebar.getByText("Product spec workspace")).toBeVisible();
    await expect(page.getByTestId("workspace-creation-status")).toContainText(
      "Workspace creation requested",
    );

    const stateResponse = await fetch(
      `${backend.baseUrl}/api/v1/product-workspace-creation-requests?workspace=pantry-rotation`,
    );
    expect(stateResponse.ok).toBeTruthy();
    const state = (await stateResponse.json()) as {
      requests?: Array<{ workspace_id?: string; route?: string; status?: string }>;
    };
    expect(state.requests?.[0]).toMatchObject({
      workspace_id: "pantry-rotation",
      route: "/pantry-rotation",
      status: "requested",
    });
  } finally {
    await backend.stop();
  }
});

test("explains unavailable workspace creation API from the sidebar wizard", async ({
  page,
}) => {
  await installRunsWatchMock(page);
  await installBootstrapChromeApiRoutes(page);
  await page.route("**/api/v1/product-workspace-creation-requests", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "",
      });
    }
    return route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();

  const sidebar = page.getByLabel("SpecSpace Sidebar");
  await sidebar.getByRole("button", { name: "New workspace" }).click();

  const wizard = page.getByRole("dialog", { name: "New workspace" });
  await wizard
    .getByRole("textbox", { name: "Workspace display name" })
    .fill("Calcus");
  await wizard
    .getByRole("textbox", { name: "Initial idea" })
    .fill("Calculator for students on exams");
  await wizard.getByRole("button", { name: "Create workspace request" }).click();

  await expect(wizard).toContainText(
    "Workspace request failed because the SpecSpace API is unavailable.",
  );
  await expect(wizard).toContainText("make specspace-start");
});

test("opens a backend-allocated route for a non-English workspace name", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  try {
    await installRunsWatchMock(page);
    await installRealBackendApiRoutes(page, backend.baseUrl);

    await page.goto("/");
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();

    const sidebar = page.getByLabel("SpecSpace Sidebar");
    await sidebar.getByRole("button", { name: "New workspace" }).click();
    const wizard = page.getByRole("dialog", { name: "New workspace" });
    await wizard
      .getByRole("textbox", { name: "Workspace display name" })
      .fill("Домашний контроль подписок");
    await expect(wizard.getByTestId("new-idea-workspace-route")).toContainText(
      "SpecSpace will ask the backend to allocate a safe route.",
    );

    await wizard.getByRole("button", { name: "Create workspace request" }).click();

    await expect(page).toHaveURL(/\/idea-[a-f0-9]{10}$/);
    await expect(page.getByTestId("workspace-creation-status")).toContainText(
      "Workspace creation requested",
    );

    const stateResponse = await fetch(
      `${backend.baseUrl}/api/v1/product-workspace-creation-requests`,
    );
    expect(stateResponse.ok).toBeTruthy();
    const state = (await stateResponse.json()) as {
      requests?: Array<{ workspace_id?: string; route?: string; status?: string }>;
    };
    expect(state.requests?.[0]?.workspace_id).toMatch(/^idea-[a-f0-9]{10}$/);
    expect(state.requests?.[0]?.route).toBe(`/${state.requests?.[0]?.workspace_id}`);
  } finally {
    await backend.stop();
  }
});

test("refreshes an opened workspace after controlled initialization is published", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  try {
    await installRunsWatchMock(page);
    await installRealBackendApiRoutes(page, backend.baseUrl);

    await page.goto("/");
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();

    const sidebar = page.getByLabel("SpecSpace Sidebar");
    await sidebar.getByRole("button", { name: "New workspace" }).click();
    const wizard = page.getByRole("dialog", { name: "New workspace" });
    await wizard.getByRole("textbox", { name: "Workspace display name" }).fill(
      "Pantry Rotation",
    );
    await wizard.getByRole("textbox", { name: "Initial idea" }).fill(
      "A pantry rotation assistant for household food inventory.",
    );
    await wizard.getByRole("button", { name: "Create workspace request" }).click();

    await expect(page).toHaveURL(/\/pantry-rotation$/);
    await expect(page.getByTestId("workspace-creation-status")).toContainText(
      "Workspace creation requested",
    );
    await expect(
      page.getByTestId("workspace-initialization-path-next-action"),
    ).toContainText("Request controlled Platform workspace initialization.");
    await expect(page.getByTestId("real-idea-entry-workspace-gate")).toContainText(
      "Run the controlled Platform workspace initialization",
    );
    await expect(page.getByTestId("real-idea-entry-submit")).toBeDisabled();

    await writeWorkspaceInitializationReport({
      runsDir: backend.runsDir,
      workspaceId: "pantry-rotation",
      displayName: "Pantry Rotation",
    });
    await emitRunsChange(page);

    await expect(page.getByTestId("workspace-creation-status")).toContainText(
      "Workspace initialized through backend-owned state.",
    );
    await expect(
      page.getByTestId("workspace-initialization-path-next-action"),
    ).toContainText("Start or continue raw idea intake in this workspace.");
    await expect(page.getByTestId("real-idea-entry-workspace-gate")).toContainText(
      "Raw idea intake will use this workspace namespace.",
    );
    await expect(page.getByTestId("real-idea-entry-text")).toBeEnabled();
    await expect(page.getByTestId("real-idea-entry-summary")).toBeEnabled();
    await expect(page.getByTestId("real-idea-entry-text")).toHaveValue(
      "A pantry rotation assistant for household food inventory.",
    );
    await expect(page.getByTestId("real-idea-entry-summary")).toHaveValue(
      "Pantry Rotation",
    );
    await expect(page.getByTestId("real-idea-entry-submit")).toBeEnabled();
  } finally {
    await backend.stop();
  }
});

test("shows clarification stage after external intake execution publication", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  const scenario: UiStartedIdeaScenario = { intakeExecutionPublished: false };
  try {
    await installRunsWatchMock(page);
    await installIdeaToSpecApiRoutes(page, backend.baseUrl, scenario);

    await page.goto(`/${workspaceId}`);
    await expect(page.getByText("Idea-to-Spec Workspace")).toBeVisible();

    await page
      .getByTestId("real-idea-entry-text")
      .fill("A spending guard for recurring bills and overdraft avoidance.");
    await page
      .getByTestId("real-idea-entry-summary")
      .fill("Spending guard for recurring bills");
    await page.getByTestId("real-idea-entry-submit").click();
    await expect(page.getByTestId("guided-flow-next-action")).toContainText(
      "Import submitted raw idea entry through Platform.",
    );

    scenario.intakeExecutionPublished = true;
    await emitRunsChange(page);

    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Answer intake clarification questions",
    );
    await expect(page.getByTestId("guided-flow-next-action")).toContainText(
      "Answer intake clarification questions before candidate generation.",
    );
    await expect(page.getByText("Platform intake execution", { exact: true })).toBeVisible();
    await expect(page.getByText("execute_specgraph_real_idea_entry_intake")).toBeVisible();
    await expect(page.getByText("clarification_requests", { exact: true })).toBeVisible();
    await expect(page.getByText("Template-backed answer")).toBeVisible();
    await expect(page.getByText("Answer continuation pending")).toBeVisible();
  } finally {
    await backend.stop();
  }
});

test("blocks raw idea submit for a route-only product workspace", async ({ page }) => {
  const backend = await startSpecSpaceBackend({ seedIntakeRuns: false });
  try {
    await installRunsWatchMock(page);
    await installRealBackendApiRoutes(page, backend.baseUrl);

    await page.goto("/route-only-idea");
    await expect(page.getByText("Idea-to-Spec Workspace")).toBeVisible();
    await expect(page.getByTestId("workspace-creation-status")).toContainText(
      "Route opened; backend workspace creation has not been requested yet.",
    );
    await expect(page.getByTestId("real-idea-entry-workspace-gate")).toContainText(
      "Request and initialize this workspace before submitting a raw idea.",
    );
    await expect(page.getByTestId("real-idea-entry-submit")).toBeDisabled();
  } finally {
    await backend.stop();
  }
});

test("builds an active candidate from a non-demo product workspace route", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const platformDir = process.env.SPECG_E2E_PLATFORM_DIR;
  const specGraphDir = process.env.SPECG_E2E_SPECG_DIR;
  test.skip(
    !platformDir || !specGraphDir,
    "Set SPECG_E2E_PLATFORM_DIR and SPECG_E2E_SPECG_DIR to run the execution-backed route smoke.",
  );

  const platformScript = path.join(platformDir!, "scripts/platform.py");
  const specGraphMakefile = path.join(specGraphDir!, "Makefile");
  test.skip(
    !existsSync(platformScript) || !existsSync(specGraphMakefile),
    "Execution-backed route smoke requires local Platform and SpecGraph checkouts.",
  );

  const backend = await startSpecSpaceBackend({ seedIntakeRuns: false });
  const runDirName = `specspace-ui-e2e-route-${Date.now()}`;
  const specGraphRunDirRef = `runs/${runDirName}`;
  const specGraphRunDir = path.join(specGraphDir!, specGraphRunDirRef);
  const platformReportPath = path.join(
    specGraphRunDir,
    "platform_real_idea_entry_intake_execution_report.json",
  );

  try {
    await installRunsWatchMock(page);
    await installRealBackendApiRoutes(page, backend.baseUrl);
    const creationResponse = await fetch(
      `${backend.baseUrl}/api/v1/product-workspace-creation-requests?workspace=${executionBackedWorkspaceId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_id: executionBackedWorkspaceId,
          display_name: "Household Pantry Rotation",
        }),
      },
    );
    expect(creationResponse.ok).toBeTruthy();
    const initializationReportPath = await writeWorkspaceInitializationReport({
      runsDir: backend.runsDir,
      workspaceId: executionBackedWorkspaceId,
      displayName: "Household Pantry Rotation",
    });

    await page.goto(`/${executionBackedWorkspaceId}`);
    await expect(page.getByText("Idea-to-Spec Workspace")).toBeVisible();
    await expect(
      page.getByLabel("SpecSpace Sidebar").getByLabel("Workspaces"),
    ).toHaveValue(`/${executionBackedWorkspaceId}`);
    await expect(page.getByTestId("workspace-creation-status")).toContainText(
      "Workspace initialized through backend-owned state.",
    );
    await expect(page.getByTestId("real-idea-entry-workspace-gate")).toContainText(
      "Raw idea intake will use this workspace namespace.",
    );
    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Create a real idea intake session",
    );

    await page.getByTestId("real-idea-entry-text").fill(executionBackedRawIdea);
    await page
      .getByTestId("real-idea-entry-summary")
      .fill(executionBackedPublicSummary);
    await page.getByTestId("real-idea-entry-submit").click();
    await expect(page.getByTestId("guided-flow-next-action")).toContainText(
      "Import the submitted raw idea entry",
    );

    const stateResponse = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-entry-requests?workspace=${executionBackedWorkspaceId}`,
    );
    expect(stateResponse.ok).toBeTruthy();
    const state = (await stateResponse.json()) as {
      requests?: Array<{ request_id?: string }>;
    };
    let requestId = state.requests?.[0]?.request_id;
    expect(requestId).toMatch(
      new RegExp(`^real-idea-entry\\.${executionBackedWorkspaceId}(\\.|$)`),
    );
    expect(requestId).not.toContain(workspaceId);
    await page.getByTestId("real-idea-intake-execution-request").click();
    await expect(
      page.getByTestId("real-idea-intake-execution-request-status"),
    ).toContainText("Requested execution");

    const executionRequestResponse = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-intake-execution-requests?workspace=${executionBackedWorkspaceId}`,
    );
    expect(executionRequestResponse.ok).toBeTruthy();
    const executionRequestState = (await executionRequestResponse.json()) as {
      requests?: Array<{
        entry_request_id?: string;
        workspace_id?: string;
        workspace_initialization_ref?: string;
        status?: string;
      }>;
    };
    expect(
      executionRequestState.requests?.find((request) => request.status === "requested")
        ?.entry_request_id,
    ).toBe(requestId);
    expect(
      executionRequestState.requests?.find((request) => request.status === "requested")
        ?.workspace_id,
    ).toBe(executionBackedWorkspaceId);

    await page.getByTestId("real-idea-entry-text").fill(
      `${executionBackedRawIdea} Revised with household notifications.`,
    );
    await page
      .getByTestId("real-idea-entry-summary")
      .fill(`${executionBackedPublicSummary} revised`);
    await page.getByTestId("real-idea-entry-submit").click();
    await expect(page.getByTestId("real-idea-intake-execution-request")).toContainText(
      "Replace intake execution request",
    );
    await expect(
      page.getByTestId("real-idea-intake-execution-request-status"),
    ).toContainText("previous entry");

    const revisedStateResponse = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-entry-requests?workspace=${executionBackedWorkspaceId}`,
    );
    expect(revisedStateResponse.ok).toBeTruthy();
    const revisedState = (await revisedStateResponse.json()) as {
      requests?: Array<{ request_id?: string; status?: string }>;
    };
    const revisedRequestId = revisedState.requests?.find(
      (request) => request.status === "submitted",
    )?.request_id;
    expect(revisedRequestId).toBeTruthy();
    expect(revisedRequestId).not.toBe(requestId);
    requestId = revisedRequestId;
    await page.getByTestId("real-idea-intake-execution-request").click();

    const replacedExecutionRequestResponse = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-intake-execution-requests?workspace=${executionBackedWorkspaceId}`,
    );
    expect(replacedExecutionRequestResponse.ok).toBeTruthy();
    const replacedExecutionRequestState =
      (await replacedExecutionRequestResponse.json()) as typeof executionRequestState;
    expect(
      replacedExecutionRequestState.requests?.find(
        (request) => request.status === "requested",
      )?.entry_request_id,
    ).toBe(requestId);
    expect(
      replacedExecutionRequestState.requests?.some(
        (request) =>
          request.status === "superseded" &&
          request.entry_request_id !== requestId,
      ),
    ).toBeTruthy();
    expect(
      replacedExecutionRequestState.requests?.find(
        (request) => request.status === "requested",
      )?.workspace_id,
    ).toBe(
      executionBackedWorkspaceId,
    );

    const intakeCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-real-idea-intake",
      "execute-requested",
      "--specgraph-dir",
      specGraphDir!,
      "--execution-request",
      path.join(backend.stateDir, "real_idea_intake_execution_requests.json"),
      "--workspace-initialization",
      initializationReportPath,
      "--run-dir",
      specGraphRunDirRef,
      "--output",
      platformReportPath,
      "--format",
      "json",
    ]);
    const execution = await runCommand(
      intakeCommand.command,
      intakeCommand.args,
      { cwd: platformDir! },
    );
    expect(execution.code, execution.stderr).toBe(0);
    const report = JSON.parse(await readFile(platformReportPath, "utf8")) as {
      ok?: boolean;
      diagnostics?: unknown[];
      workspace_initialization?: {
        workspace_id?: string;
      };
      target_make?: {
        variables?: Record<string, string>;
      };
      execution_request_ref?: string;
    };
    expect(report.ok, JSON.stringify(report.diagnostics ?? [])).toBe(true);
    expect(report.execution_request_ref).toContain(
      "real_idea_intake_execution_requests.json",
    );
    expect(report.workspace_initialization?.workspace_id).toBe(
      executionBackedWorkspaceId,
    );
    expect(
      report.target_make?.variables?.SPECSPACE_REAL_IDEA_ENTRY_WORKSPACE_ID,
    ).toBe(executionBackedWorkspaceId);

    await publishRealIdeaIntakeExecutionArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath,
      specGraphRunDir,
    });
    await emitRunsChange(page);

    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      /Answer intake clarification questions|Inspect generated intake artifacts/,
    );
    await expect(page.getByText("Platform intake execution", { exact: true })).toBeVisible();
    await expect(page.getByText("execute_specgraph_real_idea_entry_intake")).toBeVisible();

    const answerFields = page.locator('textarea[data-testid^="intake-clarification-answer-"]');
    const answerCount = await answerFields.count();
    if (answerCount === 0) {
      const generatedIntakeArtifactsText = await readExistingFilesAsText([
        path.join(backend.runsDir, "platform_real_idea_entry_intake_execution_report.json"),
        path.join(backend.runsDir, "idea_event_storming_intake.json"),
        path.join(backend.runsDir, "candidate_spec_graph_seed.json"),
        path.join(backend.runsDir, "candidate_spec_graph.json"),
        path.join(backend.runsDir, "active_idea_to_spec_candidate.json"),
      ]);
      expect(generatedIntakeArtifactsText).not.toContain(executionBackedRawIdea);
      expect(generatedIntakeArtifactsText).toContain(executionBackedWorkspaceId);
      expect(generatedIntakeArtifactsText).not.toContain("team-decision-log");
      return;
    }
    await expect(page.getByText("Template-backed answer").first()).toBeVisible();
    const answerValuesByRequest: Record<string, string> = {
      "clarification.intake.question-active-frame-domain-refs":
        "domain.household_pantry_rotation",
      "clarification.intake.question-event-storming-actors":
        "Household shopper\nMeal planner",
      "clarification.intake.question-event-storming-domain-events":
        "Pantry item recorded\nExpiration reviewed\nShopping task assigned",
      "clarification.intake.question-event-storming-commands":
        "Record pantry item\nReview expiring item\nAssign shopping task",
      "clarification.intake.question-event-storming-constraints":
        "Expiration date required\nShared shopping task owner required\nMeal-prep inventory gap must be visible",
    };
    for (let index = 0; index < answerCount; index += 1) {
      const field = answerFields.nth(index);
      const testId = await field.getAttribute("data-testid");
      expect(testId).toBeTruthy();
      const clarificationRequestId = testId!.replace(
        "intake-clarification-answer-",
        "",
      );
      await field.fill(
        answerValuesByRequest[clarificationRequestId] ?? `Answer ${index + 1}`,
      );
      await page
        .getByTestId(`intake-clarification-answer-save-${clarificationRequestId}`)
        .click();
    }
    await expect(
      page.locator('[data-testid^="intake-clarification-answer-saved-"]'),
    ).toHaveCount(answerCount);
    await expect(
      page.getByTestId("guided-clarification-continuation"),
    ).toContainText("request_continuation");
    await expect(
      page.getByTestId("guided-clarification-continuation-request"),
    ).toBeEnabled();
    await page
      .getByTestId("guided-clarification-continuation-request")
      .click();
    await expect(
      page.getByTestId("guided-clarification-continuation-request-status"),
    ).toContainText("real-idea-answer-continuation-execute");

    const continuationReportPath = path.join(
      specGraphRunDir,
      "platform_real_idea_answer_continuation_execution_report.json",
    );
    const continuationCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-real-idea-continuation",
      "execute-requested",
      "--specgraph-dir",
      specGraphDir!,
      "--execution-request",
      path.join(backend.stateDir, "real_idea_answer_continuation_execution_requests.json"),
      "--run-dir",
      specGraphRunDirRef,
      "--workspace-initialization",
      initializationReportPath,
      "--intake-execution",
      platformReportPath,
      "--output",
      continuationReportPath,
      "--format",
      "json",
    ]);
    const continuation = await runCommand(
      continuationCommand.command,
      continuationCommand.args,
      { cwd: platformDir! },
    );
    expect(continuation.code, continuation.stderr).toBe(0);
    const continuationReport = JSON.parse(
      await readFile(continuationReportPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      continuationReport.ok,
      JSON.stringify(continuationReport.diagnostics ?? []),
    ).toBe(true);
    expect(JSON.stringify(continuationReport)).toContain(
      "real_idea_answer_continuation_execution_requests.json",
    );

    await publishRealIdeaContinuationArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath: continuationReportPath,
      specGraphRunDir,
    });
    const generatedIdeaArtifactsText = await readExistingFilesAsText([
      path.join(backend.runsDir, "platform_real_idea_entry_intake_execution_report.json"),
      path.join(
        backend.runsDir,
        "platform_real_idea_answer_continuation_execution_report.json",
      ),
      path.join(backend.runsDir, "clarified_user_idea_intake_session.json"),
      path.join(backend.runsDir, "clarified_user_idea_intake_source.json"),
      path.join(backend.runsDir, "idea_event_storming_intake.json"),
      path.join(backend.runsDir, "candidate_spec_graph_seed.json"),
      path.join(backend.runsDir, "candidate_spec_graph.json"),
      path.join(backend.runsDir, "active_idea_to_spec_candidate.json"),
    ]);
    expect(generatedIdeaArtifactsText).not.toContain(executionBackedRawIdea);
    expect(generatedIdeaArtifactsText).toContain(executionBackedPublicSummary);
    expect(generatedIdeaArtifactsText).toContain("Pantry item recorded");
    expect(generatedIdeaArtifactsText).toContain("Record pantry item");
    expect(generatedIdeaArtifactsText).toContain("Household shopper");
    expect(generatedIdeaArtifactsText).toContain(executionBackedWorkspaceId);
    expect(generatedIdeaArtifactsText).not.toContain("Decision owner");
    expect(generatedIdeaArtifactsText).not.toContain("Record decision");
    expect(generatedIdeaArtifactsText).not.toContain("team-decision-log");
    await emitRunsChange(page);

    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Inspect active candidate readiness before continuing.",
    );
    await expect(page.getByText("Real idea answer continuation", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("guided-clarification-continuation"),
    ).toContainText("continuation_ready");
    await expect(
      page.getByText("real_idea_answer_continuation_ready").first(),
    ).toBeVisible();
    await expect(page.getByText("active_candidate_review_required").first()).toBeVisible();
    await expect(page.getByText("Candidate graph").first()).toBeVisible();
    await expect(page.getByText("Product repair review").first()).toBeVisible();
  } finally {
    await rm(specGraphRunDir, { recursive: true, force: true });
    await backend.stop();
  }
});

test("can refresh from a real Platform intake execution when checkouts are provided", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const platformDir = process.env.SPECG_E2E_PLATFORM_DIR;
  const specGraphDir = process.env.SPECG_E2E_SPECG_DIR;
  test.skip(
    !platformDir || !specGraphDir,
    "Set SPECG_E2E_PLATFORM_DIR and SPECG_E2E_SPECG_DIR to run the execution-backed smoke.",
  );

  const lifecycleWorkspaceId = executionBackedWorkspaceId;
  const platformScript = path.join(platformDir!, "scripts/platform.py");
  const specGraphMakefile = path.join(specGraphDir!, "Makefile");
  test.skip(
    !existsSync(platformScript) || !existsSync(specGraphMakefile),
    "Execution-backed smoke requires local Platform and SpecGraph checkouts.",
  );

  const backend = await startSpecSpaceBackend({ seedIntakeRuns: false });
  const runDirName = `specspace-ui-e2e-real-${Date.now()}`;
  const specGraphRunDirRef = `runs/${runDirName}`;
  const specGraphRunDir = path.join(specGraphDir!, specGraphRunDirRef);
  const platformReportPath = path.join(
    specGraphRunDir,
    "platform_real_idea_entry_intake_execution_report.json",
  );

  try {
    await installRunsWatchMock(page);
    await installRealBackendApiRoutes(page, backend.baseUrl);
    const creationResponse = await fetch(
      `${backend.baseUrl}/api/v1/product-workspace-creation-requests?workspace=${lifecycleWorkspaceId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspace_id: lifecycleWorkspaceId,
          display_name: "Household Pantry Rotation",
        }),
      },
    );
    expect(creationResponse.ok).toBeTruthy();
    const initializationReportPath = await writeWorkspaceInitializationReport({
      runsDir: backend.runsDir,
      workspaceId: lifecycleWorkspaceId,
      displayName: "Household Pantry Rotation",
    });

    await page.goto(`/${lifecycleWorkspaceId}`);
    await expect(page.getByText("Idea-to-Spec Workspace")).toBeVisible();
    await expect(page.getByTestId("workspace-creation-status")).toContainText(
      "Workspace initialized through backend-owned state.",
    );
    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Create a real idea intake session",
    );

    await page.getByTestId("real-idea-entry-text").fill(fullLifecycleRawIdea);
    await page
      .getByTestId("real-idea-entry-summary")
      .fill(fullLifecyclePublicSummary);
    await page.getByTestId("real-idea-entry-submit").click();
    await expect(page.getByTestId("guided-flow-next-action")).toContainText(
      "Import the submitted raw idea entry",
    );

    const stateResponse = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-entry-requests?workspace=${lifecycleWorkspaceId}`,
    );
    expect(stateResponse.ok).toBeTruthy();
    const state = (await stateResponse.json()) as {
      requests?: Array<{ request_id?: string }>;
    };
    const requestId = state.requests?.[0]?.request_id;
    expect(requestId).toBeTruthy();

    const intakeCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-real-idea-intake",
      "execute",
      "--specgraph-dir",
      specGraphDir!,
      "--workspace-initialization",
      initializationReportPath,
      "--run-dir",
      specGraphRunDirRef,
      "--entry-requests",
      path.join(backend.stateDir, "real_idea_entry_requests.json"),
      "--request-id",
      requestId!,
      "--output",
      platformReportPath,
      "--format",
      "json",
    ]);
    const execution = await runCommand(
      intakeCommand.command,
      intakeCommand.args,
      { cwd: platformDir! },
    );
    expect(execution.code, execution.stderr).toBe(0);
    const report = JSON.parse(await readFile(platformReportPath, "utf8")) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(report.ok, JSON.stringify(report.diagnostics ?? [])).toBe(true);

    await publishRealIdeaIntakeExecutionArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath,
      specGraphRunDir,
    });
    await emitRunsChange(page);

    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      /Answer intake clarification questions|Inspect generated intake artifacts/,
    );
    await expect(page.getByText("Platform intake execution", { exact: true })).toBeVisible();
    await expect(page.getByText("execute_specgraph_real_idea_entry_intake")).toBeVisible();

    const answerFields = page.locator('textarea[data-testid^="intake-clarification-answer-"]');
    const answerCount = await answerFields.count();
    if (answerCount === 0) return;
    await expect(page.getByText("Template-backed answer").first()).toBeVisible();
    const answerValuesByRequest: Record<string, string> = {
      "clarification.intake.question-active-frame-domain-refs":
        "domain.household_pantry_rotation",
      "clarification.intake.question-event-storming-actors":
        "Household shopper\nMeal planner",
      "clarification.intake.question-event-storming-domain-events":
        "Pantry item recorded\nExpiration reviewed\nShopping task assigned",
      "clarification.intake.question-event-storming-commands":
        "Record pantry item\nReview expiring item\nAssign shopping task",
      "clarification.intake.question-event-storming-constraints":
        "Expiration date required\nShared shopping task owner required\nMeal-prep inventory gap must be visible",
    };
    for (let index = 0; index < answerCount; index += 1) {
      const field = answerFields.nth(index);
      const testId = await field.getAttribute("data-testid");
      expect(testId).toBeTruthy();
      const requestId = testId!.replace("intake-clarification-answer-", "");
      await field.fill(answerValuesByRequest[requestId] ?? `Answer ${index + 1}`);
      await page.getByTestId(`intake-clarification-answer-save-${requestId}`).click();
    }
    await expect(
      page.locator('[data-testid^="intake-clarification-answer-saved-"]'),
    ).toHaveCount(answerCount);
    await expect(
      page.getByTestId("guided-clarification-continuation"),
    ).toContainText("request_continuation");
    await expect(
      page.getByTestId("guided-clarification-continuation-request"),
    ).toBeEnabled();
    await page
      .getByTestId("guided-clarification-continuation-request")
      .click();
    await expect(
      page.getByTestId("guided-clarification-continuation-request-status"),
    ).toContainText("real-idea-answer-continuation-execute");

    const continuationReportPath = path.join(
      specGraphRunDir,
      "platform_real_idea_answer_continuation_execution_report.json",
    );
    const continuationCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-real-idea-continuation",
      "execute-requested",
      "--specgraph-dir",
      specGraphDir!,
      "--execution-request",
      path.join(backend.stateDir, "real_idea_answer_continuation_execution_requests.json"),
      "--run-dir",
      specGraphRunDirRef,
      "--workspace-initialization",
      initializationReportPath,
      "--intake-execution",
      platformReportPath,
      "--output",
      continuationReportPath,
      "--format",
      "json",
    ]);
    const continuation = await runCommand(
      continuationCommand.command,
      continuationCommand.args,
      { cwd: platformDir! },
    );
    expect(continuation.code, continuation.stderr).toBe(0);
    const continuationReport = JSON.parse(
      await readFile(continuationReportPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      continuationReport.ok,
      JSON.stringify(continuationReport.diagnostics ?? []),
    ).toBe(true);
    expect(JSON.stringify(continuationReport)).toContain(
      "real_idea_answer_continuation_execution_requests.json",
    );

    await publishRealIdeaContinuationArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath: continuationReportPath,
      specGraphRunDir,
    });
    const generatedIdeaArtifactsText = await readExistingFilesAsText([
      path.join(specGraphRunDir, "platform_real_idea_entry_intake_execution_report.json"),
      path.join(specGraphRunDir, "user_idea_intake_session.json"),
      path.join(specGraphRunDir, "clarified_user_idea_intake_session.json"),
      path.join(specGraphRunDir, "clarified_user_idea_intake_source.json"),
      path.join(specGraphRunDir, "idea_event_storming_intake.json"),
      path.join(specGraphRunDir, "candidate_spec_graph_seed.json"),
      path.join(specGraphRunDir, "candidate_spec_graph.json"),
      path.join(specGraphRunDir, "active_idea_to_spec_candidate.json"),
    ]);
    expect(generatedIdeaArtifactsText).not.toContain(fullLifecycleRawIdea);
    expect(generatedIdeaArtifactsText).toContain(fullLifecyclePublicSummary);
    expect(generatedIdeaArtifactsText).toContain("Pantry item recorded");
    expect(generatedIdeaArtifactsText).toContain("Record pantry item");
    expect(generatedIdeaArtifactsText).toContain("Household shopper");
    expect(generatedIdeaArtifactsText).not.toContain("Decision owner");
    expect(generatedIdeaArtifactsText).not.toContain("Record decision");
    expect(generatedIdeaArtifactsText).not.toContain("team-decision-log");
    const publishedIdeaArtifactsText = await readExistingFilesAsText([
      path.join(backend.runsDir, "platform_real_idea_entry_intake_execution_report.json"),
      path.join(
        backend.runsDir,
        "platform_real_idea_answer_continuation_execution_report.json",
      ),
      path.join(backend.runsDir, "clarified_user_idea_intake_session.json"),
      path.join(backend.runsDir, "clarified_user_idea_intake_source.json"),
      path.join(backend.runsDir, "idea_event_storming_intake.json"),
      path.join(backend.runsDir, "candidate_spec_graph_seed.json"),
      path.join(backend.runsDir, "candidate_spec_graph.json"),
      path.join(backend.runsDir, "active_idea_to_spec_candidate.json"),
    ]);
    expect(publishedIdeaArtifactsText).toContain(lifecycleWorkspaceId);
    expect(publishedIdeaArtifactsText).toContain("Pantry item recorded");
    expect(publishedIdeaArtifactsText).not.toContain("team-decision-log");
    await emitRunsChange(page);

    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Inspect active candidate readiness before continuing.",
    );
    await expect(page.getByText("Real idea answer continuation", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("guided-clarification-continuation"),
    ).toContainText("continuation_ready");
    await expect(
      page.getByText("specspace_real_idea_answers_ready_for_continuation").first(),
    ).toBeVisible();
    await expect(
      page.getByText("real_idea_answer_continuation_ready").first(),
    ).toBeVisible();
    await expect(page.getByText("active_candidate_review_required").first()).toBeVisible();
    await expect(page.getByText("Candidate graph").first()).toBeVisible();
    await expect(page.getByText("Pre-SIB coherence").first()).toBeVisible();
    await expect(page.getByText("Product repair review").first()).toBeVisible();
    const guidedRepairPath = page.locator("#idea-to-spec-guided-repair-path");
    await expect(guidedRepairPath).toContainText("Guided repair path");
    await expect(guidedRepairPath).toContainText("Candidate repair route");
    await expect(guidedRepairPath).toContainText("Product/spec answers");
    await expect(guidedRepairPath).toContainText("Rerun request");
    await expect(page.getByText("Repair draft rerun").first()).toBeVisible();
    await expect(page.getByText("make product-workspace-repair-draft-rerun").first()).toBeVisible();
    await expect(page.getByText("idea_to_spec_promotion_blocked").first()).toBeVisible();

    await page
      .getByLabel("Repair draft action")
      .first()
      .selectOption("propose_project_local_term");
    await page.getByLabel("Ontology gap term").first().fill("Team Member");
    await page.getByRole("button", { name: "Save draft" }).first().click();
    await expect(page.getByText("Draft saved · propose project local term").first()).toBeVisible();
    const repairActionSelects = page.getByLabel("Repair draft action");
    let productGapRow = null as ReturnType<typeof page.locator> | null;
    const repairActionCount = await repairActionSelects.count();
    for (let index = 0; index < repairActionCount; index += 1) {
      const select = repairActionSelects.nth(index);
      const supportsProductContext = await select
        .locator('option[value="provide_candidate_context"]')
        .count();
      if (!supportsProductContext) continue;
      await select.selectOption("provide_candidate_context");
      const row = select.locator("xpath=ancestor::div[.//form][1]");
      if ((await row.getByLabel("Product gap mechanism or context").count()) > 0) {
        productGapRow = row;
        break;
      }
    }
    expect(productGapRow, "expected a product/spec repair gap form").not.toBeNull();
    await productGapRow!
      .getByLabel("Product gap mechanism or context")
      .fill("Add an explicit owner-checked enforcement mechanism in the candidate spec.");
    await productGapRow!.getByLabel("Product gap owner").fill("Product owner");
    await productGapRow!.getByLabel("Product gap scope").fill("UI-started candidate review");
    await productGapRow!.getByLabel("Product gap risk decision").fill("mitigated");
    await productGapRow!
      .getByLabel("Product gap mitigation")
      .fill("Require candidate review before promotion.");
    await productGapRow!.getByRole("button", { name: "Save draft" }).click();
    await expect(
      productGapRow!.getByText("Draft saved · provide candidate context"),
    ).toBeVisible();
    await expect(page.getByText("SpecSpace repair drafts").first()).toBeVisible();
    const workspaceStatePreflight = page.locator("#idea-to-spec-workspace-state-hygiene");
    await expect(workspaceStatePreflight).toContainText(/repair drafts\s*usable/i);
    await expect(
      workspaceStatePreflight,
    ).toContainText(/Rebuild repair draft import preview\s*blocked/i);
    await expect(
      workspaceStatePreflight,
    ).toContainText(/Build initial repair session journal\s*enabled/i);
    await expect(workspaceStatePreflight).toContainText(
      "idea-to-spec-initial-repair-session-journal",
    );
    await expect(workspaceStatePreflight).toContainText("Build repair session journal first.");

    const initialJournal = await runCommand(
      "make",
      [
        "idea-to-spec-initial-repair-session-journal",
        `IDEA_TO_SPEC_REPAIR_SESSION_ACTIVE_CANDIDATE=${specGraphRunDirRef}/active_idea_to_spec_candidate.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_CLARIFICATION_REQUESTS=${specGraphRunDirRef}/idea_to_spec_clarification_requests.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_CLARIFICATION_ANSWERS=${specGraphRunDirRef}/idea_to_spec_clarification_answers.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_ONTOLOGY_DECISIONS=${specGraphRunDirRef}/product_ontology_gap_review_decisions.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_RERUN_INPUT=${specGraphRunDirRef}/idea_to_spec_answer_rerun_input.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_RERUN_PREVIEW=${specGraphRunDirRef}/idea_to_spec_rerun_preview.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_RERUN_MATERIALIZATION=${specGraphRunDirRef}/idea_to_spec_rerun_materialization.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_PROMOTION_GATE=${specGraphRunDirRef}/idea_to_spec_promotion_gate.json`,
        `IDEA_TO_SPEC_REPAIR_SESSION_OUTPUT=${specGraphRunDirRef}/idea_to_spec_repair_session.json`,
      ],
      { cwd: specGraphDir! },
    );
    expect(initialJournal.code, initialJournal.stderr).toBe(0);
    await publishRepairSessionJournalArtifacts({
      backendRunsDir: backend.runsDir,
      specGraphRunDir,
    });
    await emitRunsChange(page);
    await expect(workspaceStatePreflight).toContainText(/repair drafts\s*usable/i);

    const importPreviewReportPath = path.join(
      specGraphRunDir,
      "platform_product_repair_draft_import_preview_execution_report.json",
    );
    const importPreviewCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-repair-rerun",
      "import-preview",
      "--specgraph-dir",
      specGraphDir!,
      "--run-dir",
      specGraphRunDirRef,
      "--draft-state",
      path.join(backend.stateDir, "idea_to_spec_repair_drafts.json"),
      "--repair-session",
      path.join(specGraphRunDir, "idea_to_spec_repair_session.json"),
      "--clarification-requests",
      path.join(specGraphRunDir, "idea_to_spec_clarification_requests.json"),
      "--workspace-id",
      lifecycleWorkspaceId,
      "--output-preview",
      path.join(specGraphRunDir, "specspace_repair_draft_import_preview.json"),
      "--output",
      importPreviewReportPath,
      "--format",
      "json",
    ]);
    const importPreview = await runCommand(
      importPreviewCommand.command,
      importPreviewCommand.args,
      { cwd: platformDir! },
    );
    expect(
      importPreview.code,
      `stdout:\n${importPreview.stdout}\nstderr:\n${importPreview.stderr}`,
    ).toBe(0);
    const importPreviewReport = JSON.parse(
      await readFile(importPreviewReportPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      importPreviewReport.ok,
      JSON.stringify(importPreviewReport.diagnostics ?? []),
    ).toBe(true);
    await publishRepairImportPreviewExecutionArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath: importPreviewReportPath,
    });
    await emitRunsChange(page);
    await expect(workspaceStatePreflight).toContainText(
      /repair draft import preview\s*usable/i,
    );
    const requestRerunButton = page.getByRole("button", {
      name: "Request rerun preview",
    });
    await expect(requestRerunButton).toBeEnabled();
    await requestRerunButton.click();
    await expect(page.getByText("rerun_requested").first()).toBeVisible();

    const requestGateReportPath = path.join(
      specGraphRunDir,
      "platform_product_repair_rerun_request_gate_execution_report.json",
    );
    const requestGateCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-repair-rerun",
      "request-gate",
      "--specgraph-dir",
      specGraphDir!,
      "--run-dir",
      specGraphRunDirRef,
      "--rerun-request",
      path.join(backend.stateDir, "idea_to_spec_repair_rerun_requests.json"),
      "--import-preview",
      path.join(specGraphRunDir, "specspace_repair_draft_import_preview.json"),
      "--repair-session",
      path.join(specGraphRunDir, "idea_to_spec_repair_session.json"),
      "--workspace-id",
      lifecycleWorkspaceId,
      "--output-gate",
      path.join(specGraphRunDir, "specspace_repair_rerun_request_gate.json"),
      "--output",
      requestGateReportPath,
      "--format",
      "json",
    ]);
    const requestGate = await runCommand(
      requestGateCommand.command,
      requestGateCommand.args,
      { cwd: platformDir! },
    );
    expect(
      requestGate.code,
      `stdout:\n${requestGate.stdout}\nstderr:\n${requestGate.stderr}`,
    ).toBe(0);
    const requestGateReport = JSON.parse(
      await readFile(requestGateReportPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      requestGateReport.ok,
      JSON.stringify(requestGateReport.diagnostics ?? []),
    ).toBe(true);
    await publishRepairRequestGateArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath: requestGateReportPath,
      specGraphRunDir,
    });
    await emitRunsChange(page);
    await expect(workspaceStatePreflight).toContainText(
      /repair rerun request\s*usable/i,
    );
    await expect(workspaceStatePreflight).toContainText(
      /repair rerun request gate\s*usable/i,
    );

    const repairRerunPlanPath = path.join(
      specGraphRunDir,
      "platform_product_repair_rerun_execution_plan.json",
    );
    const repairRerunPlanCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-repair-rerun",
      "plan",
      "--specgraph-dir",
      specGraphDir!,
      "--run-dir",
      specGraphRunDirRef,
      "--output",
      repairRerunPlanPath,
      "--format",
      "json",
    ]);
    const repairRerunPlan = await runCommand(
      repairRerunPlanCommand.command,
      repairRerunPlanCommand.args,
      { cwd: platformDir! },
    );
    expect(
      repairRerunPlan.code,
      `stdout:\n${repairRerunPlan.stdout}\nstderr:\n${repairRerunPlan.stderr}`,
    ).toBe(0);
    const repairRerunPlanPayload = JSON.parse(
      await readFile(repairRerunPlanPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      repairRerunPlanPayload.ok,
      JSON.stringify(repairRerunPlanPayload.diagnostics ?? []),
    ).toBe(true);

    const repairRerunExecutionPath = path.join(
      specGraphRunDir,
      "platform_product_repair_rerun_execution_report.json",
    );
    const repairRerunExecutionCommand = platformCliInvocation(platformDir!, platformScript, [
      "product-repair-rerun",
      "execute",
      "--plan",
      repairRerunPlanPath,
      "--build-repaired-handoff",
      "--output",
      repairRerunExecutionPath,
      "--format",
      "json",
    ]);
    const repairRerunExecution = await runCommand(
      repairRerunExecutionCommand.command,
      repairRerunExecutionCommand.args,
      { cwd: platformDir! },
    );
    expect(
      repairRerunExecution.code,
      `stdout:\n${repairRerunExecution.stdout}\nstderr:\n${repairRerunExecution.stderr}`,
    ).toBe(0);
    const repairRerunExecutionPayload = JSON.parse(
      await readFile(repairRerunExecutionPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      repairRerunExecutionPayload.ok,
      JSON.stringify(repairRerunExecutionPayload.diagnostics ?? []),
    ).toBe(true);
    await publishRepairRerunExecutionArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath: repairRerunExecutionPath,
      specGraphRunDir,
    });
    await emitRunsChange(page);
    await expect(page.getByText("Platform repair rerun")).toBeVisible();
    await expect(page.getByText("execute_specgraph_repaired_promotion_handoff")).toBeVisible();
    const approvalReadiness = page.locator("#idea-to-spec-approval-readiness");
    await expect(approvalReadiness).toContainText("Candidate repaired");
    await expect(approvalReadiness).toContainText(/Approval-ready\s*true/i);

    const repairRerunPublicationPath = path.join(
      specGraphRunDir,
      "platform_product_repair_rerun_publication_report.json",
    );
    const repairRerunPublicationCommand = platformCliInvocation(
      platformDir!,
      platformScript,
      [
        "product-repair-rerun",
        "publish",
        "--execution-report",
        repairRerunExecutionPath,
        "--specgraph-dir",
        specGraphDir!,
        "--output",
        repairRerunPublicationPath,
        "--format",
        "json",
      ],
    );
    const repairRerunPublication = await runCommand(
      repairRerunPublicationCommand.command,
      repairRerunPublicationCommand.args,
      { cwd: platformDir! },
    );
    expect(
      repairRerunPublication.code,
      `stdout:\n${repairRerunPublication.stdout}\nstderr:\n${repairRerunPublication.stderr}`,
    ).toBe(0);
    const repairRerunPublicationPayload = JSON.parse(
      await readFile(repairRerunPublicationPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      repairRerunPublicationPayload.ok,
      JSON.stringify(repairRerunPublicationPayload.diagnostics ?? []),
    ).toBe(true);
    await publishRepairRerunPublicationArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath: repairRerunPublicationPath,
    });
    await emitRunsChange(page);
    await expect(page.getByText("Platform repair rerun")).toBeVisible();
    await expect(approvalReadiness).toContainText(/Repaired public\s*true/i);
    await expect(approvalReadiness).toContainText(/Intent request\s*false/i);

    const projectLocalLane = await runCommand(
      "make",
      [
        "project-local-ontology-review-lane",
        `PROJECT_LOCAL_ONTOLOGY_REVIEW_CANDIDATE_GRAPH=${specGraphRunDirRef}/candidate_spec_graph.json`,
        `PROJECT_LOCAL_ONTOLOGY_REVIEW_DECISIONS=${specGraphRunDirRef}/product_ontology_gap_review_decisions.json`,
        `PROJECT_LOCAL_ONTOLOGY_REVIEW_RERUN_PREVIEW=${specGraphRunDirRef}/idea_to_spec_rerun_preview.json`,
        `PROJECT_LOCAL_ONTOLOGY_REVIEW_ACTIVE_CANDIDATE=${specGraphRunDirRef}/active_idea_to_spec_candidate.json`,
        `PROJECT_LOCAL_ONTOLOGY_REVIEW_REPAIR_SESSION=${specGraphRunDirRef}/idea_to_spec_repair_session.json`,
        `PROJECT_LOCAL_ONTOLOGY_REVIEW_OUTPUT=${specGraphRunDirRef}/project_local_ontology_review_lane.json`,
      ],
      { cwd: specGraphDir! },
    );
    expect(
      projectLocalLane.code,
      `stdout:\n${projectLocalLane.stdout}\nstderr:\n${projectLocalLane.stderr}`,
    ).toBe(0);
    await publishProjectLocalOntologyReviewArtifacts({
      backendRunsDir: backend.runsDir,
      specGraphRunDir,
    });
    await emitRunsChange(page);
    await expect(
      page.getByText("Project-local ontology review", { exact: true }).first(),
    ).toBeVisible();

    const projectLocalLanePayload = JSON.parse(
      await readFile(
        path.join(specGraphRunDir, "project_local_ontology_review_lane.json"),
        "utf8",
      ),
    ) as { terms?: Array<{ term_key?: string; term?: string }> };
    const projectLocalTerms = projectLocalLanePayload.terms ?? [];
    expect(projectLocalTerms.length).toBeGreaterThan(0);
    const projectLocalReview = page.locator("#idea-to-spec-project-local-ontology-review");
    for (const term of projectLocalTerms) {
      const termKey = term.term_key;
      expect(termKey).toBeTruthy();
      const termRow = projectLocalReview
        .getByText(termKey!, { exact: true })
        .locator("xpath=ancestor::div[.//form][1]");
      await termRow
        .getByLabel("Project-local ontology review action")
        .selectOption("keep_project_local");
      await termRow.getByLabel("Project-local ontology review decision").fill(
        "Keep this term project-local for the UI-started candidate review.",
      );
      await termRow.getByRole("button", { name: "Save decision" }).click();
      await expect(termRow.getByText("Decision saved")).toBeVisible();
    }

    const projectLocalImportPreview = await runCommand(
      "make",
      [
        "specspace-project-local-ontology-decision-import-preview",
        `SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_STATE=${path.join(backend.stateDir, "project_local_ontology_review_decisions.json")}`,
        `SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_REVIEW_LANE=${specGraphRunDirRef}/project_local_ontology_review_lane.json`,
        `SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_WORKSPACE_ID=${lifecycleWorkspaceId}`,
        `SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_OUTPUT=${specGraphRunDirRef}/specspace_project_local_ontology_decision_import_preview.json`,
      ],
      { cwd: specGraphDir! },
    );
    expect(
      projectLocalImportPreview.code,
      `stdout:\n${projectLocalImportPreview.stdout}\nstderr:\n${projectLocalImportPreview.stderr}`,
    ).toBe(0);
    const projectLocalDecisionEffect = await runCommand(
      "make",
      [
        "project-local-ontology-decision-effect-report",
        `PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REVIEW_LANE=${specGraphRunDirRef}/project_local_ontology_review_lane.json`,
        `PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_IMPORT_PREVIEW=${specGraphRunDirRef}/specspace_project_local_ontology_decision_import_preview.json`,
        `PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_OUTPUT=${specGraphRunDirRef}/project_local_ontology_decision_effect_report.json`,
      ],
      { cwd: specGraphDir! },
    );
    expect(
      projectLocalDecisionEffect.code,
      `stdout:\n${projectLocalDecisionEffect.stdout}\nstderr:\n${projectLocalDecisionEffect.stderr}`,
    ).toBe(0);
    await publishProjectLocalOntologyReviewArtifacts({
      backendRunsDir: backend.runsDir,
      specGraphRunDir,
    });
    await emitRunsChange(page);
    await expect(
      projectLocalReview.getByText("Effective project-local review", { exact: true }),
    ).toBeVisible();
    await expect(
      projectLocalReview.getByText("project_local_ontology_decision_effect_ready").first(),
    ).toBeVisible();
    await expect(approvalReadiness).toContainText(/Intent request\s*true/i);

    await page
      .locator("#idea-to-spec-approval-readiness")
      .getByRole("button", { name: "Approve candidate for promotion review" })
      .click();
    await expect(page.getByText("candidate_approval_intent_recorded")).toBeVisible();
    await expect(page.getByText(/^candidate-approval-intent\./)).toBeVisible();

    const repairedPromotionGate = JSON.parse(
      await readFile(
        path.join(specGraphRunDir, "repaired_idea_to_spec_promotion_gate.json"),
        "utf8",
      ),
    ) as { promotion_request?: { paths?: string[] } };
    const approvalPaths = repairedPromotionGate.promotion_request?.paths ?? [];
    expect(approvalPaths.length).toBeGreaterThan(0);
    const candidateApprovalGatePath = path.join(
      specGraphRunDir,
      "platform_candidate_approval_intent_gate_report.json",
    );
    const candidateApprovalDecisionPath = path.join(
      specGraphRunDir,
      "candidate_approval_decision.json",
    );
    const candidateApprovalExecutionPath = path.join(
      specGraphRunDir,
      "platform_candidate_approval_execution_report.json",
    );
    const candidateApprovalArgs = [
      "product-candidate-approval",
      "approve",
      "--specgraph-dir",
      specGraphDir!,
      "--approval-intents",
      path.join(backend.stateDir, "idea_to_spec_candidate_approval_intents.json"),
      "--repair-session",
      path.join(specGraphRunDir, "repaired_idea_to_spec_repair_session.json"),
      "--active-candidate",
      path.join(specGraphRunDir, "repaired_active_idea_to_spec_candidate.json"),
      "--promotion-gate",
      path.join(specGraphRunDir, "repaired_idea_to_spec_promotion_gate.json"),
      "--repaired-handoff",
      path.join(specGraphRunDir, "repaired_candidate_promotion_handoff_report.json"),
      "--repair-execution",
      repairRerunExecutionPath,
      "--repair-publication",
      repairRerunPublicationPath,
      "--workspace-id",
      lifecycleWorkspaceId,
      "--gate-output",
      candidateApprovalGatePath,
      "--decision-output",
      candidateApprovalDecisionPath,
      "--output",
      candidateApprovalExecutionPath,
      "--format",
      "json",
    ];
    for (const approvalPath of approvalPaths) {
      candidateApprovalArgs.push("--path", approvalPath);
    }
    const candidateApprovalCommand = platformCliInvocation(
      platformDir!,
      platformScript,
      candidateApprovalArgs,
    );
    const candidateApprovalExecution = await runCommand(
      candidateApprovalCommand.command,
      candidateApprovalCommand.args,
      { cwd: platformDir! },
    );
    expect(
      candidateApprovalExecution.code,
      `stdout:\n${candidateApprovalExecution.stdout}\nstderr:\n${candidateApprovalExecution.stderr}`,
    ).toBe(0);
    const candidateApprovalExecutionPayload = JSON.parse(
      await readFile(candidateApprovalExecutionPath, "utf8"),
    ) as {
      ok?: boolean;
      diagnostics?: unknown[];
      summary?: { decision_written?: boolean };
    };
    expect(
      candidateApprovalExecutionPayload.ok,
      JSON.stringify(candidateApprovalExecutionPayload.diagnostics ?? []),
    ).toBe(true);
    expect(candidateApprovalExecutionPayload.summary?.decision_written).toBe(true);
    await publishCandidateApprovalArtifacts({
      backendRunsDir: backend.runsDir,
      executionReportPath: candidateApprovalExecutionPath,
      decisionPath: candidateApprovalDecisionPath,
    });
    await emitRunsChange(page);
    const controlledPromotion = page.locator("#idea-to-spec-controlled-promotion");
    await expect(controlledPromotion.getByText("Candidate approval execution")).toBeVisible();
    await expect(
      controlledPromotion.getByText("Decision written", { exact: true }),
    ).toBeVisible();
    await expect(
      controlledPromotion.getByText("Candidate approval", { exact: true }),
    ).toBeVisible();
    await expect(controlledPromotion.getByText("approved").first()).toBeVisible();

    const graphRepositoryPlanPath = path.join(
      specGraphRunDir,
      "graph_repository_execution_plan.json",
    );
    const graphRepositoryPlanCommand = platformCliInvocation(
      platformDir!,
      platformScript,
      [
        "graph-repository",
        "plan",
        "--contract",
        path.join(platformDir!, "graph-repository-service.example.json"),
        "--runs-dir",
        specGraphRunDir,
        "--repaired-handoff",
        path.join(specGraphRunDir, "repaired_candidate_promotion_handoff_report.json"),
        "--output",
        graphRepositoryPlanPath,
        "--format",
        "json",
      ],
    );
    const graphRepositoryPlan = await runCommand(
      graphRepositoryPlanCommand.command,
      graphRepositoryPlanCommand.args,
      { cwd: platformDir! },
    );
    expect(
      graphRepositoryPlan.code,
      `stdout:\n${graphRepositoryPlan.stdout}\nstderr:\n${graphRepositoryPlan.stderr}`,
    ).toBe(0);
    const graphRepositoryPlanPayload = JSON.parse(
      await readFile(graphRepositoryPlanPath, "utf8"),
    ) as {
      ok?: boolean;
      ready_for_branch?: boolean;
      diagnostics?: unknown[];
    };
    expect(
      graphRepositoryPlanPayload.ok,
      JSON.stringify(graphRepositoryPlanPayload.diagnostics ?? []),
    ).toBe(true);
    expect(graphRepositoryPlanPayload.ready_for_branch).toBe(true);

    const promotionRequestPath = path.join(
      specGraphRunDir,
      "graph_repository_promotion_request.json",
    );
    const promotionRequestCommand = platformCliInvocation(
      platformDir!,
      platformScript,
      [
        "product-candidate-promotion",
        "request",
        "--plan",
        graphRepositoryPlanPath,
        "--approval-decision",
        candidateApprovalDecisionPath,
        "--output",
        promotionRequestPath,
        "--format",
        "json",
      ],
    );
    const promotionRequest = await runCommand(
      promotionRequestCommand.command,
      promotionRequestCommand.args,
      { cwd: platformDir! },
    );
    expect(
      promotionRequest.code,
      `stdout:\n${promotionRequest.stdout}\nstderr:\n${promotionRequest.stderr}`,
    ).toBe(0);
    const promotionRequestPayload = JSON.parse(
      await readFile(promotionRequestPath, "utf8"),
    ) as {
      ok?: boolean;
      summary?: { promotion_ready?: boolean };
      diagnostics?: unknown[];
    };
    expect(
      promotionRequestPayload.ok,
      JSON.stringify(promotionRequestPayload.diagnostics ?? []),
    ).toBe(true);
    expect(promotionRequestPayload.summary?.promotion_ready).toBe(true);
    await publishPromotionRequestArtifacts({
      backendRunsDir: backend.runsDir,
      promotionRequestPath,
    });
    await emitRunsChange(page);
    await expect(controlledPromotion.getByText("Platform promotion request")).toBeVisible();
    await expect(controlledPromotion.getByText("ready").first()).toBeVisible();

    const promotionExecutionPath = path.join(
      specGraphRunDir,
      "product_candidate_promotion_execution_report.json",
    );
    const promotionWorkspaceDir = path.join(
      specGraphRunDir,
      "promotion-dry-run-worktree",
    );
    const promotionExecutionCommand = platformCliInvocation(
      platformDir!,
      platformScript,
      [
        "product-candidate-promotion",
        "execute",
        "--promotion-request",
        promotionRequestPath,
        "--approval-decision",
        candidateApprovalDecisionPath,
        "--repository-dir",
        specGraphDir!,
        "--workspace-dir",
        promotionWorkspaceDir,
        "--dry-run",
        "--open-review-dry-run",
        "--output",
        promotionExecutionPath,
        "--format",
        "json",
      ],
    );
    const promotionExecution = await runCommand(
      promotionExecutionCommand.command,
      promotionExecutionCommand.args,
      { cwd: platformDir! },
    );
    expect(
      promotionExecution.code,
      `stdout:\n${promotionExecution.stdout}\nstderr:\n${promotionExecution.stderr}`,
    ).toBe(0);
    const promotionExecutionPayload = JSON.parse(
      await readFile(promotionExecutionPath, "utf8"),
    ) as {
      ok?: boolean;
      dry_run?: boolean;
      open_review_dry_run?: boolean;
      diagnostics?: unknown[];
      summary?: {
        status?: string;
        physical_worktree_created?: boolean;
        commit_created?: boolean;
        review_opened?: boolean;
      };
    };
    expect(
      promotionExecutionPayload.ok,
      JSON.stringify(promotionExecutionPayload.diagnostics ?? []),
    ).toBe(true);
    expect(promotionExecutionPayload.dry_run).toBe(true);
    expect(promotionExecutionPayload.open_review_dry_run).toBe(true);
    expect(promotionExecutionPayload.summary?.status).toBe("dry_run");
    expect(promotionExecutionPayload.summary?.physical_worktree_created).toBe(false);
    expect(promotionExecutionPayload.summary?.commit_created).toBe(false);
    expect(promotionExecutionPayload.summary?.review_opened).toBe(false);
    await publishPromotionExecutionArtifacts({
      backendRunsDir: backend.runsDir,
      executionReportPath: promotionExecutionPath,
    });
    await emitRunsChange(page);
    await expect(controlledPromotion.getByText("Product promotion execution")).toBeVisible();
    await expect(controlledPromotion.getByText("dry_run").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Git dry-run .* completed/i })).toBeVisible();

  } finally {
    await rm(specGraphRunDir, { recursive: true, force: true });
    await backend.stop();
  }
});

test("saves a clarification answer from the product workspace UI", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  const scenario: UiStartedIdeaScenario = { intakeExecutionPublished: true };
  try {
    await installRunsWatchMock(page);
    await installIdeaToSpecApiRoutes(page, backend.baseUrl, scenario);
    await submitRawIdeaEntryFromUi(
      page,
      "A decision log that needs domain clarification.",
      "Decision log with clarification",
    );
    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Answer intake clarification questions",
    );

    await page
      .getByTestId(`intake-clarification-answer-${clarificationRequestId}`)
      .fill("domain.team_decision_log");
    await page
      .getByTestId(`intake-clarification-answer-save-${clarificationRequestId}`)
      .click();

    await expect(
      page.getByTestId(`intake-clarification-answer-saved-${clarificationRequestId}`),
    ).toContainText("Answer saved · answer question");
    await expect(page.getByText("SpecSpace intake answers")).toBeVisible();
    await expect(page.getByText("intake_clarification_answers_recorded")).toBeVisible();
  } finally {
    await backend.stop();
  }
});

test("keeps continuation request unavailable until all blocking answers are accepted", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  const scenario: UiStartedIdeaScenario = {
    intakeExecutionPublished: true,
    partialBlockingClarification: true,
  };
  try {
    await installRunsWatchMock(page);
    await installIdeaToSpecApiRoutes(page, backend.baseUrl, scenario);
    await submitRawIdeaEntryFromUi(
      page,
      "A decision log that needs multiple clarification answers.",
      "Decision log with partial clarification",
    );
    await page
      .getByTestId(`intake-clarification-answer-${clarificationRequestId}`)
      .fill("domain.team_decision_log");
    await page
      .getByTestId(`intake-clarification-answer-save-${clarificationRequestId}`)
      .click();

    const guide = page.getByTestId("guided-clarification-continuation");
    await expect(guide).toContainText("answer_questions");
    await expect(guide).toContainText("Blocking2");
    await expect(guide).toContainText(
      "Complete required answers before requesting continuation.",
    );
    await expect(
      page.getByTestId("guided-clarification-continuation-request"),
    ).toHaveCount(0);
  } finally {
    await backend.stop();
  }
});

test("surfaces not-ready answer continuation artifacts in the guided path", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  const scenario: UiStartedIdeaScenario = {
    intakeExecutionPublished: true,
    blockedAnswerContinuationPublished: true,
  };
  try {
    await installRunsWatchMock(page);
    await installIdeaToSpecApiRoutes(page, backend.baseUrl, scenario);
    await submitRawIdeaEntryFromUi(
      page,
      "A decision log with blocked answer continuation artifacts.",
      "Decision log blocked continuation",
    );

    const guide = page.getByTestId("guided-clarification-continuation");
    await expect(guide).toContainText("continuation_needs_review");
    await expect(guide).toContainText(
      "Review the answer continuation import preview and report findings before editing answers.",
    );
    await expect(guide).toContainText("specspace_real_idea_answers_blocked");
    await expect(guide).toContainText("real_idea_answer_continuation_blocked");
    await expect(
      page.getByTestId("guided-clarification-continuation-request"),
    ).toHaveCount(0);
  } finally {
    await backend.stop();
  }
});

test("shows continuation-ready lane after external answer continuation publication", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  const scenario: UiStartedIdeaScenario = {
    intakeExecutionPublished: true,
    answerContinuationPublished: false,
  };
  try {
    await installRunsWatchMock(page);
    await installIdeaToSpecApiRoutes(page, backend.baseUrl, scenario);
    await submitRawIdeaEntryFromUi(
      page,
      "A decision log that should continue after clarification.",
      "Decision log continuation",
    );
    await page
      .getByTestId(`intake-clarification-answer-${clarificationRequestId}`)
      .fill("domain.team_decision_log");
    await page
      .getByTestId(`intake-clarification-answer-save-${clarificationRequestId}`)
      .click();
    await expect(
      page.getByTestId(`intake-clarification-answer-saved-${clarificationRequestId}`),
    ).toContainText("Answer saved · answer question");
    await expect(page.getByText("Answer continuation pending")).toBeVisible();
    await expect(
      page.getByTestId("guided-clarification-continuation"),
    ).toContainText("request_continuation");
    await expect(
      page.getByTestId("guided-clarification-continuation-request"),
    ).toBeEnabled();
    await page
      .getByTestId("guided-clarification-continuation-request")
      .click();
    await expect(
      page.getByTestId("guided-clarification-continuation-request-status"),
    ).toContainText("real-idea-answer-continuation-execute.team-decision-log");
    await expect(
      page.getByTestId("real-idea-answer-continuation-handoff-command"),
    ).toContainText("product-real-idea-continuation execute-requested");
    await expect(
      page.getByTestId("real-idea-answer-continuation-handoff-command"),
    ).toContainText("real_idea_answer_continuation_execution_requests.json");

    scenario.answerContinuationPublished = true;
    await emitRunsChange(page);

    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Continue with repair, ontology review, and promotion readiness.",
    );
    await expect(page.getByTestId("guided-flow-next-action")).toContainText(
      "Continue with repair, ontology review, and promotion readiness.",
    );
    const intakeClarification = page.locator("#idea-to-spec-intake-clarification");
    await expect(intakeClarification.getByText("Real idea answer continuation")).toBeVisible();
    await expect(
      page.getByTestId("guided-clarification-continuation"),
    ).toContainText("candidate_ready");
    await expect(
      page.getByText("specspace_real_idea_answers_ready_for_continuation").first(),
    ).toBeVisible();
    await expect(
      page.getByText("real_idea_answer_continuation_ready").first(),
    ).toBeVisible();
  } finally {
    await backend.stop();
  }
});

test("keeps template-backed clarification answers disabled until required refs are filled", async ({
  page,
}) => {
  const backend = await startSpecSpaceBackend();
  const scenario: UiStartedIdeaScenario = { intakeExecutionPublished: true };
  try {
    await installRunsWatchMock(page);
    await installIdeaToSpecApiRoutes(page, backend.baseUrl, scenario);
    await submitRawIdeaEntryFromUi(
      page,
      "A decision log with an incomplete clarification answer.",
      "Decision log clarification validation",
    );
    const intakeClarification = page.locator("#idea-to-spec-intake-clarification");
    await expect(intakeClarification.getByText("Required fields")).toBeVisible();
    await expect(intakeClarification.getByText("value.refs[]", { exact: true })).toBeVisible();

    const answer = page.getByTestId(
      `intake-clarification-answer-${clarificationRequestId}`,
    );
    const save = page.getByTestId(
      `intake-clarification-answer-save-${clarificationRequestId}`,
    );

    await expect(save).toBeDisabled();
    await answer.fill("   ");
    await expect(save).toBeDisabled();
    await expect(
      page.getByTestId(`intake-clarification-answer-saved-${clarificationRequestId}`),
    ).toHaveCount(0);

    await answer.fill("domain.team_decision_log");
    await expect(save).toBeEnabled();
  } finally {
    await backend.stop();
  }
});
