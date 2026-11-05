import { expect, test } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";

const legacy = path.resolve(
  "src/pages/ontology-viewer/model/ontology-graph-contract/fixtures/ontology_normalized_ir.specgraph-core.min.json",
);

for (const mobile of [false, true]) {
  test(`normalized ontology relations render as edges on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
    );
    await page.goto("/ontology?source=local");
    await page.getByLabel("Open ontology artifact").setInputFiles({
      name: "ontology.normalized.json",
      mimeType: "application/json",
      buffer: readFileSync(legacy),
    });
    const graph = page.getByLabel("Ontology graph canvas");
    await expect(graph.locator(".react-flow__node")).toHaveCount(3);
    const paths = graph.locator(".react-flow__edge-path");
    await expect(paths).toHaveCount(3);
    const painted = await paths.evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(element);
        return (
          element instanceof SVGGeometryElement &&
          element.getTotalLength() > 0 &&
          style.stroke !== "none" &&
          style.visibility === "visible" &&
          Number(style.opacity) > 0
        );
      }),
    );
    expect(painted).toBe(true);
  });
}
