import { expect, test } from "@playwright/test";
import path from "node:path";

const fixture = path.resolve("src/widgets/ontology-explorer/model/membership.fixture.json");

for (const width of [390, 1280]) {
  test(`action and reference ports remain connected in all layouts at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/ontology?source=local");
    await page.getByLabel("Open ontology artifact").setInputFiles(fixture);
    const canvas = page.getByLabel("Ontology graph", { exact: true });
    await expect(page.getByLabel("Declaration catalog")).toContainText("Actions");
    await expect(page.getByLabel("Declaration catalog")).toContainText("Relationships");
    const edges = [
      "role/membership:addsRepositoryTo/subject",
      "role/membership:addsRepositoryTo/action",
      "role/membership:addsRepositoryTo/object/0",
      "field/membership:AddRepository/repository",
    ];
    for (const layout of ["LR", "RL", "directed"]) {
      await page.getByLabel("Graph direction").selectOption(layout);
      for (const edge of edges) {
        const item = canvas.locator(`.react-flow__edge[data-id="${edge}"]`);
        await expect(item).toHaveCount(1);
        await expect(item.locator("path.react-flow__edge-path")).toHaveAttribute("d", /[CL]/);
      }
    }
    await page.getByRole("button", { name: "membership:addsRepositoryTo relation" }).click();
    const inspector = page.getByLabel("Inspector");
    await expect(inspector).toContainText("Subject");
    await inspector.getByRole("button", { name: "membership:AddRepository" }).click();
    await inspector.getByRole("button", { name: "repository: Ref<Repository>" }).click();
    await expect(inspector.getByRole("heading", { name: "membership:Repository" })).toBeVisible();
    expect(errors.filter((error) => /handle|edge/i.test(error))).toEqual([]);
  });
}

test("published SpecGraph projection still opens in all layouts", async ({ page }) => {
  const projection = path.resolve(
    "src/widgets/ontology-explorer/model/specgraph-core.fixture.json",
  );
  await page.goto("/ontology?source=local");
  await page.getByLabel("Open ontology artifact").setInputFiles(projection);
  await expect(page.getByRole("heading", { name: "org.0al.specgraph.core" })).toBeVisible();
  const canvas = page.getByLabel("Ontology graph", { exact: true });
  for (const layout of ["LR", "RL", "directed"]) {
    await page.getByLabel("Graph direction").selectOption(layout);
    await expect(canvas.locator(".react-flow__node")).toHaveCount(21);
    await expect(canvas.locator(".react-flow__edge")).toHaveCount(36);
  }
});
