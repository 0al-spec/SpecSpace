import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import path from "node:path";
const fixture = path.resolve("src/widgets/ontology-explorer/model/motivation-full.fixture.json");
const legacy = path.resolve(
  "src/pages/ontology-viewer/model/ontology-graph-contract/fixtures/ontology_normalized_ir.specgraph-core.min.json",
);

for (const mobile of [false, true]) {
  test(`ontology explorer ${mobile ? "mobile" : "desktop"} read-only delivery`, async ({
    page,
  }, info) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
    );
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.url());
    });
    await page.goto("/ontology?source=local");
    await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
    await expect(page.getByText("PACKAGE · READ ONLY")).toBeVisible();
    const canvas = page.getByLabel("Ontology graph", { exact: true });
    await expect(canvas.locator(".react-flow__node").first()).toBeVisible();
    await page.getByLabel("Search graph", { exact: true }).fill("motivcore:Motive");
    await page.getByRole("button", { name: "motivcore:Motive class", exact: true }).click();
    await expect(page.getByLabel("Inspector")).toContainText("/spec/classes/Motive");
    await expect(page.getByLabel("Inspector")).toContainText("File SHA-256");
    await page.getByLabel("Search graph", { exact: true }).fill("");
    const selected = canvas.locator('[data-id="classes/motivcore:Motive"]');
    const before = await selected.getAttribute("style");
    await page.getByText("Filters", { exact: true }).click();
    const imported = page.getByRole("checkbox", { name: "Classes", exact: true });
    await imported.uncheck();
    await expect(page.getByText("This selection is outside the active filters.")).toBeVisible();
    await page.getByRole("radio", { name: "Dim", exact: true }).check();
    await expect(canvas.locator(".react-flow__node.filter-dim").first()).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(selected).toHaveAttribute("style", before!);
    const packageFilter = page.getByRole("checkbox", {
      name: "Package org.0al.events.core@0.2.0",
      exact: true,
    });
    const completeCount = await canvas.locator(".react-flow__node").count();
    await packageFilter.uncheck();
    await expect
      .poll(() => canvas.locator(".react-flow__node").count())
      .toBeLessThan(completeCount);
    await page.getByRole("button", { name: "Reset filters" }).click();
    await page.getByText("Filters", { exact: true }).click();
    const malformed = JSON.parse(readFileSync(fixture, "utf8"));
    malformed.schemaVersion = "ontology.diagram-projection/v999";
    await page.getByLabel("Open ontology artifact").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(malformed)),
    });
    await expect(page.getByRole("alert")).toContainText("Unsupported schemaVersion");
    await expect(page.getByLabel("Inspector")).toContainText("motivcore:Motive");
    await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByLabel("Search graph", { exact: true }).fill("motivcore:Motive");
    await page.getByRole("button", { name: "motivcore:Motive class", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(canvas.locator(".react-flow__viewport")).toHaveAttribute("style", /scale\(1\)/);
    await page.getByLabel("Inspector").scrollIntoViewIfNeeded();
    await expect(page.getByLabel("Inspector")).toBeVisible();
    await page.screenshot({ path: info.outputPath("ontology-explorer.png"), fullPage: true });
    await page.getByLabel("Open ontology artifact").setInputFiles({
      name: "ontology.normalized.json",
      mimeType: "application/json",
      buffer: readFileSync(legacy),
    });
    await expect(page.getByText("local artifact viewer")).toBeVisible();
    await expect(page.getByText("Package", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
    await expect(page.getByText("PACKAGE · READ ONLY")).toBeVisible();
    if (!mobile) {
      // A tiny archive whose header declares an oversized expansion is rejected
      // without replacing the currently displayed graph.
      const name = Buffer.from("large.json");
      const archive = Buffer.alloc(30 + name.length);
      archive.writeUInt32LE(0x04034b50, 0);
      archive.writeUInt16LE(20, 4);
      archive.writeUInt16LE(8, 8);
      archive.writeUInt32LE(33 * 1024 * 1024, 22);
      archive.writeUInt16LE(name.length, 26);
      name.copy(archive, 30);
      await page.getByLabel("Open ontology artifact").setInputFiles({
        name: "oversized.zip",
        mimeType: "application/zip",
        buffer: archive,
      });
      await expect(page.getByRole("alert")).toContainText("expanded-size limit");
      await expect(canvas.locator(".react-flow__node").first()).toBeVisible();
      // Exercise the browser's real deflate-raw stream, including a lying
      // uncompressed-size header, before returning to the existing view.
      const compressed = deflateRawSync(Buffer.from("hello"));
      const malformedZip = Buffer.concat([archive, compressed]);
      malformedZip.writeUInt32LE(compressed.length, 18);
      malformedZip.writeUInt32LE(4, 22);
      await page.getByLabel("Open ontology artifact").setInputFiles({
        name: "wrong-size.zip",
        mimeType: "application/zip",
        buffer: malformedZip,
      });
      await expect(page.getByRole("alert")).toContainText("declared uncompressed size");
      await expect(canvas.locator(".react-flow__node").first()).toBeVisible();
      await page.evaluate(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () {
          if (this.name === "unreadable.json") throw new Error("Simulated unreadable file");
          if (this.name === "slow.json") {
            await new Promise((resolve) => setTimeout(resolve, 300));
            (window as unknown as Record<string, unknown>).slowReadFinished = true;
          }
          return original.call(this);
        };
      });
      await page.getByLabel("Open ontology artifact").setInputFiles({
        name: "unreadable.json",
        mimeType: "application/json",
        buffer: readFileSync(fixture),
      });
      await expect(page.getByRole("alert")).toContainText("Simulated unreadable file");
      await expect(page.getByText("PACKAGE · READ ONLY")).toBeVisible();
      await page.getByLabel("Open ontology artifact").setInputFiles({
        name: "slow.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(malformed)),
      });
      await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as Record<string, unknown>).slowReadFinished),
        )
        .toBe(true);
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    expect(mutations).toEqual([]);
  });
}

