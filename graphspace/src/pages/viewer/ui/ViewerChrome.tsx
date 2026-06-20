import type { UseImplementationWorkState } from "@/widgets/implementation-work-panel";
import type { UseProposalTraceState } from "@/widgets/proposal-trace";
import type { UseRecentChangesState } from "@/widgets/recent-changes-panel";
import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";
import styles from "./ViewerPage.module.css";

export type ViewerUtilityPanelId =
  | "recent"
  | "work"
  | "proposals"
  | "metrics"
  | "agents"
  | "ontology-workbench"
  | "practical-ontology"
  | "ontology-review"
  | "ontology-compliance"
  | "ontology-owner-decisions"
  | "agent-context"
  | "agent-conversation"
  | "proposal-trace"
  | "artifacts"
  | "registry";

type Props = {
  controls: {
    sidebarOpen: boolean;
    onSidebarToggle: () => void;
    selectionHistory: ViewerSelectionHistoryControls;
  };
  status: {
    deployment: {
      label: string;
      title: string;
    };
    runsWatchVersion: number;
    recentKind: UseRecentChangesState["kind"];
    eventCount: number;
    workKind: UseImplementationWorkState["kind"];
    workItemCount: number;
    traceKind: UseProposalTraceState["kind"];
    tooltip: string;
  };
};

export type ViewerSelectionHistoryControls = {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
};

export function ViewerChrome({ controls, status }: Props) {
  return (
    <>
      {!controls.sidebarOpen ? (
        <div className={styles.canvasControlDock}>
          <PanelBtnRow>
            <PanelBtn
              title="Toggle Sidebar"
              aria-label="Toggle Sidebar"
              onClick={controls.onSidebarToggle}
            >
              ☰
            </PanelBtn>
            <SelectionHistoryButtons {...controls.selectionHistory} />
          </PanelBtnRow>
        </div>
      ) : null}

      <Overlay anchor="bottom-right" className={styles.statusOverlay}>
        <Panel tone="muted" padding="sm">
          <span className={styles.statusText} title={status.tooltip}>
            {status.deployment.label} · runs tick {status.runsWatchVersion} · recent{" "}
            {status.recentKind} · {status.eventCount} events · work {status.workKind} ·{" "}
            {status.workItemCount} items · trace {status.traceKind}
          </span>
        </Panel>
      </Overlay>
    </>
  );
}

export function SelectionHistoryButtons({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: ViewerSelectionHistoryControls) {
  return (
    <>
      <PanelBtn
        title="Back to previous selected spec ([)"
        aria-label="Back to previous selected spec"
        disabled={!canGoBack}
        dim={!canGoBack}
        onClick={onBack}
      >
        ‹
      </PanelBtn>
      <PanelBtn
        title="Forward to next selected spec (])"
        aria-label="Forward to next selected spec"
        disabled={!canGoForward}
        dim={!canGoForward}
        onClick={onForward}
      >
        ›
      </PanelBtn>
    </>
  );
}
