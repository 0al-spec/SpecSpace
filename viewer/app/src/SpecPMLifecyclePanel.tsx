import { useCallback, useEffect, useRef, useState } from "react";
import "./PanelBtn.css";
import "./SpecPMExportPreview.css";
import "./SpecPMLifecyclePanel.css";
import PanelActions from "./PanelActions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";

interface Props {
  onClose: () => void;
}

interface ArtifactMeta {
  available: boolean;
  generated_at: string | null;
  entry_count: number;
}

interface LifecycleStage {
  status: string | null;
  review_state: string | null;
  next_gap: string | null;
  // optional per-stage extras (only present in stages that provide them)
  bundle_root?: string | null;
  suggested_target_kind?: string | null;
  route_kind?: string | null;
}

interface PackageLifecycle {
  package_key: string;
  export?: LifecycleStage;
  handoff?: LifecycleStage;
  materialization?: LifecycleStage;
  import?: LifecycleStage;
  import_handoff?: LifecycleStage;
}

interface ImportSource {
  consumer_id?: string;
  checkout_status?: string;
  identity_verified?: boolean;
  inbox_root?: string;
  bundle_count?: number;
  next_gap?: string | null;
}

interface LifecycleData {
  packages: PackageLifecycle[];
  package_count: number;
  import_source: ImportSource | null;
  artifacts: {
    export_preview: ArtifactMeta;
    handoff_packets: ArtifactMeta;
    materialization_report: ArtifactMeta;
    import_preview: ArtifactMeta;
    import_handoff_packets: ArtifactMeta;
  };
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: LifecycleData };

const STATUS_TONE: Record<string, string> = {
  // export / handoff / materialization / import statuses
  draft_preview_only:           "tone-draft",
  draft_visible:                "tone-draft",
  draft_reference:              "tone-draft",
  draft_materialized:           "tone-draft",
  ready_for_review:             "tone-ready",
  ready_for_handoff:            "tone-ready",
  materialized_for_review:      "tone-ready",
  blocked_by_consumer_gap:      "tone-blocked",
  blocked_by_preview_gap:       "tone-blocked",
  blocked_by_checkout_gap:      "tone-blocked",
  blocked_by_consumer_identity: "tone-blocked",
  blocked_by_handoff_gap:       "tone-blocked",
  blocked_by_bundle_gap:        "tone-blocked",
  invalid_export_contract:      "tone-blocked",
  invalid_handoff_contract:     "tone-blocked",
  invalid_import_contract:      "tone-blocked",
  // import_handoff statuses
  ready_for_lane:               "tone-ready",
  draft_visible_only:           "tone-draft",
  blocked_by_import_gap:        "tone-blocked",
};

const STATUS_DESC: Record<string, string> = {
  // export
  draft_preview_only:           "Export preview built but not yet reviewed; package not visible to consumers.",
  ready_for_review:             "Ready for reviewer sign-off.",
  ready_for_handoff:            "Export review passed; handoff packet ready to send.",
  blocked_by_consumer_gap:      "Blocked: no configured consumer target.",
  invalid_export_contract:      "Export artifact violates policy contract; needs repair.",
  // handoff
  blocked_by_preview_gap:       "Blocked: upstream export preview not ready.",
  // materialization
  draft_materialized:           "Bundle materialized from a draft handoff; consumer inbox updated, awaiting review.",
  materialized_for_review:      "Bundle materialized and ready for import-side review.",
  blocked_by_handoff_gap:       "Blocked: handoff packet not ready.",
  blocked_by_checkout_gap:      "Blocked: consumer checkout path not available.",
  blocked_by_consumer_identity: "Blocked: consumer repo identity not verified.",
  invalid_handoff_contract:     "Handoff contract invalid; bundle cannot be placed.",
  // import
  draft_visible:                "Import preview generated from a draft materialized bundle.",
  blocked_by_bundle_gap:        "Blocked: no materialized bundle in consumer inbox.",
  invalid_import_contract:      "Import contract violated; bundle structure invalid.",
  // import_handoff
  draft_visible_only:           "Package is draft-visible only; not yet assigned to a delivery lane.",
  ready_for_lane:               "Package assigned to a delivery lane and ready for promotion.",
  blocked_by_import_gap:        "Blocked: upstream import preview has an unresolved gap.",
  // extras
  draft_reference:              "Export referenced in draft state; not yet finalized.",
};