for (const mobile of [false, true]) {
  test(`published workspace autoload ${mobile ? "mobile" : "desktop"}`, async ({ page }, info) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
    );
    const graph = JSON.parse(readFileSync(fixture, "utf8"));
    const requests: string[] = [];
    await page.route("**/api/v1/artifacts**", async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.pathname + url.search);
      expect(url.searchParams.get("workspace")).toBe("product-one");
      const base = {
        api_version: "v1",
        schema_version: 1,
        read_only: true,
        source: { workspace_id: "product-one" },
      };
      await route.fulfill({
        json: url.pathname.endsWith("/content")
          ? {
              ...base,
              artifact_kind: "specspace_artifact_content",
              path: "runs/product-one/ontology.graph.json",
              content_kind: "json",
              sha256: "a".repeat(64),
              data: graph,
            }
          : {
              ...base,
              artifact_kind: "specspace_artifact_catalog",
              artifacts: [{ path: "runs/product-one/ontology.graph.json", sha256: "a".repeat(64) }],
            },
      });
    });
    await page.goto("/ontology?workspace=product-one");
    await expect(page.getByText("Published diagram projection", { exact: false })).toBeVisible();
    await expect(page.getByText("PACKAGE · READ ONLY")).toBeVisible();
    await page.getByLabel("Search graph", { exact: true }).fill("motivcore:Motive");
    await page.getByRole("button", { name: "motivcore:Motive class", exact: true }).click();
    await expect(page.getByLabel("Inspector")).toContainText("/spec/classes/Motive");
    await expect(page.locator(".react-flow__viewport")).toHaveAttribute("style", /scale\(1\)/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath("published-ontology.png"), fullPage: true });
    expect(new Set(requests).size).toBe(2);
    expect(requests.filter((url) => url.includes("/content?"))).toHaveLength(1);
  });
}

