import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { expect, test, type Page } from "@playwright/test";

const execFileAsync = promisify(execFile);
const workspaceId = "mac-specification-marathon";
const displayName = "Mac Specification Marathon";
const rawIdea =
  "A single-user macOS specification workbench that turns a product idea into reviewable YAML specifications, preserves every workspace across restart, and explains clarification and repair decisions before any Git publication.";
const publicSummary =
  "A macOS specification workbench with durable workspaces and reviewable outputs.";

type WorkspaceSnapshot = {
  workspace_id: string;
  candidate_id: string;
  candidate_ref: string;
  candidate_sha256: string;
  candidate_readiness: {
    ready: boolean;
    review_state: string;
    blocked_by: string[];
  };
  operator_state: OperatorStateSnapshot;
  specification_files: Array<{ path: string; sha256: string }>;
};

type OperatorStateSnapshot = {
  creation_request: { request_id: string; status: string };
  idea_entry_request: { request_id: string; status: string };
  clarification_answers: { answer_count: number; accepted_answer_count: number };
  continuation_request: { request_id: string; status: string };
};

type GitSnapshot = { head: string; tracked_status: string };

type ExecutionEvidence = { ref: string; sha256: string };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the Mac restart E2E.`);
  return value;
}

function profileEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.SPECSPACE_E2E_OPERATOR_PASSWORD;
  delete env.SPECSPACE_E2E_OPERATOR_USERNAME;
  return env;
}

async function runProfile(command: "start" | "stop") {
  const platformDir = requiredEnv("SPECSPACE_E2E_PLATFORM_DIR");
  const apiPort = requiredEnv("API_PORT");
  const uiPort = requiredEnv("UI_PORT");
  let result: Awaited<ReturnType<typeof execFileAsync>>;
  try {
    result = await execFileAsync(
      path.join(platformDir, ".venv", "bin", "python"),
      [
        path.join(platformDir, "scripts", "mac_product_workspace.py"),
        command,
        "--api-port",
        apiPort,
        "--ui-port",
        uiPort,
      ],
      {
        env: profileEnvironment(),
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      `Mac profile ${command} failed: ${failure.message}\nstdout:\n${failure.stdout ?? ""}\nstderr:\n${failure.stderr ?? ""}`,
    );
  }
  return `${result.stdout}\n${result.stderr}`;
}

async function authenticateOperator(page: Page) {
  await page.goto("/api/v1/operator-session?return_to=%2F", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/$/);
  const session = await page.evaluate(async () => {
    const response = await fetch("/api/v1/operator-session");
    if (!response.ok) {
      throw new Error(`Operator session returned HTTP ${response.status}.`);
    }
    return (await response.json()) as Record<string, unknown>;
  });
  expect(session.authenticated).toBe(true);
  expect(session.status).toBe("operator_authenticated");
}

async function createWorkspace(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const sidebar = page.getByLabel("SpecSpace Sidebar");
  await sidebar.getByRole("button", { name: "New workspace" }).click();
  const wizard = page.getByRole("dialog", { name: "New workspace" });
  await wizard.getByRole("textbox", { name: "Workspace display name" }).fill(
    displayName,
  );
  await wizard.getByRole("textbox", { name: "Initial idea" }).fill(rawIdea);
  await expect(wizard.getByTestId("new-idea-workspace-route")).toContainText(
    `/${workspaceId}`,
  );
  await wizard.getByRole("button", { name: "Create workspace request" }).click();
  await expect(page).toHaveURL(new RegExp(`/${workspaceId}$`));
  await expect(page.getByTestId("workspace-creation-status")).toContainText(
    "Workspace creation requested",
  );
}

function answerValue(requestId: string, index: number): string {
  const entries = (value: readonly Record<string, unknown>[]) =>
    JSON.stringify(value, null, 2);
  const values: Record<string, string> = {
    "clarification.intake.question-active-frame-ontology-refs":
      "ontology://specgraph-core",
    "clarification.intake.question-active-frame-ontology-layer-refs":
      "objective\nmechanics",
    "clarification.intake.question-active-frame-domain-refs":
      "domain.mac_specification_workbench",
    "clarification.intake.question-active-frame-context-refs":
      "context.idea_to_spec\ncontext.mac_specification_workbench",
    "clarification.intake.question-active-frame-model-applicability-refs":
      "model-applicability://specgraph-core/product-spec-mvp",
    "clarification.intake.question-event-storming-actors":
      entries([
        { id: "actor.specification-author", name: "Specification author" },
        { id: "actor.product-reviewer", name: "Product reviewer" },
      ]),
    "clarification.intake.question-event-storming-domain-events":
      entries([
        {
          id: "event.product-idea-submitted",
          name: "Product idea submitted",
          actor_refs: ["actor.specification-author"],
        },
        {
          id: "event.clarification-accepted",
          name: "Clarification accepted",
          actor_refs: ["actor.specification-author"],
        },
        {
          id: "event.specification-draft-generated",
          name: "Specification draft generated",
          actor_refs: ["actor.product-reviewer"],
        },
      ]),
    "clarification.intake.question-event-storming-commands":
      entries([
        {
          id: "command.submit-product-idea",
          name: "Submit product idea",
          actor_refs: ["actor.specification-author"],
          produces_event_refs: ["event.product-idea-submitted"],
        },
        {
          id: "command.answer-clarification",
          name: "Answer clarification",
          actor_refs: ["actor.specification-author"],
          produces_event_refs: ["event.clarification-accepted"],
        },
        {
          id: "command.generate-specification-draft",
          name: "Generate specification draft",
          actor_refs: ["actor.product-reviewer"],
          produces_event_refs: ["event.specification-draft-generated"],
        },
      ]),
    "clarification.intake.question-event-storming-policies":
      entries([
        {
          id: "policy.required-clarifications",
          name: "Required clarifications policy",
          trigger_event_refs: ["event.clarification-accepted"],
          command_refs: ["command.generate-specification-draft"],
        },
      ]),
    "clarification.intake.question-event-storming-constraints":
      entries([
        {
          id: "constraint.restart-continuity",
          statement: "Workspace state survives restart.",
          command_refs: ["command.generate-specification-draft"],
        },
        {
          id: "constraint.raw-idea-private",
          statement: "Raw idea remains private.",
          command_refs: ["command.submit-product-idea"],
        },
        {
          id: "constraint.git-review-required",
          statement: "Git publication requires separate review.",
          command_refs: ["command.generate-specification-draft"],
        },
      ]),
  };
  return values[requestId] ?? `Operator clarification ${index + 1}`;
}

async function saveClarificationAnswers(page: Page) {
  const fields = page.locator(
    'textarea[data-testid^="intake-clarification-answer-"]',
  );
  const count = await fields.count();
  expect(count, "SpecGraph must publish browser-answerable clarification fields").toBeGreaterThan(
    0,
  );
  const requestIds = await fields.evaluateAll((elements) =>
    elements.map((element) =>
      (element.getAttribute("data-testid") ?? "").replace(
        "intake-clarification-answer-",
        "",
      ),
    ),
  );
  expect(requestIds.every(Boolean), "Every clarification field must identify its request").toBe(
    true,
  );
  for (const [index, requestId] of requestIds.entries()) {
    await page
      .getByTestId(`intake-clarification-answer-${requestId}`)
      .fill(answerValue(requestId, index));
    await page.getByTestId(`intake-clarification-answer-save-${requestId}`).click();
    await expect
      .poll(async () => {
        const state = await privateState(
          page,
          "/api/v1/idea-to-spec-intake-clarification-answers",
        );
        const answers = Array.isArray(state.answers) ? state.answers : [];
        return answers.some(
          (item) =>
            record(item).request_id === requestId &&
            record(item).status === "accepted_for_candidate",
        );
      })
      .toBe(true);
  }
}

async function workspacePayload(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async (selectedWorkspaceId) => {
    const response = await fetch(
      `/api/v1/idea-to-spec-workspace?workspace=${encodeURIComponent(selectedWorkspaceId)}`,
    );
    if (!response.ok) {
      throw new Error(`Product Workspace API returned HTTP ${response.status}.`);
    }
    return (await response.json()) as Record<string, unknown>;
  }, workspaceId);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function gitSnapshot(repository: string): Promise<GitSnapshot> {
  const [head, status] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repository }),
    execFileAsync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: repository,
    }),
  ]);
  return {
    head: head.stdout.trim(),
    tracked_status: status.stdout.trim(),
  };
}

async function privateState(
  page: Page,
  route: string,
): Promise<Record<string, unknown>> {
  return page.evaluate(async ({ selectedWorkspaceId, selectedRoute }) => {
    const response = await fetch(
      `${selectedRoute}?workspace=${encodeURIComponent(selectedWorkspaceId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`${selectedRoute} returned HTTP ${response.status}.`);
    }
    return (await response.json()) as Record<string, unknown>;
  }, { selectedWorkspaceId: workspaceId, selectedRoute: route });
}