const NEXT_GAP_DESC: Record<string, string> = {
  // review — human sign-off needed
  review_specpm_export_preview:          "Approve the export preview to unblock handoff.",
  review_draft_specpm_boundary:          "Review the draft boundary spec; package not promotion-ready yet.",
  review_specpm_handoff_packet:          "Review and accept the handoff packet.",
  review_materialized_bundle:            "Review the finalized materialized bundle.",
  review_draft_materialized_bundle:      "Review the materialized bundle that is in draft state before promoting to import.",
  review_specpm_import_preview:          "Review the finalized import preview.",
  review_draft_specpm_import_preview:    "Review the draft import preview on the consumer side.",
  review_specpm_import_handoff_packet:   "Review import handoff packet and confirm lane assignment.",
  review_draft_specpm_delivery:          "Review the draft delivery workflow.",
  review_specpm_delivery_workflow:       "Approve the delivery workflow.",
  // inherit — gap propagated from upstream stage
  inherit_external_consumer_next_gap:    "Gap inherited from the external consumer configuration.",
  inherit_preview_next_gap:              "Gap propagated from the export preview stage.",
  inherit_handoff_next_gap:              "Gap propagated from the handoff packet stage.",
  inherit_import_next_gap:               "Gap propagated from the import preview stage.",
  inherit_materialization_next_gap:      "Gap propagated from the materialization stage.",
  // repair — artifact needs fixing
  repair_specpm_export_registry:         "Fix the export registry artifact.",
  repair_specpm_checkout:                "Fix the consumer checkout path or configuration.",
  verify_specpm_checkout_identity:       "Verify consumer repo identity.",
  repair_specpm_handoff_packet:          "Repair the handoff packet artifact.",
  repair_specpm_bundle:                  "Repair the materialized bundle.",
  repair_specpm_import_bundle:           "Repair the import bundle structure.",
  repair_specpm_import_preview:          "Rebuild or fix the import preview artifact.",
  repair_specpm_materialization_report:  "Repair the materialization report.",
  isolate_specpm_checkout_changes:       "Isolate local checkout changes before proceeding.",
};

function stageTone(value: string | null | undefined): string {
  if (!value) return "";
  return STATUS_TONE[value] || "";
}

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return null; }
}

