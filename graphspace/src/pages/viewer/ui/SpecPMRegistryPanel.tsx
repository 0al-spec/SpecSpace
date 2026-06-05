import type { SpecPMRegistryPackageSummary } from "@/shared/specpm-registry-contract";
import type { UseSpecPMRegistryState } from "../model/use-specpm-registry-summary";
import styles from "./SpecPMRegistryPanel.module.css";

type Props = {
  state: UseSpecPMRegistryState;
};

const packageName = (pkg: SpecPMRegistryPackageSummary): string =>
  pkg.name || pkg.package_id;

const packageVersion = (pkg: SpecPMRegistryPackageSummary): string =>
  pkg.latest_version || pkg.versions?.[0]?.version || "no version";

function errorDetail(state: Exclude<UseSpecPMRegistryState, { kind: "ok" | "idle" | "loading" }>): string {
  switch (state.kind) {
    case "http-error":
      return `HTTP ${state.status}${state.statusText ? ` ${state.statusText}` : ""}`;
    case "network-error":
      return "Registry endpoint is unreachable from the browser.";
    case "response-error":
      return state.reason;
    case "parse-error":
      return state.issues[0]?.message ?? "Registry response did not match the expected shape.";
  }
}

export function SpecPMRegistryPanel({ state }: Props) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="SpecPM registry">
        <div className={styles.status}>
          <span className={styles.statusLabel}>Loading registry</span>
          <span className={styles.statusDetail}>Reading /api/v1/specpm/registry</span>
        </div>
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="SpecPM registry">
        <div className={styles.status}>
          <span className={styles.statusLabel}>Registry unavailable</span>
          <span className={styles.statusDetail}>{errorDetail(state)}</span>
        </div>
      </section>
    );
  }

  const { data } = state;
  const registry = data.registry.registry;
  const packages = data.packages.packages;

  return (
    <section className={styles.panel} aria-label="SpecPM registry">
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.label}>Source</span>
          <span className={styles.value}>{data.source.path ?? "not configured"}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.label}>Authority</span>
          <span className={styles.value}>{registry.authority ?? "metadata_only"}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.label}>Packages</span>
          <span className={styles.value}>{data.packages.package_count}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.label}>Versions</span>
          <span className={styles.value}>
            {data.packages.version_count ?? registry.version_count ?? 0}
          </span>
        </div>
      </div>

      <div className={styles.packages}>
        {packages.length > 0 ? (
          packages.map((pkg) => (
            <div key={pkg.package_id} className={styles.packageRow}>
              <div className={styles.packageMain}>
                <span className={styles.packageId}>{pkg.package_id}</span>
                <span className={styles.packageName}>{packageName(pkg)}</span>
                {pkg.summary ? (
                  <span className={styles.packageSummary}>{pkg.summary}</span>
                ) : null}
                {pkg.capabilities?.length ? (
                  <span className={styles.capabilities}>
                    {pkg.capabilities.slice(0, 4).join(" · ")}
                  </span>
                ) : null}
              </div>
              <span className={styles.version}>{packageVersion(pkg)}</span>
            </div>
          ))
        ) : (
          <div className={styles.status}>
            <span className={styles.empty}>No packages published in this registry.</span>
          </div>
        )}
      </div>
    </section>
  );
}