function workspaceRequest(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const activeRequest = record(state.active_request);
  if (activeRequest.workspace_id === workspaceId) return activeRequest;
  const requests = Array.isArray(state.requests) ? state.requests : [];
  const request = requests
    .filter((item) => record(item).workspace_id === workspaceId)
    .map(record)
    .sort((left, right) =>
      String(
        right.updated_at ?? right.created_at ?? right.request_id ?? "",
      ).localeCompare(
        String(left.updated_at ?? left.created_at ?? left.request_id ?? ""),
      ),
    )[0];
  if (!request) throw new Error(`No persisted request for ${workspaceId}.`);
  return record(request);
}

async function operatorStateSnapshot(page: Page): Promise<OperatorStateSnapshot> {
  const [creation, entry, answers, continuation] = await Promise.all([
    privateState(page, "/api/v1/product-workspace-creation-requests"),
    privateState(page, "/api/v1/real-idea-entry-requests"),
    privateState(page, "/api/v1/idea-to-spec-intake-clarification-answers"),
    privateState(
      page,
      "/api/v1/real-idea-answer-continuation-execution-requests",
    ),
  ]);
  const creationRequest = workspaceRequest(creation);
  const entryRequest = workspaceRequest(entry);
  const continuationRequest = workspaceRequest(continuation);
  const answerSummary = record(answers.summary);
  return {
    creation_request: {
      request_id: String(creationRequest.request_id ?? ""),
      status: String(creationRequest.status ?? ""),
    },
    idea_entry_request: {
      request_id: String(entryRequest.request_id ?? ""),
      status: String(entryRequest.status ?? ""),
    },
    clarification_answers: {
      answer_count: Number(answerSummary.answer_count ?? 0),
      accepted_answer_count: Number(answerSummary.accepted_answer_count ?? 0),
    },
    continuation_request: {
      request_id: String(continuationRequest.request_id ?? ""),
      status: String(continuationRequest.status ?? ""),
    },
  };
}

