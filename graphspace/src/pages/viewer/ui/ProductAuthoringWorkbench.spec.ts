import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductAuthoringWorkbench } from "./ProductAuthoringWorkbench";

describe("ProductAuthoringWorkbench", () => {
  it("keeps inactive form panes mounted and selects only the current view", () => {
    const html = renderToStaticMarkup(createElement(ProductAuthoringWorkbench, {
      initialView: "questions",
      children: {
        questions: createElement("textarea", { defaultValue: "unsaved answer" }),
        update: "controlled update", specification: "result", diagnostics: "evidence",
      },
    }));
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(4);
    expect(html.match(/hidden=""/g)).toHaveLength(3);
    expect(html).toContain("unsaved answer");
    expect(html).toContain("controlled update");
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });
});
