/**
 * PanelActions — standard action-button row for floating panels.
 *
 * Layout:  [←]  [→]  [...extra]  [✕]
 *
 * Usage in SpecInspector:
 *   <PanelActions className="spec-inspector-actions"
 *     canGoBack={…} backLabel={…} onBack={…}
 *     canGoForward={…} forwardLabel={…} onForward={…}
 *     extra={[{ icon: "⊙", title: "Open lens", onClick: openLens }]}
 *     onClose={dismiss} />
 *
 * Usage in SpecLens title bar (no extra actions):
 *   <PanelActions canGoBack={…} … onClose={onClose} />
 */
import PanelBtn from "./PanelBtn";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight, faXmark } from "@fortawesome/free-solid-svg-icons";

export interface PanelExtraAction {
  icon:       React.ReactNode;
  title:      string;
  onClick?:   () => void;
  className?: string;
}

export interface PanelActionsProps {
  // Navigation
  canGoBack?:    boolean;
  canGoForward?: boolean;
  onBack?:       () => void;
  onForward?:    () => void;
  backLabel?:    string;
  forwardLabel?: string;
  // Custom buttons between nav and close
  extra?:    PanelExtraAction[];
  // Close button
  onClose?:  () => void;
  /** Applied to the outer .panel-actions div — use for positioning. */
  className?: string;
}

export default function PanelActions({
  canGoBack, canGoForward, onBack, onForward, backLabel, forwardLabel,
  extra,
  onClose,
  className,
}: PanelActionsProps) {
  const showNav = onBack !== undefined || onForward !== undefined;

  return (
    <div className={`panel-actions${className ? ` ${className}` : ""}`}>
      {showNav && (
        <>
          <PanelBtn
            icon={<FontAwesomeIcon icon={faArrowLeft} />}
            title={canGoBack && backLabel ? `← ${backLabel}` : "История пуста"}
            onClick={onBack}
            dim={!canGoBack}
          />
          <PanelBtn
            icon={<FontAwesomeIcon icon={faArrowRight} />}
            title={canGoForward && forwardLabel ? `→ ${forwardLabel}` : "Нет следующей страницы"}
            onClick={onForward}
            dim={!canGoForward}
          />
        </>
      )}

      {extra?.map((a, i) => (
        <PanelBtn
          key={i}
          icon={a.icon}
          title={a.title}
          onClick={a.onClick}
          className={a.className}
        />
      ))}

      {onClose && (
        <PanelBtn icon={<FontAwesomeIcon icon={faXmark} />} title="Закрыть (Esc)" onClick={onClose} />
      )}
    </div>
  );
}