async function resolveWorkspaceArtifact(
  specGraphDir: string,
  ref: string,
): Promise<string> {
  const expectedPrefix = `runs/${workspaceId}/`;
  if (
    !ref.startsWith(expectedPrefix) ||
    ref.includes("\\") ||
    path.posix.normalize(ref) !== ref ||
    path.posix.isAbsolute(ref)
  ) {
    throw new Error(`Artifact ref is outside the workspace namespace: ${ref}`);
  }
  const checkoutRoot = await realpath(specGraphDir);
  const workspaceRoot = await realpath(
    path.join(checkoutRoot, "runs", workspaceId),
  );
  const target = path.join(checkoutRoot, ...ref.split("/"));
  const targetRealpath = await realpath(target);
  if (
    targetRealpath !== workspaceRoot &&
    !targetRealpath.startsWith(`${workspaceRoot}${path.sep}`)
  ) {
    throw new Error(`Artifact ref resolves outside the workspace run directory: ${ref}`);
  }
  const relative = path.relative(workspaceRoot, target);
  let cursor = workspaceRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if ((await lstat(cursor)).isSymbolicLink()) {
      throw new Error(`Artifact ref contains a symlink component: ${ref}`);
    }
  }
  return targetRealpath;
}

async function readJsonArtifact(
  specGraphDir: string,
  ref: string,
): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(await resolveWorkspaceArtifact(specGraphDir, ref), "utf8"),
  ) as Record<string, unknown>;
}

