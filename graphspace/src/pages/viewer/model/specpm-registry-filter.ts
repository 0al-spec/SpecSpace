import type { SpecPMRegistryPackageSummary } from "@/shared/specpm-registry-contract";

export const MAX_INITIAL_REGISTRY_PACKAGES = 100;

const searchablePackageText = (pkg: SpecPMRegistryPackageSummary): string =>
  [
    pkg.package_id,
    pkg.name,
    pkg.summary,
    pkg.license,
    ...(pkg.capabilities ?? []),
    ...(pkg.versions ?? []).map((version) => version.version),
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLocaleLowerCase();

export function filterSpecPMRegistryPackages(
  packages: readonly SpecPMRegistryPackageSummary[],
  query: string,
): SpecPMRegistryPackageSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...packages];

  return packages.filter((pkg) => searchablePackageText(pkg).includes(normalizedQuery));
}

export function visibleSpecPMRegistryPackages(
  packages: readonly SpecPMRegistryPackageSummary[],
  expanded: boolean,
): {
  hiddenCount: number;
  visiblePackages: SpecPMRegistryPackageSummary[];
} {
  if (expanded || packages.length <= MAX_INITIAL_REGISTRY_PACKAGES) {
    return {
      hiddenCount: 0,
      visiblePackages: [...packages],
    };
  }

  return {
    hiddenCount: packages.length - MAX_INITIAL_REGISTRY_PACKAGES,
    visiblePackages: packages.slice(0, MAX_INITIAL_REGISTRY_PACKAGES),
  };
}
