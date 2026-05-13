import { getSpecNodeStatusTone } from "../lib/visual-signals";
import type { SpecNode } from "../model/types";
import styles from "./SpecNodeStatusBadge.module.css";

type Props = {
  status: SpecNode["status"];
  compact?: boolean;
  className?: string;
};

export function SpecNodeStatusBadge({
  status,
  compact = false,
  className,
}: Props) {
  const tone = getSpecNodeStatusTone(status);
  const cls = [
    styles.badge,
    compact ? styles.compact : "",
    styles[`tone-${tone}`],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={cls}>{status}</span>;
}
