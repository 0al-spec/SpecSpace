import type { HTMLAttributes } from "react";
import type { RecentChange, RecentChangeTone } from "@/entities/recent-change";
import { toneCounts } from "../lib/apply";
import styles from "./ToneFilterBar.module.css";

/** Ordering matches contract §5 narrative (spec/trace/proposal/work/review/neutral). */
const TONE_ORDER: readonly RecentChangeTone[] = [
  "spec",
  "trace",
  "proposal",
  "implementation",
  "review",
  "neutral",
];

const TONE_LABEL: Record<RecentChangeTone, string> = {
  spec: "spec",
  trace: "trace",
  proposal: "proposal",
  implementation: "work",
  review: "review",
  neutral: "other",
};

type Props = Omit<HTMLAttributes<HTMLDivElement>, "children" | "onToggle"> & {
  entries: readonly RecentChange[];
  selected: ReadonlySet<RecentChangeTone>;
  onToggle: (tone: RecentChangeTone) => void;
  onClear?: () => void;
};

export function ToneFilterBar({
  entries,
  selected,
  onToggle,
  onClear,
  className,
  ...rest
}: Props) {
  const counts = toneCounts(entries);
  const hasAny = selected.size > 0;
  const cls = [styles.bar, className].filter(Boolean).join(" ");

  return (
    <div className={cls} role="group" aria-label="Filter by tone" {...rest}>
      {TONE_ORDER.map((tone) => {
        const count = counts[tone];
        const active = selected.has(tone);
        const chipCls = [
          styles.chip,
          active && styles.active,
          active && styles[`tone-${tone}`],
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={tone}
            type="button"
            className={chipCls}
            onClick={() => onToggle(tone)}
            disabled={count === 0 && !active}
            aria-pressed={active}
            title={`${TONE_LABEL[tone]} · ${count}`}
          >
            <span>{TONE_LABEL[tone]}</span>
            <span className={styles.count}>{count}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={styles.clear}
        onClick={onClear}
        disabled={!hasAny || !onClear}
      >
        Clear
      </button>
    </div>
  );
}
