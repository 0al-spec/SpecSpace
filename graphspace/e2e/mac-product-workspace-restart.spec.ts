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
  specification_files: Array<{ path: string; sha256: string }>;
};

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
  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    const testId = await field.getAttribute("data-testid");
    if (!testId) throw new Error("Clarification field has no test id.");
    const requestId = testId.replace("intake-clarification-answer-", "");
    await field.fill(answerValue(requestId, index));
    await page.getByTestId(`intake-clarification-answer-save-${requestId}`).click();
  }
  if (count > 0) {
    await expect(
      page.locator('[data-testid^="intake-clarification-answer-saved-"]'),
    ).toHaveCount(count);
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
  const candidate = await readJsonArtifact(specGraphDir, candidateRef);
  const candidateIdentity = record(candidate.candidate);
  const candidateId = String(
    candidate.candidate_id ?? candidateIdentity.candidate_id ?? "",
  );
  if (candidateId !== workspaceId) {
    throw new Error(`Candidate identity does not match the UI workspace: ${candidateId}`);
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
    workspace_id: String(workspace.id ?? workspaceId),
    candidate_id: candidateId,
    candidate_ref: candidateRef,
    specification_files: specificationFiles,
  };
}

async function assertPublicSafeOutputs(snapshotValue: WorkspaceSnapshot) {
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
}

test("preserves a UI-started specification workspace across a Mac profile restart", async ({
  page,
}) => {
  test.skip(
    process.env.SPECSPACE_MAC_RESTART_E2E !== "1",
    "Run through the Platform Mac product-workspace E2E wrapper.",
  );
  test.setTimeout(600_000);
  const artifactDir = requiredEnv("SPECSPACE_MAC_E2E_ARTIFACT_DIR");
  await mkdir(artifactDir, { recursive: true });

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
  await page.getByRole("button", { name: "Run controlled initialization" }).click();
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
  await expect(page.locator("#idea-to-spec-materialization pre")).toContainText(
    /id:|title:/,
  );
  await page.screenshot({
    path: path.join(artifactDir, "04-reviewable-specifications.png"),
    fullPage: true,
  });

  const beforeRestart = await snapshot(page);
  expect(beforeRestart.workspace_id).toBe(workspaceId);
  expect(beforeRestart.candidate_id).not.toBe("team-decision-log");
  expect(beforeRestart.specification_files.length).toBeGreaterThan(0);
  await assertPublicSafeOutputs(beforeRestart);

  await runProfile("stop");
  await runProfile("start");
  await page.goto(`/${workspaceId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Reviewable specifications", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  const afterRestart = await snapshot(page);
  expect(afterRestart).toEqual(beforeRestart);
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
        specification_files: beforeRestart.specification_files,
        raw_idea_public_leak: false,
        team_decision_log_fallback: false,
        restart_continuity: "verified",
        authority_boundary: {
          browser_executes_shell: false,
          canonical_spec_mutation: false,
          ontology_mutation: false,
          git_mutation: false,
        },
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
});
