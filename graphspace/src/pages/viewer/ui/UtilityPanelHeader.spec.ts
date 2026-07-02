import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UtilityPanelHeader } from "./UtilityPanelHeader";

describe("UtilityPanelHeader", () => {
  it("renders an icon-only expand control before close", () => {
    const html = renderToStaticMarkup(
      createElement(UtilityPanelHeader, {
        title: "Metrics viewer",
        caption: "live metrics",
        expanded: false,
        onToggleExpanded: () => undefined,
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="Expand Metrics viewer"');
    expect(html).toContain('title="Expand Metrics viewer"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Close Metrics viewer"');
    expect(html).toContain("<svg");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain(">Expand<");
    expect(html.indexOf('aria-label="Expand Metrics viewer"')).toBeLessThan(
      html.indexOf('aria-label="Close Metrics viewer"'),
    );
  });

  it("announces collapse when the utility panel is expanded", () => {
    const html = renderToStaticMarkup(
      createElement(UtilityPanelHeader, {
        title: "Ontology workbench",
        caption: "readonly",
        expanded: true,
        onToggleExpanded: () => undefined,
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="Collapse Ontology workbench"');
    expect(html).toContain('title="Collapse Ontology workbench"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain(">Collapse<");
  });
});
