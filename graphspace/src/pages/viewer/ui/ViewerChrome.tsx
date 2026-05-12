import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";
import styles from "./ViewerPage.module.css";

type Props = {
  controls: {
    timelineOn: boolean;
    filterOpen: boolean;
    badgeCount: number;
    onTimelineToggle: () => void;
    onFilterToggle: () => void;
  };
  status: {
    runsWatchVersion: number;
    recentKind: string;
    eventCount: number;
    workKind: string;
    workItemCount: number;
    traceKind: string;
  };
};

export function ViewerChrome({ controls, status }: Props) {
  return (
    <>
      <Overlay anchor="top-left" direction="row">
        <PanelBtnRow>
          <PanelBtn
            title="Toggle timeline"
            active={controls.timelineOn}
            onClick={controls.onTimelineToggle}
          >
            ⏱
          </PanelBtn>
          <PanelBtn
            title="Open filter"
            active={controls.filterOpen}
            badge={controls.badgeCount}
            onClick={controls.onFilterToggle}
          >
            ⚲
          </PanelBtn>
          <PanelBtn dim title="Disabled action">
            ✕
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
