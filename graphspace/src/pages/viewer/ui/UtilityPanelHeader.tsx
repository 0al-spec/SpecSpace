import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import styles from "./ViewerPage.module.css";

type Props = {
  title: string;
  caption: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
  authoring?: boolean;
};

export function UtilityPanelHeader({
  title,
  caption,
  expanded,
  onToggleExpanded,
  onClose,
  authoring = false,
}: Props) {
  const expandAction = expanded ? "Collapse" : "Expand";

  return (
    <div className={styles.utilityHeader}>
      <div className={styles.utilityHeaderText}>
        <span className={styles.utilityKicker}>{authoring ? "Product workspace" : "Utility panel"}</span>
        <h2 className={styles.utilityTitle}>{title}</h2>
        {!authoring ? <p className={styles.utilityCaption}>{caption}</p> : null}
      </div>
      <PanelBtnRow className={styles.utilityHeaderActions}>
        <PanelBtn
          title={`${expandAction} ${title}`}
          aria-label={`${expandAction} ${title}`}
          aria-expanded={expanded}
          active={expanded}
          onClick={onToggleExpanded}
        >
          <ExpandPanelIcon />
        </PanelBtn>
        <button
          title={authoring ? "View graph" : `Close ${title}`}
          aria-label={authoring ? "View graph" : `Close ${title}`}
          className={styles.closeButton}
          type="button"
          onClick={onClose}
        >
          {authoring ? "View graph" : "Close"}
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
