import type { UseImplementationWorkState } from "@/widgets/implementation-work-panel";
import type { UseProposalTraceState } from "@/widgets/proposal-trace";
import type { UseRecentChangesState } from "@/widgets/recent-changes-panel";
import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";
import styles from "./ViewerPage.module.css";

export type ViewerUtilityPanelId = "recent" | "work" | "proposal-trace";

type Props = {
  controls: {
    sidebarOpen: boolean;
    activeUtilityPanel: ViewerUtilityPanelId | null;
    recentCount: number;
    onSidebarToggle: () => void;
    onRecentToggle: () => void;
  };
  status: {
    runsWatchVersion: number;
    recentKind: UseRecentChangesState["kind"];
    eventCount: number;
    workKind: UseImplementationWorkState["kind"];
    workItemCount: number;
    traceKind: UseProposalTraceState["kind"];
  };
};

export function ViewerChrome({ controls, status }: Props) {
  return (
    <>
      <Overlay anchor="top-left" direction="row">
        <PanelBtnRow>
          <PanelBtn
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
            active={controls.sidebarOpen}
            onClick={controls.onSidebarToggle}
          >
            ☰
          </PanelBtn>
          <PanelBtn
            title="Toggle Recent changes"
            aria-label="Toggle Recent changes"
            active={controls.activeUtilityPanel === "recent"}
            badge={controls.recentCount}
            onClick={controls.onRecentToggle}
          >
            ◷
          </PanelBtn>
        </PanelBtnRow>
      </Overlay>

      <Overlay anchor="bottom-right" className={styles.statusOverlay}>
        <Panel tone="muted" padding="sm">
          <span className={styles.statusText}>
            v0.0.1 · runs tick {status.runsWatchVersion} · recent {status.recentKind} · {status.eventCount} events · work {status.workKind} · {status.workItemCount} items · trace {status.traceKind}
          </span>
        </Panel>
      </Overlay>
    </>
  );
}
