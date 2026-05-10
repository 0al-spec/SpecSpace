import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Panel.module.css";

type PanelTone = "default" | "strong" | "muted";
type PanelPadding = "sm" | "md" | "lg";

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: PanelTone;
  padding?: PanelPadding;
  children?: ReactNode;
};

const toneClass: Record<PanelTone, string> = {
  default: styles["tone-default"],
  strong: styles["tone-strong"],
  muted: styles["tone-muted"],
};

const paddingClass: Record<PanelPadding, string> = {
  sm: styles["padding-sm"],
  md: styles["padding-md"],
  lg: styles["padding-lg"],
};

export function Panel({
  tone = "default",
  padding = "md",
  className,
  children,
  ...rest
}: Props) {
  const cls = [styles.panel, toneClass[tone], paddingClass[padding], className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
