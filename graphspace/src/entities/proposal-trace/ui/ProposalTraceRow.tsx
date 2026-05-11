import { toneFor, type ProposalTraceTone } from "../lib/tone";
import type { ProposalTraceEntry } from "../model/types";
import styles from "./ProposalTraceRow.module.css";

const toneClass: Record<ProposalTraceTone, string> = {
  declared: styles["tone-declared"],
  inferred: styles["tone-inferred"],
  missing: styles["tone-missing"],
  neutral: styles["tone-neutral"],
};

type Props = {
  entry: ProposalTraceEntry;
};

export function ProposalTraceRow({ entry }: Props) {
  const cls = [styles.row, toneClass[toneFor(entry)]].join(" ");
  const traceStatus = entry.promotion_trace.trace_status ?? entry.promotion_trace.status;
  const specIds = entry.mentioned_spec_ids.slice(0, 4);

  return (
    <article className={cls}>
      <div className={styles["tone-bar"]} aria-hidden />
      <div className={styles.main}>
        <div className={styles.kicker}>
          <span className={styles["proposal-id"]}>{entry.proposal_id}</span>
          <span className={styles.status}>{traceStatus}</span>
        </div>
        <div className={styles.title}>{entry.title}</div>
        <div className={styles.meta}>
          <span className={styles.chip}>{entry.spec_refs.length} refs</span>
          {specIds.map((specId) => (
            <span key={specId} className={styles.chip}>{specId}</span>
          ))}
          {entry.mentioned_spec_ids.length > specIds.length && (
            <span className={styles.chip}>+{entry.mentioned_spec_ids.length - specIds.length}</span>
          )}
        </div>
        <div className={styles.gap}>next: {entry.next_gap}</div>
      </div>
    </article>
  );
}
