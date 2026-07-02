import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IdeaToSpecFixtureGalleryPage } from "./IdeaToSpecFixtureGalleryPage";

describe("IdeaToSpecFixtureGalleryPage", () => {
  it("renders the Team Decision fixture in addressable rail and overlay frames", () => {
    const html = renderToStaticMarkup(createElement(IdeaToSpecFixtureGalleryPage));

    expect(html).toContain("Idea-to-spec fixture gallery");
    expect(html).toContain("Report status row");
    expect(html).toContain('data-testid="report-status-row-example"');
    expect(html).toContain("/tmp/runs/idea_maturity_metrics_report.json");
    expect(html).toContain("diagnostics 0");
    expect(html).toContain("Team Decision Log");
    expect(html).toContain('id="team-decision-rail"');
    expect(html).toContain('id="team-decision-overlay"');
    expect(html).toContain('data-testid="team-decision-rail-frame"');
    expect(html).toContain('data-testid="team-decision-overlay-frame"');
    const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(nav).not.toContain("#idea-to-spec-candidate-graph");
    expect(html).toContain("Capture team decisions with explicit owner and outcome.");
    expect(html).toContain("Decision capture, review, and retrieval for one product team.");
    expect(html).toContain("disabled=\"\"");
  });
});