for (const mobile of [false, true]) {
  test(`published combined draft shows action relationships ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
    );
    const path = "specs/models/review/ontology-overview/generated/ontology.graph.json";
    const graph = JSON.parse(
      readFileSync(
        "src/widgets/ontology-explorer/model/publication-verification.fixture.json",
        "utf8",
      ),
    );
    const common = {
      api_version: "v1",
      schema_version: 1,
      read_only: true,
      source: { provider: "http", artifact_base_url: "https://specgraph.tech" },
    };
    await page.route("**/api/v1/artifacts?**", (route) =>
      route.fulfill({
        json: {
          ...common,
          artifact_kind: "specspace_artifact_catalog",
          artifacts: [{ path, sha256: "a".repeat(64) }],
        },
      }),
    );
    await page.route("**/api/v1/public-specgraph-ontology-overview-graph", (route) =>
      route.fulfill({
        json: {
          ...common,
          artifact_kind: "specspace_artifact_content",
          path,
          content_kind: "json",
          sha256: "a".repeat(64),
          data: graph,
        },
      }),
    );
    await page.goto("/ontology");
    await expect(
      page.getByText("Published combined ontology · draft", { exact: false }),
    ).toBeVisible();
    const relationship = page.locator('[data-id="relations/pubverify:verifiesPublishedBundle"]');
    await expect(relationship).toBeVisible();
    await expect(relationship).toContainText("subject:");
    await expect(relationship).toContainText("action:");
    await expect(relationship).toContainText("object:");
  });
}

test("missing published data stays scoped and allows a local file", async ({ page }) => {
  await page.route("**/api/v1/artifacts**", (route) =>
    route.fulfill({
      json: {
        api_version: "v1",
        schema_version: 1,
        artifact_kind: "specspace_artifact_catalog",
        read_only: true,
        source: { workspace_id: "product-one" },
        artifacts: [],
      },
    }),
  );
  await page.goto("/ontology?workspace=product-one");
  await expect(page.getByText("No ontology graph is published", { exact: false })).toBeVisible();
  await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
  await expect(page.getByText("Local file selected.", { exact: false })).toBeVisible();
  await expect(page.getByText("PACKAGE · READ ONLY")).toBeVisible();
});

test("invalid published workspace identity never defaults to bootstrap", async ({ page }) => {
  let reads = 0;
  await page.route("**/api/v1/**", (route) => {
    reads++;
    return route.abort();
  });
  await page.goto("/ontology?workspace=../foreign");
  await expect(page.getByRole("alert")).toContainText("Invalid workspace");
  expect(reads).toBe(0);
});

test("reload after a failed choice restores published package selection", async ({ page }) => {
  const broken = "runs/broken/ontology.graph.json";
  const valid = "runs/valid/ontology.graph.json";
  const graph = JSON.parse(readFileSync(fixture, "utf8"));
  await page.route("**/api/v1/artifacts**", async (route) => {
    const url = new URL(route.request().url());
    const base = {
      api_version: "v1",
      schema_version: 1,
      read_only: true,
      source: { workspace_id: "product-one" },
    };
    const selected = url.searchParams.get("path");
    await route.fulfill({
      json: url.pathname.endsWith("/content")
        ? {
            ...base,
            artifact_kind: "specspace_artifact_content",
            path: selected,
            content_kind: "json",
            data: selected === broken ? { schemaVersion: "broken" } : graph,
          }
        : {
            ...base,
            artifact_kind: "specspace_artifact_catalog",
            artifacts: [{ path: broken }, { path: valid }],
          },
    });
  });
  await page.goto("/ontology?workspace=product-one");
  await page.getByLabel("Choose published ontology").selectOption(broken);
  await expect(page.getByRole("alert")).toContainText("Unsupported");
  await page.getByRole("button", { name: "Reload published ontology" }).click();
  await expect(page.getByLabel("Choose published ontology")).toBeVisible();
  await page.getByLabel("Choose published ontology").selectOption(valid);
  await expect(page.getByText("Published diagram projection", { exact: false })).toBeVisible();
  await expect(page.getByText("PACKAGE · READ ONLY")).toBeVisible();
});
