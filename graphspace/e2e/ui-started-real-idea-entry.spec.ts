import { expect, test, type Page, type Route } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ideaToSpecWorkspace } from "../src/pages/viewer/model/idea-to-spec-workspace.fixture";

const workspaceId = "team-decision-log";

type SpecSpaceBackend = {
  baseUrl: string;
  stop: () => Promise<void>;
};

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repoPython = path.join(repoRoot, ".venv/bin/python");

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

async function startSpecSpaceBackend(): Promise<SpecSpaceBackend> {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "specspace-ui-e2e-"));
  const dialogDir = path.join(tmpRoot, "dialogs");
  const stateDir = path.join(tmpRoot, "state");
  await mkdir(dialogDir, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  const port = await freePort();
  const python = process.env.PYTHON ?? (existsSync(repoPython) ? repoPython : "python3");
  const child = spawn(
    python,
    [
      "viewer/server.py",
      "--port",
      String(port),
      "--dialog-dir",
      dialogDir,
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
    stop: async () => {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
      await rm(tmpRoot, { recursive: true, force: true });
    },
  };
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

async function workspacePayload(backendBaseUrl: string) {
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
  if (!hasSubmittedEntry) return payload;
  const actionBoundary = {
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

  payload.real_idea_intake = {
    ...((payload.real_idea_intake as Record<string, unknown>) ?? {}),
    available: true,
    status: "entry_submitted",
    next_action:
      "Import the submitted raw idea entry through SpecGraph/Platform intake handoff.",
    blockers: [],
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

async function installIdeaToSpecApiRoutes(page: Page, backendBaseUrl: string) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/v1/idea-to-spec-workspace") {
      await route.fulfill({ json: await workspacePayload(backendBaseUrl) });
      return;
    }

    if (path === "/api/v1/real-idea-entry-requests") {
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
