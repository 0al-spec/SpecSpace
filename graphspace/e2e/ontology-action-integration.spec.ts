import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
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
    for (const layout of ["LR", "RL", "directed", "relations", "types"]) {
      await page.getByLabel("Graph direction").selectOption(layout);
      for (const edge of edges) {
        const item = canvas.locator(`.react-flow__edge[data-id="${edge}"]`);
        await expect(item).toHaveCount(1);
        await expect(item.locator("path.react-flow__edge-path")).toHaveAttribute("d", /[CL]/);
        if (
          (layout === "directed" || layout === "relations" || layout === "types") &&
          edge.startsWith("role/")
        ) {
          await expect(item.locator("path.react-flow__edge-path")).toHaveAttribute(
            "marker-end",
            /url\(/,
          );
        }
        if (
          (layout === "directed" || layout === "relations" || layout === "types") &&
          edge === "role/membership:addsRepositoryTo/action"
        ) {
          for (const lineStyle of ["Rect", "Curve"]) {
            await page.getByRole("radio", { name: lineStyle, exact: true }).check();
            await expect
              .poll(async () =>
                item.locator("path.react-flow__edge-path").evaluate((path) => {
                  const line = path as SVGPathElement;
                  const matrix = line.getScreenCTM()!;
                  const start = line.getPointAtLength(0).matrixTransform(matrix);
                  const end = line.getPointAtLength(line.getTotalLength()).matrixTransform(matrix);
                  const graph = line.closest(".react-flow")!;
                  const source = graph
                    .querySelector(
                      '[data-id="classes/membership:AddRepository"] .react-flow__handle.source',
                    )!
                    .getBoundingClientRect();
                  const target = graph
                    .querySelector(
                      '[data-id="relations/membership:addsRepositoryTo"] .react-flow__handle.target[data-handleid="action"]',
                    )!
                    .getBoundingClientRect();
                  const center = (rect: DOMRect) => ({
                    x: rect.x + rect.width / 2,
                    y: rect.y + rect.height / 2,
                  });
                  const from = center(source),
                    to = center(target);
                  return {
                    startX: start.x >= source.left - 1 && start.x <= source.right + 1,
                    startY: start.y >= source.top - 1 && start.y <= source.bottom + 1,
                    endX: end.x >= target.left - 1 && end.x <= target.right + 1,
                    endY: end.y >= target.top - 1 && end.y <= target.bottom + 1,
                    forward: from.x < to.x,
                  };
                }),
              )
              .toEqual({ startX: true, startY: true, endX: true, endY: true, forward: true });
          }
        }
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
  for (const layout of ["LR", "RL", "directed", "relations", "types"]) {
    await page.getByLabel("Graph direction").selectOption(layout);
    await expect(canvas.locator(".react-flow__node")).toHaveCount(21);
    await expect(canvas.locator(".react-flow__edge")).toHaveCount(36);
  }
});

test("type layers use real SpecGraph relationships as well as inheritance", async ({ page }) => {
  await page.goto("/ontology?source=local");
  await page
    .getByLabel("Open ontology artifact")
    .setInputFiles(
      path.resolve("src/widgets/ontology-explorer/model/specgraph-payloadcheck.fixture.json"),
    );
  await page.getByLabel("Graph direction").selectOption("types");
  const canvas = page.getByLabel("Ontology graph", { exact: true });
  await expect(canvas.locator(".react-flow__node")).toHaveCount(26);
  await expect(canvas.locator(".react-flow__edge")).toHaveCount(43);
  await expect
    .poll(async () => {
      const ids = [
        "external/classes/sg:DomainEntity",
        "classes/sgcore:Evidence",
        "classes/payload:FetchedFileObservation",
        "classes/payload:ManifestEntry",
      ];
      const bounds = await Promise.all(
        ids.map((id) => canvas.locator(`.react-flow__node[data-id="${id}"]`).boundingBox()),
      );
      const [base, evidence, observation, manifest] = bounds;
      return Boolean(
        base &&
        evidence &&
        observation &&
        manifest &&
        base.x < evidence.x &&
        evidence.x < observation.x &&
        observation.x < manifest.x,
      );
    })
    .toBe(true);
  for (const id of ["sgcore:edgeRelatesNode", "sgcore:nodeConnectedByEdge"]) {
    await expect(
      canvas.locator(`[data-id="relation/${id}/0"] path.react-flow__edge-path`),
    ).toHaveAttribute("marker-end", /url\(/);
  }
});

test("draft publication verifier flows from base through class to relationship", async ({
  page,
}) => {
  await page.goto("/ontology?source=local");
  await page
    .getByLabel("Open ontology artifact")
    .setInputFiles(
      path.resolve("src/widgets/ontology-explorer/model/publication-verification.fixture.json"),
    );
  const canvas = page.getByLabel("Ontology graph", { exact: true });
  for (const layout of ["directed", "relations", "types"]) {
    await page.getByLabel("Graph direction").selectOption(layout);
    await page.getByRole("radio", { name: "Curve", exact: true }).check();
    const base = canvas.locator('[data-id="external/classes/ont:DomainEntity"]');
    const verifier = canvas.locator('[data-id="classes/pubverify:PublicationVerifier"]');
    const relation = canvas.locator('[data-id="relations/pubverify:verifiesPublishedBundle"]');
    if (layout === "types") {
      const action = canvas.locator('[data-id="classes/pubverify:VerifyPublishedBundle"]');
      await expect
        .poll(async () => {
          const [verifierBox, actionBox, relationBox] = await Promise.all([
            verifier.boundingBox(),
            action.boundingBox(),
            relation.boundingBox(),
          ]);
          return Boolean(
            verifierBox &&
            actionBox &&
            relationBox &&
            verifierBox.x < actionBox.x &&
            actionBox.x < relationBox.x,
          );
        })
        .toBe(true);
    }
    await expect
      .poll(async () => {
        const [baseBox, verifierBox, relationBox] = await Promise.all([
          base.boundingBox(),
          verifier.boundingBox(),
          relation.boundingBox(),
        ]);
        return Boolean(
          baseBox &&
          verifierBox &&
          relationBox &&
          baseBox.x < verifierBox.x &&
          verifierBox.x < relationBox.x,
        );
      })
      .toBe(true);
    for (const edgeId of [
      "extends/pubverify:PublicationVerifier",
      "role/pubverify:verifiesPublishedBundle/subject",
    ]) {
      await expect(
        canvas.locator(`[data-id="${edgeId}"] path.react-flow__edge-path`),
      ).toHaveAttribute("marker-end", /url\(/);
    }
    await expect(
      canvas.locator(
        '[data-id="field/pubverify:VerifyPublishedBundle/expectedBundle"] path.react-flow__edge-path',
      ),
    ).toHaveAttribute("d", /C/);
  }
  await page.getByRole("button", { name: "pubverify:verifiesPublishedBundle relation" }).click();
  const inspector = page.getByLabel("Inspector");
  await expect(inspector).toContainText("pubverify:PublicationVerifier");
  await inspector.getByRole("button", { name: "pubverify:VerifyPublishedBundle" }).click();
  await inspector.getByRole("button", { name: "expectedBundle: Ref<RetainedBundle>" }).click();
  await expect(inspector.getByRole("heading", { name: "pubverify:RetainedBundle" })).toBeVisible();
});

test("type layers separate successive generations of inheritance", async ({ page }) => {
  const file = path.resolve(
    "src/widgets/ontology-explorer/model/publication-verification.fixture.json",
  );
  const fixture = JSON.parse(readFileSync(file, "utf8"));
  const template = fixture.classes.find((item: { id: string }) => item.id === "PublishedBundle");
  const child = (id: string, parent: string) => ({
    ...template,
    id,
    fqid: `pubverify:${id}`,
    extends: `pubverify:${parent}`,
    source: { ...template.source, pointer: `/spec/classes/${id}` },
  });
  fixture.classes.push(child("DerivedBundle", "PublishedBundle"));
  fixture.classes.push(child("SpecializedBundle", "DerivedBundle"));

  await page.goto("/ontology?source=local");
  await page.getByLabel("Open ontology artifact").setInputFiles({
    name: "inheritance-example.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByLabel("Graph direction").selectOption("types");
  const canvas = page.getByLabel("Ontology graph", { exact: true });
  await expect
    .poll(async () => {
      const ids = ["PublishedBundle", "DerivedBundle", "SpecializedBundle"];
      const [base, first, second] = await Promise.all(
        ids.map((id) => canvas.locator(`[data-id="classes/pubverify:${id}"]`).boundingBox()),
      );
      return Boolean(base && first && second && base.x < first.x && first.x < second.x);
    })
    .toBe(true);
  for (const [parent, childId] of [
    ["PublishedBundle", "DerivedBundle"],
    ["DerivedBundle", "SpecializedBundle"],
  ]) {
    const edge = canvas.locator(
      `[data-id="extends/pubverify:${childId}"] path.react-flow__edge-path`,
    );
    await expect(edge).toHaveAttribute("marker-end", /url\(/);
    await expect
      .poll(async () =>
        edge.evaluate(
          (path, { parentId, child }) => {
            const line = path as SVGPathElement;
            const matrix = line.getScreenCTM()!;
            const start = line.getPointAtLength(0).matrixTransform(matrix);
            const end = line.getPointAtLength(line.getTotalLength()).matrixTransform(matrix);
            const graph = line.closest(".react-flow")!;
            const source = graph
              .querySelector(
                `[data-id="classes/pubverify:${parentId}"] .react-flow__handle.source`,
              )!
              .getBoundingClientRect();
            const target = graph
              .querySelector(`[data-id="classes/pubverify:${child}"] .react-flow__handle.target`)!
              .getBoundingClientRect();
            return (
              Math.abs(start.x - (source.x + source.width / 2)) < 2 &&
              Math.abs(start.y - (source.y + source.height / 2)) < 2 &&
              Math.abs(end.x - (target.x + target.width / 2)) < 2 &&
              Math.abs(end.y - (target.y + target.height / 2)) < 2
            );
          },
          { parentId: parent, child: childId },
        ),
      )
      .toBe(true);
  }
});

test("layered hierarchy arrows leave the base on the right and enter the subtype on the left", async ({
  page,
}) => {
  await page.goto("/ontology?source=local");
  await page
    .getByLabel("Open ontology artifact")
    .setInputFiles(path.resolve("src/widgets/ontology-explorer/model/specgraph-core.fixture.json"));
  const canvas = page.getByLabel("Ontology graph", { exact: true });
  for (const layout of ["directed", "relations", "types"]) {
    await page.getByLabel("Graph direction").selectOption(layout);
    const edge = canvas.locator('[data-id="extends/sgcore:Intent"]');
    const line = edge.locator("path.react-flow__edge-path");
    await expect(edge).toContainText("extended by");
    for (const lineStyle of ["Rect", "Curve"]) {
      await page.getByRole("radio", { name: lineStyle, exact: true }).check();
      await expect(line).toHaveAttribute("marker-end", /url\(/);
      await expect
        .poll(async () =>
          line.evaluate((path) => {
            const node = path as SVGPathElement;
            const matrix = node.getScreenCTM()!;
            const start = node.getPointAtLength(0).matrixTransform(matrix);
            const end = node.getPointAtLength(node.getTotalLength()).matrixTransform(matrix);
            const graph = node.closest(".react-flow")!;
            const base = graph
              .querySelector(
                '[data-id="external/classes/sg:DomainEntity"] .react-flow__handle.source',
              )!
              .getBoundingClientRect();
            const child = graph
              .querySelector('[data-id="classes/sgcore:Intent"] .react-flow__handle.target')!
              .getBoundingClientRect();
            const center = (rect: DOMRect) => ({
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
            });
            const from = center(base),
              to = center(child);
            return (
              Math.abs(start.x - from.x) < 2 &&
              Math.abs(start.y - from.y) < 2 &&
              Math.abs(end.x - to.x) < 2 &&
              Math.abs(end.y - to.y) < 2 &&
              from.x < to.x
            );
          }),
        )
        .toBe(true);
    }
    // Overlapping edge hit areas can intercept physical clicks; test the
    // selection contract independently of routing and hit testing.
    await edge.dispatchEvent("click");
    const inspector = page.getByLabel("Inspector");
    await expect(inspector.getByRole("heading", { name: "sgcore:Intent" })).toBeVisible();
    await inspector.getByText("Declaration data").click();
    await expect(inspector).toContainText('"extends": "sg:DomainEntity"');
  }
});
