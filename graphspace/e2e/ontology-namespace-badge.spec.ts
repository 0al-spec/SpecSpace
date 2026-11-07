import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const fixture = path.resolve("src/widgets/ontology-explorer/model/membership.fixture.json");

for (const width of [390, 1280]) {
  test(`namespace badge stays inside a real ontology card at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/ui-catalog#ontology-membership");
    const section = page.locator("#ontology-membership");
    const action = section.locator('[data-id="classes/membership:AddRepository"]');
    await expect(action.locator(".node-header strong")).toHaveText("AddRepository");
    await expect(action.locator(".node-namespace")).toHaveText("membership");
    await expect(action.locator(".node-header strong")).toHaveAttribute(
      "title",
      "membership:AddRepository",
    );
    await expect(action.locator(".node-port")).toContainText("repository: Ref<Repository>");
    const geometry = await action.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      const kind = node.querySelector(".node-kind")!.getBoundingClientRect();
      const badge = node.querySelector(".node-namespace")!.getBoundingClientRect();
      const name = node.querySelector("strong")!.getBoundingClientRect();
      return {
        separate: kind.right <= badge.left,
        within: badge.right <= bounds.right,
        aboveName: badge.bottom <= name.top,
      };
    });
    expect(geometry).toEqual({ separate: true, within: true, aboveName: true });
    await section.scrollIntoViewIfNeeded();
    await section.getByRole("button", { name: "membership:AddRepository action" }).click();
    await expect.poll(async () => (await action.boundingBox())?.width ?? 0).toBeGreaterThan(200);
    await page.screenshot({
      path: testInfo.outputPath(`catalog-${width}.png`),
    });
    await action.screenshot({ path: testInfo.outputPath(`card-${width}.png`) });

    await page.goto("/ontology?source=local");
    await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
    await page.getByLabel("Search graph").fill("membership:AddRepository");
    await page.getByRole("button", { name: "membership:AddRepository action" }).click();
    await expect(page.getByLabel("Inspector").getByRole("heading")).toHaveText(
      "membership:AddRepository",
    );
  });
}

test("SpecSpace retains the identity of an unloaded transitive dependency", async ({ page }) => {
  const projection = JSON.parse(readFileSync(fixture, "utf8"));
  projection.externalImports = [
    { id: "example.core", version: "1.2.0", alias: "pkg-core-123456789abc" },
  ];
  projection.classes.find((item: { id: string }) => item.id === "Project").extends =
    "pkg-core-123456789abc:Base";
  await page.goto("/ontology?source=local");
  await page.getByLabel("Open ontology artifact").setInputFiles({
    name: "transitive.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(projection)),
  });
  await page.getByLabel("Search graph").fill("pkg-core-123456789abc:Base");
  await page.getByRole("button", { name: /pkg-core-123456789abc:Base/ }).click();
  await expect(page.getByLabel("Inspector")).toContainText("unloaded reference");
  await expect(page.getByLabel("Inspector")).toContainText("example.core@1.2.0");
});

test("SpecSpace recognizes actions from an unloaded transitive foundation", async ({ page }) => {
  const projection = JSON.parse(readFileSync(fixture, "utf8"));
  projection.imports = [];
  projection.externalImports = [
    { id: "ontology.foundation", version: "0.2.0", alias: "pkg-foundation-1234" },
  ];
  projection.relations = [];
  projection.classes.find((item: { id: string }) => item.id === "AddRepository").extends =
    "pkg-foundation-1234:Action";
  await page.goto("/ontology?source=local");
  await page.getByLabel("Open ontology artifact").setInputFiles({
    name: "transitive-foundation.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(projection)),
  });
  await page.getByRole("button", { name: "membership:AddRepository action" }).click();
  await expect(page.getByLabel("Inspector")).toContainText("Action");
});
