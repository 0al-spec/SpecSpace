import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import styles from "./ViewerPage.module.css";

type Props = {
  title: string;
  caption: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
};

export function UtilityPanelHeader({
  title,
  caption,
  expanded,
  onToggleExpanded,
  onClose,
}: Props) {
  const expandAction = expanded ? "Collapse" : "Expand";

  return (
    <div className={styles.utilityHeader}>
      <div className={styles.utilityHeaderText}>
        <span className={styles.utilityKicker}>Utility panel</span>
        <h2 className={styles.utilityTitle}>{title}</h2>
        <p className={styles.utilityCaption}>{caption}</p>
      </div>
      <PanelBtnRow className={styles.utilityHeaderActions}>
        <PanelBtn
          title={`${expandAction} ${title}`}
          aria-label={`${expandAction} ${title}`}
          active={expanded}
          onClick={onToggleExpanded}
        >
          <ExpandPanelIcon />
        </PanelBtn>
        <button
          title={`Close ${title}`}
          aria-label={`Close ${title}`}
          className={styles.closeButton}
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </PanelBtnRow>
    </div>
  );
}

function ExpandPanelIcon() {
  return (
    <svg
      className={styles.utilityExpandIcon}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" />
    </svg>
  );
}