export default function SpecPMLifecyclePanel({ onClose }: Props) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [buildingAction, setBuildingAction] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildSuccess, setBuildSuccess] = useState<{ msg: string; path: string | null } | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/specpm/lifecycle");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ kind: "error", message: (body as Record<string, string>).error || `HTTP ${res.status}` });
        return;
      }
      const data: LifecycleData = await res.json();
      setState({ kind: "ok", data });
    } catch (err) {
      setState({ kind: "error", message: String(err) });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const showSuccess = useCallback((msg: string, path: string | null = null) => {
    setBuildSuccess({ msg, path });
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setBuildSuccess(null), 8000);
  }, []);

  const runBuild = useCallback(async (
    action: string,
    url: string,
    ...chainUrls: string[]
  ) => {
    setBuildingAction(action);
    setBuildError(null);
    setBuildSuccess(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        const tail = typeof body.stderr_tail === "string" ? `\n${body.stderr_tail}` : "";
        setBuildError(typeof body.error === "string" ? body.error + tail : `HTTP ${res.status}${tail}`);
        return;
      }
      for (let i = 0; i < chainUrls.length; i++) {
        const chainRes = await fetch(chainUrls[i], { method: "POST" });
        if (!chainRes.ok) {
          const chainBody = await chainRes.json().catch(() => ({})) as Record<string, unknown>;
          setBuildError(
            typeof chainBody.error === "string"
              ? chainBody.error
              : `Chain step ${i + 1} failed: HTTP ${chainRes.status}`,
          );
          return;
        }
      }
      const builtAt = typeof body.built_at === "string" ? body.built_at : null;
      const path = typeof body.path === "string" ? body.path : null;
      const steps = 1 + chainUrls.length;
      const stepLabel = steps > 1 ? ` (${steps} steps)` : "";
      showSuccess(`Built successfully${stepLabel}${builtAt ? " · " + fmtTime(builtAt) : ""}`, path);
      await load();
    } catch (err) {
      setBuildError(String(err));
    } finally {
      setBuildingAction(null);
    }
  }, [load, showSuccess]);

  const busy = buildingAction !== null;

  return (
    <div className="specpm-overlay" onClick={onClose}>
      <div className="specpm-panel" onClick={(e) => e.stopPropagation()}>
        <div className="specpm-titlebar">
          <div className="specpm-title">
            <span className="specpm-title-main">SpecPM Lifecycle</span>
            <span className="specpm-title-sub">Package Delivery Pipeline · read-only</span>
          </div>
          <PanelActions
            extra={[
              {
                icon: busy
                  ? <FontAwesomeIcon icon={faRotate} spin />
                  : <FontAwesomeIcon icon={faRotate} />,
                title: busy ? "Working…" : "Reload lifecycle",
                onClick: busy ? undefined : load,
              },
            ]}
            onClose={onClose}
          />
        </div>

        <div className="specpm-lifecycle-actions">
          <button
            className="specpm-action-btn"
            disabled={busy}
            title="Build specpm_export_preview.json from repository specs. Run this first whenever specs change."
            onClick={() => runBuild("export", "/api/specpm/build-export-preview")}
          >
            {buildingAction === "export" ? "Building…" : "Build Export Preview"}
          </button>
          <button
            className="specpm-action-btn"
            disabled={busy}
            title="Materialize export bundles into the consumer inbox, then auto-build Import Preview and Import Handoff Packets in sequence."
            onClick={() => runBuild(
              "materialize",
              "/api/specpm/materialize",
              "/api/specpm/build-import-preview",
              "/api/specpm/build-import-handoff-packets",
            )}
          >
            {buildingAction === "materialize" ? "Materializing…" : "Materialize"}
          </button>
          <button
            className="specpm-action-btn"
            disabled={busy}
            title="Build specpm_import_preview.json from materialized bundles in the consumer inbox. Run after Materialize if you want to skip the full chain."
            onClick={() => runBuild("import", "/api/specpm/build-import-preview")}
          >
            {buildingAction === "import" ? "Building…" : "Build Import Preview"}
          </button>
          <button
            className="specpm-action-btn"
            disabled={busy}
            title="Build specpm_import_handoff_packets.json — assigns route lanes (handoff_candidate, proposal_lane, etc.) based on the current Import Preview."
            onClick={() => runBuild("import_handoff", "/api/specpm/build-import-handoff-packets")}
          >
            {buildingAction === "import_handoff" ? "Building…" : "Build Import Handoff"}
          </button>
        </div>

        {buildSuccess && (
          <div className="specpm-build-success">
            <span>{buildSuccess.msg}</span>
            {buildSuccess.path && (
              <span className="specpm-build-success-path">
                <code title={buildSuccess.path}>{buildSuccess.path.split("/").slice(-2).join("/")}</code>
                <button
                  className="specpm-reveal-btn"
                  title={`Reveal in Finder: ${buildSuccess.path}`}
                  onClick={() => fetch("/api/reveal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: buildSuccess.path }),
                  })}
                >
                  Reveal in Finder
                </button>
              </span>
            )}
          </div>
        )}
        {buildError && (
          <div className="specpm-build-error">
            <strong>Build failed:</strong>
            <pre>{buildError}</pre>
          </div>
        )}

        {state.kind === "ok" && (
          <ArtifactStrip artifacts={state.data.artifacts} />
        )}
        {state.kind === "ok" && state.data.import_source && (
          <ImportSourceHeader src={state.data.import_source} />
        )}

        <div className="specpm-body">
          {state.kind === "loading" && <div className="specpm-info">Loading…</div>}
          {state.kind === "error" && (
            <div className="specpm-error">
              <strong>Error:</strong> {state.message}
            </div>
          )}
          {state.kind === "ok" && (
            state.data.packages.length === 0 ? (
              <div className="specpm-info">No packages found. Build the export preview first.</div>
            ) : (
              state.data.packages.map((pkg) => <PackageCard key={pkg.package_key} pkg={pkg} />)
            )
          )}
        </div>
      </div>
    </div>
  );
}

