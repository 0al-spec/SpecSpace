import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpecPMRegistrySummary } from "@/shared/specpm-registry-contract";
import { SpecPMRegistryPanel } from "./SpecPMRegistryPanel";

const registrySummary: SpecPMRegistrySummary = {
  api_version: "v1",
  source: {
    name: "specpm_registry",
    path: "https://specpm.dev",
    status: "configured",
  },
  registry: {
    apiVersion: "specpm.registry/v0",
    schemaVersion: 1,
    kind: "RemoteRegistryStatus",
    status: "ok",
    registry: {
      authority: "metadata_only",
      package_count: 9,
      version_count: 9,
      read_only: true,
    },
  },
  packages: {
    apiVersion: "specpm.registry/v0",
    schemaVersion: 1,
    kind: "RemotePackageIndex",
    status: "ok",
    package_count: 9,
    version_count: 9,
    packages: [
      "agent.passport",
      "feature.passport",
      "hyperprompt.core",
      "specgraph.core",
      "specnode.core",
      "specpm.core",
      "specspace.core",
      "supervisor.core",
      "xyflow.core",
    ].map((packageId) => ({
      package_id: packageId,
      name: packageId,
      latest_version: "0.1.0",
      capabilities: [`${packageId}.capability`],
    })),
  },
};

describe("SpecPMRegistryPanel", () => {
  it("renders packages beyond the initial visible group", () => {
    const html = renderToStaticMarkup(
      createElement(SpecPMRegistryPanel, {
        state: { kind: "ok", data: registrySummary },
      }),
    );

    expect(html).toContain("xyflow.core");
    expect(html).toContain("xyflow.core.capability");
  });
});
