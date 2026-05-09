import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import styles from "./PanelBtn.module.css";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Icon or single glyph rendered inside. */
  children: ReactNode;
  /** Visually disabled but pointer events pass through (so titles/tooltips fire). */
  dim?: boolean;
  /** Accent state — used for "filter is open" / "timeline is on" indicators. */
  active?: boolean;
  /** Optional top-right counter badge. Hidden when undefined or 0. */
  badge?: number | string;
};

export function PanelBtn({
  children,
  dim,
  active,
  badge,
  className,
  type = "button",
  ...rest
}: Props) {
  const cls = [styles.btn, dim && styles.dim, active && styles.active, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      <span>{children}</span>
      {badge !== undefined && badge !== 0 && (
        <span className={styles.badge}>{badge}</span>
      )}
    </button>
  );
}

export function PanelBtnRow(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  const cls = [styles.row, className].filter(Boolean).join(" ");
  return <div className={cls} {...rest} />;
}
