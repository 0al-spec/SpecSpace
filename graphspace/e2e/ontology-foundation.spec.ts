import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const fixture = path.resolve("src/widgets/ontology-explorer/model/foundation-model.fixture.json");

for (const width of [390, 1280]) {
  test(`foundation definitions retain their source in the Viewer at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/ontology?source=local");
    await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
    await page.getByLabel("Graph direction").selectOption("types");
    await page.getByRole("radio", { name: "Curve", exact: true }).check();
    await page.getByLabel("Search graph").fill("sg:DomainEntity");
    await page.getByRole("button", { name: /sg:DomainEntity imported/ }).click();
    const inspector = page.getByLabel("Inspector");
    await expect(inspector).toContainText("specgraph.foundation");
    await expect(inspector).toContainText("ontology.foundation@0.1.0");
    await expect(inspector).toContainText("/classes/DomainEntity");
    await expect(inspector).toContainText("does not authenticate");
    const source = inspector.locator(".source-box");
    const overflow = await source.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
    const invalid = JSON.parse(readFileSync(fixture, "utf8"));
    invalid.foundationCatalogs[0].alias = "other";
    await page.getByLabel("Open ontology artifact").setInputFiles({
      name: "invalid-foundation.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
    await expect(page.getByRole("alert")).toContainText("exact import binding");
    await expect(inspector).toContainText("ontology.foundation@0.1.0");
  });
}

test("published projection preserves foundation catalog definitions", async ({ page }) => {
  const graph = JSON.parse(readFileSync(fixture, "utf8"));
  const artifactPath = "specs/models/review/ontology-overview/generated/ontology.graph.json";
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
        artifacts: [{ path: artifactPath, sha256: "a".repeat(64) }],
      },
    }),
  );
  await page.route("**/api/v1/public-specgraph-ontology-overview-graph", (route) =>
    route.fulfill({
      json: {
        ...common,
        artifact_kind: "specspace_artifact_content",
        path: artifactPath,
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
  await page.getByLabel("Search graph").fill("sg:DomainEntity");
  await page.getByRole("button", { name: /sg:DomainEntity imported/ }).click();
  await expect(page.getByLabel("Inspector")).toContainText("ontology.foundation@0.1.0");
});
