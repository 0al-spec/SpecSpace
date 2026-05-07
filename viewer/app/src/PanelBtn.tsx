/**
 * PanelBtn — shared pill button used in SpecInspector, SpecLens, Sidebar.
 *
 * Features
 * ────────
 * • Round 30 × 30 px pill with border + white bg
 * • Uniform hover: #fbf3e7 fill + stronger border
 * • `dim` replaces the HTML `disabled` attribute so pointer events (and
 *   therefore the native title tooltip) still fire on the element itself
 * • Inner <span> has pointer-events: none so the glyph never intercepts hover
 * • Optional `badge` renders a small accent-colored counter at top-right
 */
import "./PanelBtn.css";

export interface PanelBtnProps {
  /** Icon / glyph rendered inside the button. */
  icon:       React.ReactNode;
  /** Native browser tooltip text. */
  title:      string;
  onClick?:   () => void;
  /** Visually disabled (faded), click does nothing, tooltip still shows. */
  dim?:       boolean;
  /** Extra classes — use for per-button colour overrides, sizing, etc. */
  className?: string;
  /** Numeric badge at top-right; `0`/`undefined` = hidden. Values >99 shown as "99+". */
  badge?:     number;
}

export default function PanelBtn({ icon, title, onClick, dim, className, badge }: PanelBtnProps) {
  const showBadge = typeof badge === "number" && badge > 0;
  const badgeText = showBadge ? (badge! > 99 ? "99+" : String(badge)) : null;
  return (
    <button
      className={`panel-btn${dim ? " panel-btn-dim" : ""}${className ? ` ${className}` : ""}`}
      onClick={dim ? undefined : onClick}
      title={title}
      aria-disabled={dim}
    >
      <span>{icon}</span>
      {showBadge && <span className="panel-btn-badge">{badgeText}</span>}
    </button>
  );
}
