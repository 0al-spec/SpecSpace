import type { HTMLAttributes } from "react";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import type { RecentChange } from "../model/types";
import { toneFor } from "../lib/tone";
import { relativeTime } from "../lib/format-time";
import styles from "./RecentChangeRow.module.css";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  entry: RecentChange;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
  /** Override "now" — useful for tests and stable demo screenshots. */
  now?: Date;
};

export function RecentChangeRow({
  entry,
  resolveSpecRef,
  onSpecIdClick,
  now,
  className,
  ...rest
}: Props) {
  const tone = toneFor(entry);
  const time = relativeTime(entry.occurred_at, now);
  const cls = [styles.row, styles[`tone-${tone}`], className].filter(Boolean).join(" ");

  return (
    <div className={cls} {...rest}>
      <span aria-hidden className={styles["tone-bar"]} />
      <div className={styles.body}>
        <p className={styles.label}>
          <span>{entry.viewer.label}</span>
          {entry.spec_id && (
            <SpecIdText
              text={entry.spec_id}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
              variant="bare"
              specClassName={styles["spec-id"]}
            />
          )}
        </p>
        <h3 className={styles.title}>
          <SpecIdText
            text={entry.title}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSpecIdClick}
            variant="bare"
          />
        </h3>
        {entry.summary && (
          <p className={styles.summary}>
            <SpecIdText
              text={entry.summary}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
              variant="bare"
            />
          </p>
        )}
      </div>
      <span className={styles.time} title={entry.occurred_at}>
        {time}
      </span>
    </div>
  );
}
