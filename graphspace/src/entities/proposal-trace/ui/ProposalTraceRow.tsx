import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import { proposalTraceSpecRefs } from "../lib/spec-refs";
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
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
};

export function ProposalTraceRow({
  entry,
  resolveSpecRef,
  onSpecIdClick,
}: Props) {
  const cls = [styles.row, toneClass[toneFor(entry)]].join(" ");
  const traceStatus = entry.promotion_trace.trace_status ?? entry.promotion_trace.status;
  const mentionedSpecIds = proposalTraceSpecRefs(entry.mentioned_spec_ids);
  const specIds = mentionedSpecIds.slice(0, 4);

  return (
    <article className={cls}>
      <div className={styles["tone-bar"]} aria-hidden />
      <div className={styles.main}>
        <div className={styles.kicker}>
          <span className={styles["proposal-id"]}>{entry.proposal_id}</span>
          <span className={styles.status}>{traceStatus}</span>
        </div>
        <div className={styles.title}>
          <SpecIdText
            text={entry.title}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSpecIdClick}
            variant="bare"
          />
        </div>
        <div className={styles.meta}>
          <span className={styles.chip}>{entry.spec_refs.length} refs</span>
          {specIds.map((specId) => (
            <ProposalTraceSpecRef
              key={specId}
              specId={specId}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
            />
          ))}
          {mentionedSpecIds.length > specIds.length && (
            <span className={styles.chip}>+{mentionedSpecIds.length - specIds.length}</span>
          )}
        </div>
        <div className={styles.gap}>
          next:{" "}
          <SpecIdText
            text={entry.next_gap}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSpecIdClick}
            variant="bare"
          />
        </div>
      </div>
    </article>
  );
}

function ProposalTraceSpecRef({
  specId,
  resolveSpecRef,
  onSpecIdClick,
}: {
  specId: string;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  if (!resolveSpecRef?.(specId)) {
    return <span className={styles.chip}>{specId}</span>;
  }

  return (
    <SpecIdText
      text={specId}
      resolveSpecRef={resolveSpecRef}
      onSpecIdClick={onSpecIdClick}
      variant="chip"
    />
  );
}
