import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

test("relationship focus keeps the dependency path, filters, layout and viewport", async ({
  page,
}) => {
  const source = path.resolve(
    "src/widgets/ontology-explorer/model/publication-verification.fixture.json",
  );
  const fixture = JSON.parse(readFileSync(source, "utf8"));
  const template = fixture.classes.find((item: { id: string }) => item.id === "PublishedBundle");
  fixture.classes.push({
    ...template,
    id: "Unrelated",
    fqid: "pubverify:Unrelated",
    source: { ...template.source, pointer: "/spec/classes/Unrelated" },
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ontology?source=local");
  await page.getByLabel("Open ontology artifact").setInputFiles({
    name: "publication-with-unrelated.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByLabel("Graph direction").selectOption("types");
  await page.getByRole("radio", { name: "Curve", exact: true }).check();
  const canvas = page.getByLabel("Ontology graph", { exact: true });
  const node = (id: string) => canvas.locator(`.react-flow__node[data-id="${id}"]`);
  const edge = (id: string) => canvas.locator(`.react-flow__edge[data-id="${id}"]`);
  const relation = node("relations/pubverify:verifiesPublishedBundle");
  const unrelated = node("classes/pubverify:Unrelated");
  const retained = node("classes/pubverify:RetainedBundle");
  const base = node("external/classes/ont:DomainEntity");
  await expect(relation).toBeVisible();
  await expect(unrelated).toBeVisible();
  await page.getByLabel("Focus on relationship").check();
  await expect(page.getByRole("status")).toContainText("Select a relationship");
  const before = await unrelated.evaluate((element) => element.style.transform);
  const viewportBefore = await canvas
    .locator(".react-flow__viewport")
    .evaluate((element) => (element as HTMLElement).style.transform);
  await relation.click();
  await expect(page.getByRole("status")).toContainText("Relationship dependencies are highlighted");
  await expect(page.getByRole("status")).toContainText("unloaded external references");
  await expect(relation).not.toHaveClass(/filter-dim/);
  await expect(retained).not.toHaveClass(/filter-dim/);
  await expect(base).not.toHaveClass(/filter-dim/);
  await expect(unrelated).toHaveClass(/filter-dim/);
  await expect(edge("extends/pubverify:Unrelated")).toHaveClass(/filter-dim/);
  for (const id of [
    "role/pubverify:verifiesPublishedBundle/action",
    "field/pubverify:VerifyPublishedBundle/expectedBundle",
    "extends/pubverify:RetainedBundle",
  ]) {
    await expect(edge(id)).not.toHaveClass(/filter-dim/);
  }
  await expect.poll(() => unrelated.evaluate((element) => element.style.transform)).toBe(before);
  await expect
    .poll(() =>
      canvas
        .locator(".react-flow__viewport")
        .evaluate((element) => (element as HTMLElement).style.transform),
    )
    .toBe(viewportBefore);
  await expect(page.getByRole("radio", { name: "Curve", exact: true })).toBeChecked();

  await page.locator("summary").filter({ hasText: "Filters" }).click();
  await page.getByRole("checkbox", { name: "Unresolved", exact: true }).uncheck();
  await expect(page.getByRole("status")).toContainText("outside the active filters");
  await expect(base).not.toBeVisible();
  await page.getByRole("checkbox", { name: "Unresolved", exact: true }).check();
  await expect(base).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("outside the active filters");
  await page.getByLabel("Focus on relationship").uncheck();
  await expect(unrelated).not.toHaveClass(/filter-dim/);
  await expect.poll(() => unrelated.evaluate((element) => element.style.transform)).toBe(before);
});

for (const width of [390, 1280]) {
  test(`relationship focus in the UI catalog at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/ui-catalog#ontology-explorer");
    const section = page.locator("#ontology-explorer");
    const control = section.getByLabel("Focus on relationship");
    await section.getByLabel("Graph direction").selectOption("types");
    await control.check();
    await section
      .getByRole("button", { name: "eventcore:candidateAfterObservation relation" })
      .click();
    await expect(section.getByRole("status")).toContainText(
      "Relationship dependencies are highlighted",
    );
    await expect
      .poll(() => section.locator(".react-flow__node.filter-dim").count())
      .toBeGreaterThan(0);
    const [controlBox, sectionBox] = await Promise.all([
      control.boundingBox(),
      section.boundingBox(),
    ]);
    expect(
      controlBox &&
        sectionBox &&
        controlBox.x >= sectionBox.x &&
        controlBox.x + controlBox.width <= sectionBox.x + sectionBox.width,
    ).toBeTruthy();
    await section.screenshot({ path: testInfo.outputPath(`ontology-focus-catalog-${width}.png`) });
  });
}
