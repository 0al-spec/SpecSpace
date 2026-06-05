import { describe, expect, it } from "vitest";
import type { SpecPMRegistryPackageSummary } from "@/shared/specpm-registry-contract";
import {
  filterSpecPMRegistryPackages,
  MAX_INITIAL_REGISTRY_PACKAGES,
  visibleSpecPMRegistryPackages,
} from "./specpm-registry-filter";

const packageSummary = (packageId: string): SpecPMRegistryPackageSummary => ({
  package_id: packageId,
  name: packageId,
  latest_version: "0.1.0",
  capabilities: [`${packageId}.capability`],
});

describe("SpecPM registry package filtering", () => {
  it("caps the initial visible set but keeps hidden packages searchable", () => {
    const packages = Array.from({ length: 108 }, (_, index) =>
      packageSummary(`example.${String(index + 1).padStart(3, "0")}`),
    );
    packages.push(packageSummary("xyflow.core"));

    const initial = visibleSpecPMRegistryPackages(
      filterSpecPMRegistryPackages(packages, ""),
      false,
    );

    expect(initial.visiblePackages).toHaveLength(MAX_INITIAL_REGISTRY_PACKAGES);
    expect(initial.hiddenCount).toBe(9);
    expect(initial.visiblePackages.some((pkg) => pkg.package_id === "xyflow.core")).toBe(false);

    const searched = visibleSpecPMRegistryPackages(
      filterSpecPMRegistryPackages(packages, "xyflow.core"),
      false,
    );

    expect(searched.hiddenCount).toBe(0);
    expect(searched.visiblePackages.map((pkg) => pkg.package_id)).toEqual(["xyflow.core"]);
  });
});
