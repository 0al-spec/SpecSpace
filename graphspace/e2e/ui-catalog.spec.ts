import { expect, test } from "@playwright/test";

for (const width of [390, 1600]) {
  test(`spec graph fixture stays inside its catalog section at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/ui-catalog#spec-graph-layout");
    const section = page.locator("#spec-graph-layout");
    const canvas = section.getByRole("region", { name: "SpecGraph canvas" });
    await expect(canvas).toBeVisible();
    const geometry = await canvas.evaluate((element) => {
      const canvasRect = element.getBoundingClientRect();
      const parentRect = element.parentElement!.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        top: canvasRect.top,
        bottom: canvasRect.bottom,
        parentTop: parentRect.top,
        parentBottom: parentRect.bottom,
        height: canvasRect.height,
      };
    });
    expect(geometry.position).toBe("absolute");
    expect(geometry.height).toBeCloseTo(520, 0);
    expect(geometry.top).toBeCloseTo(geometry.parentTop, 0);
    expect(geometry.bottom).toBeCloseTo(geometry.parentBottom, 0);
    await page.getByRole("button", { name: "Dagre layout preset" }).click();
    await expect(canvas).toHaveAttribute("data-layout-preset", "dagre");
    await expect(page.locator("#ontology-explorer")).toBeVisible();
  });
}