async function snapshot(page: Page): Promise<WorkspaceSnapshot> {
  const specGraphDir = requiredEnv("SPECSPACE_E2E_SPECGRAPH_DIR");
  const payload = await workspacePayload(page);
  const workspace = record(payload.workspace);
  const intake = record(payload.real_idea_intake);
  const materialization = record(payload.materialization);
  const candidateRef = String(intake.active_candidate_ref ?? "");
  if (!candidateRef.startsWith(`runs/${workspaceId}/`)) {
    throw new Error(`Unexpected candidate ref: ${candidateRef}`);
  }
  const candidatePath = await resolveWorkspaceArtifact(specGraphDir, candidateRef);
  const candidateContent = await readFile(candidatePath);
  const candidate = JSON.parse(candidateContent.toString("utf8")) as Record<string, unknown>;
  const candidateIdentity = record(candidate.candidate);
  const candidateId = String(
    candidate.candidate_id ?? candidateIdentity.candidate_id ?? "",
  );
  if (candidateId !== workspaceId) {
    throw new Error(`Candidate identity does not match the UI workspace: ${candidateId}`);
  }
  const candidateReadiness = record(candidate.readiness);
  const candidateReady = candidateReadiness.ready === true;
  const candidateReviewState = String(candidateReadiness.review_state ?? "");
  const candidateBlockers = Array.isArray(candidateReadiness.blocked_by)
    ? candidateReadiness.blocked_by.map(String).sort()
    : [];
  const expectedCandidateBlockers = new Set([
    "promotion_gate_not_ready",
    "repair_loop_not_ready",
  ]);
  if (
    !candidateReady &&
    (candidateReviewState !== "active_candidate_review_required" ||
      !candidateBlockers.includes("repair_loop_not_ready") ||
      !candidateBlockers.includes("promotion_gate_not_ready") ||
      candidateBlockers.some((blocker) => !expectedCandidateBlockers.has(blocker)))
  ) {
    throw new Error(
      `Candidate is neither ready nor in the expected repair-review state: ${JSON.stringify(candidateReadiness)}`,
    );
  }
  if (
    materialization.available !== true ||
    materialization.review_contract_trusted !== true ||
    materialization.canonical_mutations_allowed !== false ||
    materialization.tracked_artifacts_written !== false ||
    record(materialization.readiness).ready !== true
  ) {
    throw new Error("Reviewable specification materialization is not trusted and ready.");
  }
  const rows = Array.isArray(materialization.files) ? materialization.files : [];
  const specificationFiles: Array<{ path: string; sha256: string }> = [];
  for (const row of rows) {
    const ref = String(record(row).path ?? "");
    if (!ref.startsWith(`runs/${workspaceId}/`)) {
      throw new Error(`Unexpected materialized specification ref: ${ref}`);
    }
    const content = await readFile(await resolveWorkspaceArtifact(specGraphDir, ref));
    specificationFiles.push({ path: ref, sha256: sha256(content) });
  }
  specificationFiles.sort((left, right) => left.path.localeCompare(right.path));
  return {
    workspace_id: String(workspace.id ?? ""),
    candidate_id: candidateId,
    candidate_ref: candidateRef,
    candidate_sha256: sha256(candidateContent),
    candidate_readiness: {
      ready: candidateReady,
      review_state: candidateReviewState,
      blocked_by: candidateBlockers,
    },
    operator_state: await operatorStateSnapshot(page),
    specification_files: specificationFiles,
  };
}

async function assertPublicSafeOutputs(
  snapshotValue: WorkspaceSnapshot,
): Promise<ExecutionEvidence[]> {
  const specGraphDir = requiredEnv("SPECSPACE_E2E_SPECGRAPH_DIR");
  const refs = [
    snapshotValue.candidate_ref,
    ...snapshotValue.specification_files.map((item) => item.path),
    `runs/${workspaceId}/platform_real_idea_entry_intake_execution_report.json`,
    `runs/${workspaceId}/platform_real_idea_answer_continuation_execution_report.json`,
    `runs/${workspaceId}/user_idea_intake_source.json`,
    `runs/${workspaceId}/idea_event_storming_intake.json`,
    `runs/${workspaceId}/candidate_spec_graph.json`,
    `runs/${workspaceId}/candidate_spec_materialization_report.json`,
  ];
  for (const ref of refs) {
    const content = await readFile(
      await resolveWorkspaceArtifact(specGraphDir, ref),
      "utf8",
    );
    expect(content, `${ref} must not expose the raw idea`).not.toContain(rawIdea);
    expect(content, `${ref} must not use demo fallback`).not.toContain(
      "team-decision-log",
    );
  }
  const executionRefs = refs.filter((ref) => ref.includes("platform_real_idea"));
  const evidence: ExecutionEvidence[] = [];
  for (const ref of executionRefs) {
    const reportPath = await resolveWorkspaceArtifact(specGraphDir, ref);
    const content = await readFile(reportPath);
    const report = JSON.parse(content.toString("utf8")) as Record<string, unknown>;
    expect(report.canonical_mutations_allowed, ref).toBe(false);
    expect(report.tracked_artifacts_written, ref).toBe(false);
    const authority = record(report.authority_boundary);
    for (const field of [
      "executes_git_commands",
      "creates_git_commits",
      "opens_pull_requests",
      "merges_pull_requests",
      "publishes_read_models",
      "writes_ontology_packages",
      "accepts_ontology_terms",
      "mutates_canonical_specs",
      "publishes_private_artifacts",
    ]) {
      expect(authority[field], `${ref} ${field}`).toBe(false);
    }
    evidence.push({ ref, sha256: sha256(content) });
  }
  return evidence;
}

