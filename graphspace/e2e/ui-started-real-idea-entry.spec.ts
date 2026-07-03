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

type SpecSpaceBackend = {
  baseUrl: string;
  runsDir: string;
  stateDir: string;
  tmpRoot: string;
  stop: () => Promise<void>;
};

type UiStartedIdeaScenario = {
  intakeExecutionPublished: boolean;
  answerContinuationPublished?: boolean;
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
    child.kill();
    await rm(tmpRoot, { recursive: true, force: true });
    throw new Error(`${String(error)}\n${stderr.join("")}`);
  }
  return {
    baseUrl,
    runsDir,
    stateDir,
    tmpRoot,
    stop: async () => {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
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
  const response = await route.fetch({
    url: `${baseUrl}${sourceUrl.pathname}${sourceUrl.search}`,
    method: request.method(),
    headers: request.headers(),
    postData: request.postData() ?? undefined,
  });
  await route.fulfill({ response });
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
    const intakeClarification = (payload.intake_clarification as Record<string, unknown>) ?? {};
    if (!continuationPublished) {
      payload.intake_clarification = {
        ...intakeClarification,
        answer_continuation: pendingAnswerContinuation(),
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
      "product-real-idea-intake execute",
    );
    await expect(page.getByTestId("real-idea-entry-handoff-command")).toContainText(
      "--request-id real-idea-entry.team-decision-log",
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
    await expect(page.getByText("Platform intake execution")).toBeVisible();
    await expect(page.getByText("execute_specgraph_real_idea_entry_intake")).toBeVisible();
    await expect(page.getByText("clarification_requests", { exact: true })).toBeVisible();
    await expect(page.getByText("Template-backed answer")).toBeVisible();
    await expect(page.getByText("Answer continuation pending")).toBeVisible();
  } finally {
    await backend.stop();
  }
});

test("can refresh from a real Platform intake execution when checkouts are provided", async ({
  page,
}) => {
  const platformDir = process.env.SPECG_E2E_PLATFORM_DIR;
  const specGraphDir = process.env.SPECG_E2E_SPECG_DIR;
  test.skip(
    !platformDir || !specGraphDir,
    "Set SPECG_E2E_PLATFORM_DIR and SPECG_E2E_SPECG_DIR to run the execution-backed smoke.",
  );

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

    await page.goto(`/${workspaceId}`);
    await expect(page.getByText("Idea-to-Spec Workspace")).toBeVisible();
    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Create a real idea intake session",
    );

    await page
      .getByTestId("real-idea-entry-text")
      .fill("A browser-started team decision log for owner review dates.");
    await page
      .getByTestId("real-idea-entry-summary")
      .fill("Browser-started team decision log");
    await page.getByTestId("real-idea-entry-submit").click();
    await expect(page.getByTestId("guided-flow-next-action")).toContainText(
      "Import the submitted raw idea entry",
    );

    const stateResponse = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-entry-requests?workspace=${workspaceId}`,
    );
    expect(stateResponse.ok).toBeTruthy();
    const state = (await stateResponse.json()) as {
      requests?: Array<{ request_id?: string }>;
    };
    const requestId = state.requests?.[0]?.request_id;
    expect(requestId).toBeTruthy();

    const python = executablePythonForSubprocess(platformDir!);
    const execution = await runCommand(
      python,
      [
        platformScript,
        "product-real-idea-intake",
        "execute",
        "--specgraph-dir",
        specGraphDir!,
        "--run-dir",
        specGraphRunDirRef,
        "--entry-requests",
        path.join(backend.stateDir, "real_idea_entry_requests.json"),
        "--workspace-id",
        workspaceId,
        "--request-id",
        requestId!,
        "--output",
        platformReportPath,
        "--format",
        "json",
      ],
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
      "Answer intake clarification questions",
    );
    await expect(page.getByText("Platform intake execution")).toBeVisible();
    await expect(page.getByText("execute_specgraph_real_idea_entry_intake")).toBeVisible();
    await expect(page.getByText("Template-backed answer").first()).toBeVisible();

    const answerFields = page.locator('textarea[data-testid^="intake-clarification-answer-"]');
    const answerCount = await answerFields.count();
    expect(answerCount).toBeGreaterThan(0);
    const answerValuesByRequest: Record<string, string> = {
      "clarification.intake.question-active-frame-domain-refs":
        "domain.team_decision_log",
      "clarification.intake.question-event-storming-actors":
        "Decision owner\nReviewer",
      "clarification.intake.question-event-storming-domain-events":
        "Decision recorded\nReview requested",
      "clarification.intake.question-event-storming-commands":
        "Record decision\nRequest review",
      "clarification.intake.question-event-storming-constraints":
        "Owner review date required\nDecision outcome required",
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

    const continuationReportPath = path.join(
      specGraphRunDir,
      "platform_real_idea_answer_continuation_execution_report.json",
    );
    const continuation = await runCommand(
      python,
      [
        platformScript,
        "product-real-idea-continuation",
        "execute",
        "--specgraph-dir",
        specGraphDir!,
        "--run-dir",
        specGraphRunDirRef,
        "--answer-state",
        path.join(backend.stateDir, "idea_to_spec_intake_clarification_answers.json"),
        "--output",
        continuationReportPath,
        "--format",
        "json",
      ],
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

    await publishRealIdeaContinuationArtifacts({
      backendRunsDir: backend.runsDir,
      platformReportPath: continuationReportPath,
      specGraphRunDir,
    });
    await emitRunsChange(page);

    await expect(page.getByTestId("real-idea-intake-next-action")).toContainText(
      "Inspect active candidate readiness before continuing.",
    );
    await expect(page.getByText("Real idea answer continuation", { exact: true })).toBeVisible();
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
    await expect(page.getByText("SpecSpace repair drafts").first()).toBeVisible();

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
    const response = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-entry-requests?workspace=${workspaceId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          idea_text: "A decision log that needs domain clarification.",
          idea_summary_hint: "Decision log with clarification",
        }),
      },
    );
    expect(response.ok).toBeTruthy();

    await page.goto(`/${workspaceId}`);
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
    const response = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-entry-requests?workspace=${workspaceId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          idea_text: "A decision log that should continue after clarification.",
          idea_summary_hint: "Decision log continuation",
        }),
      },
    );
    expect(response.ok).toBeTruthy();

    await page.goto(`/${workspaceId}`);
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
    const response = await fetch(
      `${backend.baseUrl}/api/v1/real-idea-entry-requests?workspace=${workspaceId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          idea_text: "A decision log with an incomplete clarification answer.",
          idea_summary_hint: "Decision log clarification validation",
        }),
      },
    );
    expect(response.ok).toBeTruthy();

    await page.goto(`/${workspaceId}`);
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
