import { expect, test } from "@playwright/test";

test("authoring tabs preserve draft input and reveal requirement anchors", async ({ page }) => {
  await page.goto("/dev/idea-to-spec-fixtures?view=authoring");
  const questions = page.getByRole("tab", { name: "Questions", exact: true });
  await questions.click();
  const field = page.getByRole("textbox", { name: "Ontology gap term", exact: true });
  await field.fill("Unsaved fixture note");
  await page.getByRole("tab", { name: "Update candidate", exact: true }).click();
  await expect(page.getByText("Guided repair path", { exact: true })).toBeVisible();
  await questions.click();
  await expect(field).toHaveValue("Unsaved fixture note");
  await page.getByRole("link", { name: "Inspect requirement: Numeric input", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Specification", exact: true })).toHaveAttribute("aria-selected", "true");
  const selectedFile = page.getByRole("button", { pressed: true }).filter({ hasText: "Numeric input" });
  await expect(selectedFile).toBeVisible();
  const tabsBounds = await page.getByRole("tablist", { name: "Specification authoring" }).boundingBox();
  expect(tabsBounds?.y).toBeGreaterThanOrEqual(0);
  await questions.click();
  await expect(field).toHaveValue("Unsaved fixture note");
});

test("authoring tabs stay usable on a narrow viewport and support keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/idea-to-spec-fixtures?view=authoring");
  const questions = page.getByRole("tab", { name: "Questions", exact: true });
  await questions.click();
  await questions.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Update candidate", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "Update candidate", exact: true }).press("End");
  await expect(page.getByRole("tab", { name: "Diagnostics", exact: true })).toHaveAttribute("aria-selected", "true");
  const bounds = await page.getByRole("tablist", { name: "Specification authoring" }).boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