test.afterEach(async () => {
  if (process.env.SPECSPACE_MAC_RESTART_E2E === "1") {
    await runProfile("stop");
  }
});

test("preserves a UI-started specification workspace across a Mac profile restart", async ({
  page,
}) => {
  test.skip(
    process.env.SPECSPACE_MAC_RESTART_E2E !== "1",
    "Run through the Platform Mac product-workspace E2E wrapper.",
  );
  test.setTimeout(600_000);
  const artifactDir = requiredEnv("SPECSPACE_MAC_E2E_ARTIFACT_DIR");
  const specGraphDir = requiredEnv("SPECSPACE_E2E_SPECGRAPH_DIR");
  await mkdir(artifactDir, { recursive: true });
  const gitBefore = await gitSnapshot(specGraphDir);

  await authenticateOperator(page);
  await createWorkspace(page);
  await page.screenshot({ path: path.join(artifactDir, "01-workspace-created.png") });

  await expect(page.getByTestId("workspace-initialization-prepare")).toBeEnabled();
  await page.getByTestId("workspace-initialization-prepare").click();
  await expect(page.getByText("Preparation: initialization_request_prepared")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("button", { name: "Run controlled initialization" }),
  ).toBeEnabled({ timeout: 30_000 });
  const initializationResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url().includes("/api/v1/product-workspace-initialization/execute"),
  );
  await page.getByRole("button", { name: "Run controlled initialization" }).click();
  const initializationResponse = await initializationResponsePromise;
  const initializationBody = await initializationResponse.json() as Record<string, unknown>;
  expect(
    initializationResponse.ok(),
    `Initialization execution failed: ${JSON.stringify(initializationBody)}`,
  ).toBe(true);
  await expect(page.getByTestId("workspace-creation-status")).toContainText(
    "Workspace initialized through backend-owned state.",
    { timeout: 180_000 },
  );
  await page.screenshot({ path: path.join(artifactDir, "02-initialized.png") });

  await page.getByTestId("real-idea-entry-text").fill(rawIdea);
  await page.getByTestId("real-idea-entry-summary").fill(publicSummary);
  await page.getByTestId("real-idea-entry-submit").click();
  await page.getByTestId("real-idea-intake-execution-request").click();
  await expect(page.getByTestId("real-idea-intake-managed-execute")).toBeEnabled();
  await page.getByTestId("real-idea-intake-managed-execute").click();
  await expect(page.getByText("Platform intake execution", { exact: true })).toBeVisible({
    timeout: 180_000,
  });
  const intakeProjection = record((await workspacePayload(page)).real_idea_intake);
  expect(record(intakeProjection.entry_execution).ok).toBe(true);
  expect(record(intakeProjection.entry_execution).dry_run).toBe(false);
  expect(record(intakeProjection.answer_template).clarification_outcome).toBe(
    "answers_required",
  );
  expect(record(intakeProjection.clarification_progress).question_count).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(artifactDir, "03-intake.png") });

  await saveClarificationAnswers(page);
  await expect(
    page.getByTestId("guided-clarification-continuation-request"),
  ).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("guided-clarification-continuation-request").click();
  await expect(
    page.getByTestId("guided-clarification-continuation-managed-execute"),
  ).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("guided-clarification-continuation-managed-execute").click();
  await expect(page.getByText("Candidate graph").first()).toBeVisible({
    timeout: 240_000,
  });
  await expect(page.getByText("Reviewable specifications", { exact: true })).toBeVisible();
  const continuedProjection = record((await workspacePayload(page)).real_idea_intake);
  expect(continuedProjection.active_candidate_ref).toMatch(
    new RegExp(`^runs/${workspaceId}/`),
  );
  expect(record(continuedProjection.clarification_progress).missing_count).toBe(0);
  expect(record(continuedProjection.continuation_handoff).materialization_status).not.toBe(
    "missing",
  );
  const specificationList = page.getByLabel("Materialized specifications");
  await expect(specificationList.locator("button").first()).toBeVisible();
  await specificationList.locator("button").first().click();
  const materializationSection = page.locator("#idea-to-spec-materialization");
  await expect(materializationSection.locator("pre")).toContainText(
    /id:|title:/,
  );
  const expandIdeaToSpec = page.getByRole("button", { name: "Expand Idea-to-spec" });
  if (await expandIdeaToSpec.isVisible()) {
    await expandIdeaToSpec.click();
  }
  const scrolledReviewPanel = await materializationSection.evaluate((element) => {
    let ancestor = element.parentElement;
    while (ancestor) {
      const style = window.getComputedStyle(ancestor);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        ancestor.scrollHeight > ancestor.clientHeight
      ) {
        ancestor.scrollTop +=
          element.getBoundingClientRect().top - ancestor.getBoundingClientRect().top;
        return true;
      }
      ancestor = ancestor.parentElement;
    }
    return false;
  });
  expect(scrolledReviewPanel, "Reviewable specifications must have a scroll container").toBe(
    true,
  );
  await expect
    .poll(async () => (await materializationSection.boundingBox())?.y ?? Number.MAX_VALUE)
    .toBeLessThan(480);
  await page.screenshot({
    path: path.join(artifactDir, "04-reviewable-specifications.png"),
  });

  const beforeRestart = await snapshot(page);
  expect(beforeRestart.workspace_id).toBe(workspaceId);
  expect(beforeRestart.candidate_id).not.toBe("team-decision-log");
  expect(beforeRestart.specification_files.length).toBeGreaterThan(0);
  const executionEvidence = await assertPublicSafeOutputs(beforeRestart);

  await runProfile("stop");
  await runProfile("start");
  await page.goto(`/${workspaceId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Reviewable specifications", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  const afterRestart = await snapshot(page);
  expect(afterRestart).toEqual(beforeRestart);
  const gitAfter = await gitSnapshot(specGraphDir);
  expect(gitAfter).toEqual(gitBefore);
  const canonicalSpecMutation = gitBefore.tracked_status !== gitAfter.tracked_status;
  const gitMutation = gitBefore.head !== gitAfter.head;
  expect(canonicalSpecMutation).toBe(false);
  expect(gitMutation).toBe(false);
  await page.screenshot({
    path: path.join(artifactDir, "05-after-restart.png"),
    fullPage: true,
  });

  await writeFile(
    path.join(artifactDir, "product-workspace-restart-report.json"),
    `${JSON.stringify(
      {
        artifact_kind: "specspace_mac_product_workspace_restart_e2e_report",
        schema_version: 1,
        ok: true,
        workspace_id: workspaceId,
        candidate_id: beforeRestart.candidate_id,
        candidate_ref: beforeRestart.candidate_ref,
        candidate_sha256: beforeRestart.candidate_sha256,
        candidate_readiness: beforeRestart.candidate_readiness,
        operator_state: beforeRestart.operator_state,
        specification_files: beforeRestart.specification_files,
        execution_evidence: executionEvidence,
        specgraph_git: { before: gitBefore, after: gitAfter },
        raw_idea_public_leak: false,
        raw_idea_leak_scan: {
          match: "exact",
          scope: "candidate, materialized specifications, and Platform execution reports",
        },
        team_decision_log_fallback: false,
        restart_continuity: "verified",
        authority_boundary: {
          browser_executes_shell: false,
          canonical_spec_mutation: canonicalSpecMutation,
          git_mutation: gitMutation,
        },
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
});
