import { describe, expect, it } from "vitest";
import { parseSpecPMRegistrySummary } from "../parsers/parse-specpm-registry-summary";

const summary = () => ({
  api_version: "v1",
  source: {
    name: "specpm_registry",
    path: "https://0al-spec.github.io/SpecPM",
    status: "configured",
  },
  registry: {
    apiVersion: "specpm.registry/v0",
    schemaVersion: 1,
    kind: "RemoteRegistryStatus",
    status: "ok",
    registry: {
      profile: "public_static_index",
      read_only: true,
      authority: "metadata_only",
      package_count: 1,
      version_count: 1,
    },
  },
  packages: {
    apiVersion: "specpm.registry/v0",
    schemaVersion: 1,
    kind: "RemotePackageIndex",
    status: "ok",
    package_count: 1,
    version_count: 1,
    packages: [
      {
        package_id: "specnode.core",
        name: "SpecNode Core",
        latest_version: "0.1.0",
        capabilities: ["specnode.typed_job_protocol"],
      },
    ],
  },
});

describe("parseSpecPMRegistrySummary", () => {
  it("accepts the SpecSpace registry summary payload", () => {
    const result = parseSpecPMRegistrySummary(summary());

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.data.packages.package_count).toBe(1);
    expect(result.data.packages.packages[0].package_id).toBe("specnode.core");
  });

  it("rejects non-registry payloads", () => {
    const broken = summary();
    broken.registry.apiVersion = "other/v0";

    expect(parseSpecPMRegistrySummary(broken).kind).toBe("parse-error");
  });
});
