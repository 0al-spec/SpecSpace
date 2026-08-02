import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewerChrome } from "./ViewerChrome";

const baseProps = {
  controls: {
    sidebarOpen: true,
    onSidebarToggle: () => undefined,
    selectionHistory: {
      canGoBack: false,
      canGoForward: false,
      onBack: () => undefined,
      onForward: () => undefined,
    },
  },
  status: {
    operatorAccess: {
      required: false,
      href: "/api/v1/operator-session?return_to=%2Fworkspace",
    },
    deployment: { label: "UI local · API local", title: "local" },
    runsWatchVersion: 0,
    recentKind: "ok" as const,
    eventCount: 0,
    workKind: "ok" as const,
    workItemCount: 0,
    traceKind: "ok" as const,
    tooltip: "local",
  },
};

describe("ViewerChrome operator access", () => {
  it("offers the backend Basic Auth entry without rendering a password field", () => {
    const markup = renderToStaticMarkup(createElement(ViewerChrome, {
      ...baseProps,
      status: {
        ...baseProps.status,
        operatorAccess: { ...baseProps.status.operatorAccess, required: true },
      },
    }));

    expect(markup).toContain("Authenticate operator");
    expect(markup).toContain("/api/v1/operator-session?return_to=%2Fworkspace");
    expect(markup).not.toContain('type="password"');
  });

  it("hides the entry after the health projection reports an authenticated operator", () => {
    const markup = renderToStaticMarkup(createElement(ViewerChrome, baseProps));

    expect(markup).not.toContain("Authenticate operator");
  });
});