const ARTIFACT_LABELS: Array<[keyof LifecycleData["artifacts"], string]> = [
  ["export_preview",         "Export"],
  ["handoff_packets",        "Handoff"],
  ["materialization_report", "Materialize"],
  ["import_preview",         "Import"],
  ["import_handoff_packets", "Handoff→Lane"],
];

function ArtifactStrip({ artifacts }: { artifacts: LifecycleData["artifacts"] }) {
  return (
    <div className="specpm-artifact-strip">
      {ARTIFACT_LABELS.map(([key, label]) => {
        const a = artifacts[key];
        const tip = a.available
          ? `${label}: ${a.entry_count} entries, built ${a.generated_at ?? "unknown"}`
          : `${label}: not built`;
        return (
          <span key={key} className={`specpm-artifact-dot ${a.available ? "dot-available" : "dot-missing"}`} title={tip}>
            <span className="dot-mark">{a.available ? "✓" : "○"}</span>
            <span className="dot-label">
              {label}
              {a.available && fmtTime(a.generated_at) && (
                <span className="dot-time">{fmtTime(a.generated_at)}</span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function ImportSourceHeader({ src }: { src: ImportSource }) {
  return (
    <div className="specpm-import-source">
      <div className="specpm-meta">
        {src.consumer_id && (
          <span className="specpm-badges-cell">
            <span className="specpm-badge-label">consumer</span>
            <span className="spec-inspector-tag specpm-tag">{src.consumer_id}</span>
          </span>
        )}
        {src.checkout_status && (
          <span className="specpm-badges-cell">
            <span className="specpm-badge-label">checkout</span>
            <span className={`spec-inspector-tag specpm-tag ${stageTone(src.checkout_status)}`}>
              {src.checkout_status}
            </span>
          </span>
        )}
        <span className="specpm-badges-cell">
          <span className="specpm-badge-label">identity</span>
          <span className={`spec-inspector-tag specpm-tag ${src.identity_verified ? "tone-ready" : "tone-blocked"}`}>
            {src.identity_verified ? "verified" : "unverified"}
          </span>
        </span>
        {src.bundle_count !== undefined && (
          <span className="specpm-badges-cell">
            <span className="specpm-badge-label">bundles in inbox</span>
            <span className="spec-inspector-tag specpm-tag">{src.bundle_count}</span>
          </span>
        )}
        {src.next_gap && src.next_gap !== "none" && (
          <span className="specpm-badges-cell">
            <span className="specpm-badge-label">next gap</span>
            <span className="spec-inspector-tag specpm-tag tone-draft">{src.next_gap}</span>
          </span>
        )}
      </div>
    </div>
  );
}

const STAGE_KEYS = ["export", "handoff", "materialization", "import", "import_handoff"] as const;

function PackageCard({ pkg }: { pkg: PackageLifecycle }) {
  return (
    <section className="specpm-entry specpm-lifecycle-card">
      <header className="specpm-entry-head">
        <div className="specpm-entry-title">
          <code>{pkg.package_key}</code>
        </div>
      </header>
      <div className="specpm-stages">
        {STAGE_KEYS.map((key) => (
          <StageColumn key={key} label={key} stage={pkg[key]} />
        ))}
      </div>
    </section>
  );
}

function StageColumn({ label, stage }: { label: string; stage?: LifecycleStage }) {
  return (
    <div className="specpm-stage">
      <span className="specpm-stage-label">{label}</span>
      {stage ? (
        <>
          {stage.status && (
            <span
              className={`spec-inspector-tag specpm-tag ${stageTone(stage.status)}`}
              title={STATUS_DESC[stage.status] ?? stage.status}
            >
              {stage.status}
            </span>
          )}
          {stage.route_kind && (
            <span
              className="spec-inspector-tag specpm-tag specpm-tag-route"
              title={`Route kind: ${stage.route_kind}`}
            >
              {stage.route_kind}
            </span>
          )}
          {stage.next_gap && (
            <span
              className="specpm-stage-gap"
              title={NEXT_GAP_DESC[stage.next_gap] ?? `Next gap: ${stage.next_gap}`}
            >
              {stage.next_gap}
            </span>
          )}
        </>
      ) : (
        <span className="specpm-stage-empty">—</span>
      )}
    </div>
  );
}
