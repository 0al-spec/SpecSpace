import { ideaToSpecWorkspace } from "../model/idea-to-spec-workspace.fixture";
import { parseIdeaToSpecWorkspace } from "../model/use-idea-to-spec-workspace";
import {
  IdeaToSpecWorkspacePanel,
  ReportStatusRow,
} from "./IdeaToSpecWorkspacePanel";
import styles from "./IdeaToSpecFixtureGalleryPage.module.css";

const teamDecisionState = parseIdeaToSpecWorkspace(ideaToSpecWorkspace);

const sectionLinks = [
  { id: "report-status-row", label: "Report status row" },
  { id: "team-decision-rail", label: "Rail width preview" },
  { id: "team-decision-overlay", label: "Fullscreen overlay preview" },
  { id: "idea-to-spec-workspace-state-hygiene", label: "Workspace state hygiene" },
  { id: "idea-to-spec-idea-intake", label: "Idea intake" },
  { id: "idea-to-spec-candidate-graph", label: "Candidate graph" },
  { id: "idea-to-spec-candidate-overview", label: "Candidate overview" },
  { id: "idea-to-spec-repair-review", label: "Repair review" },
  { id: "idea-to-spec-idea-maturity", label: "Idea maturity" },
  { id: "idea-to-spec-approval-readiness", label: "Approval readiness" },
] as const;

function fixtureFailureDetail(): string {
  switch (teamDecisionState.kind) {
    case "http-error":
      return `${teamDecisionState.status} ${teamDecisionState.statusText}`;
    case "network-error":
      return "network error";
    case "response-error":
    case "parse-error":
      return teamDecisionState.reason;
    case "idle":
    case "loading":
      return teamDecisionState.kind;
    case "ok":
      return "none";
  }
}

function renderPanelPreview() {
  if (teamDecisionState.kind !== "ok") {
    return (
      <div className={styles.empty} role="status">
        Team Decision Log fixture failed to parse: {fixtureFailureDetail()}
      </div>
    );
  }

  return (
    <IdeaToSpecWorkspacePanel
      state={teamDecisionState}
      auxiliaryDataEnabled={false}
    />
  );
}

export function IdeaToSpecFixtureGalleryPage() {
  const workspaceName =
    teamDecisionState.kind === "ok"
      ? teamDecisionState.data.workspace.displayName
      : "Team Decision Log";
  const status =
    teamDecisionState.kind === "ok" ? teamDecisionState.data.summary.status : "parse error";
  const nodeCount =
    teamDecisionState.kind === "ok"
      ? String(teamDecisionState.data.summary.candidateNodeCount)
      : "n/a";
  const repairCount =
    teamDecisionState.kind === "ok"
      ? String(teamDecisionState.data.summary.repairActionCount)
      : "n/a";

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div>
          <span className={styles.kicker}>SpecSpace UI catalog</span>
          <h1 className={styles.title}>Idea-to-spec fixture gallery</h1>
          <p className={styles.subtitle}>
            Static Team Decision Log workbench for inspecting the real utility panel
            layout with fixture data, stable anchors, and screenshot-friendly viewport
            frames.
          </p>
        </div>
        <dl className={styles.meta} aria-label="Fixture summary">
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Workspace</dt>
            <dd className={styles.metaValue}>{workspaceName}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Status</dt>
            <dd className={styles.metaValue}>{status}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Nodes</dt>
            <dd className={styles.metaValue}>{nodeCount}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt className={styles.metaLabel}>Repairs</dt>
            <dd className={styles.metaValue}>{repairCount}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Idea-to-spec fixture sections">
          <span className={styles.navLabel}>Addressable sections</span>
          <div className={styles.navList}>
            {sectionLinks.map((link) => (
              <a className={styles.navLink} href={`#${link.id}`} key={link.id}>
                {link.label}
              </a>
            ))}
          </div>
        </nav>

        <div className={styles.content}>
          <section className={styles.section} id="report-status-row">
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Composite component</span>
                <h2 className={styles.sectionTitle}>Report status row</h2>
              </div>
              <span className={styles.badge}>420px viewport</span>
            </div>
            <div
              className={styles.componentFrame}
              data-testid="report-status-row-example"
            >
              <div className={styles.componentViewport}>
                <ReportStatusRow
                  title="Validation report"
                  status="ok"
                  path="/tmp/runs/idea_maturity_metrics_report.json"
                  detail="diagnostics 0"
                />
              </div>
            </div>
          </section>

          <section className={styles.section} id="team-decision-rail">
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Utility panel</span>
                <h2 className={styles.sectionTitle}>Rail width preview</h2>
              </div>
              <span className={styles.badge}>420px viewport</span>
            </div>
            <div className={styles.railFrame} data-testid="team-decision-rail-frame">
              <div className={styles.frameChrome}>
                <span className={styles.frameLabel}>UTILITY PANEL</span>
                <span className={styles.badge}>Idea-to-spec</span>
              </div>
              <div className={styles.frameBody}>
                <div className={styles.railViewport}>{renderPanelPreview()}</div>
              </div>
            </div>
          </section>

          <section className={styles.section} id="team-decision-overlay">
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Expanded utility panel</span>
                <h2 className={styles.sectionTitle}>Fullscreen overlay preview</h2>
              </div>
              <span className={styles.badge}>Responsive viewport</span>
            </div>
            <div className={styles.overlayFrame} data-testid="team-decision-overlay-frame">
              <div className={styles.frameChrome}>
                <span className={styles.frameLabel}>FULLSCREEN OVERLAY</span>
                <span className={styles.badge}>Idea-to-spec</span>
              </div>
              <div className={styles.frameBody}>
                <div className={styles.overlayViewport}>{renderPanelPreview()}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
