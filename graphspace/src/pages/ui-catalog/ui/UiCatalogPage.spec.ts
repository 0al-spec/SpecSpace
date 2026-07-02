import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UiCatalogPage } from "./UiCatalogPage";

describe("UiCatalogPage", () => {
  it("renders catalog sections and fixture links", () => {
    const html = renderToStaticMarkup(createElement(UiCatalogPage));

    expect(html).toContain("Design system workbench");
    expect(html).toContain('id="utility-panel-components"');
    expect(html).toContain('id="shared-primitives"');
    expect(html).toContain("/dev/idea-to-spec-fixtures#report-status-row");
    expect(html).toContain("/dev/idea-to-spec-fixtures#team-decision-rail");
    expect(html).toContain("/dev/idea-to-spec-fixtures#team-decision-overlay");
    expect(html).toContain("Panel button with badge");
  });
});
