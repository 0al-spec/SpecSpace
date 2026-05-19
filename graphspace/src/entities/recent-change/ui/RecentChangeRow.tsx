import type { HTMLAttributes } from "react";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import type { RecentChange } from "../model/types";
import {
  buildPromptOverlayDetails,
  toneForPromptOverlay,
} from "../lib/prompt-overlay";
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
  const promptOverlay = entry.prompt_overlay_provenance;

  return (
    <div className={cls} {...rest}>
      <span aria-hidden className={styles["tone-bar"]} />
      <div className={styles.body}>
        <div className={styles.labelRow}>
          <div className={styles.label}>
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
          </div>
          {promptOverlay ? <PromptOverlayDisclosure entry={entry} /> : null}
        </div>
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

function PromptOverlayDisclosure({ entry }: { entry: RecentChange }) {
  const provenance = entry.prompt_overlay_provenance;
  if (!provenance) return null;

  const tone = toneForPromptOverlay(provenance.status);
  const details = buildPromptOverlayDetails(provenance);
  const cls = [
    styles.promptBadge,
    styles[`promptBadge-${tone}`],
  ].filter(Boolean).join(" ");

  return (
    <details className={styles.promptOverlay}>
      <summary className={cls} title={`Prompt overlay: ${provenance.display_label}`}>
        Prompt: {provenance.display_label}
      </summary>
      <div className={styles.promptPanel}>
        {provenance.status === "unsafe" ? (
          <p className={styles.promptWarning}>Unsafe prompt state</p>
        ) : null}
        <dl className={styles.promptDetails}>
          {details.map((detail) => (
            <div key={`${detail.label}:${detail.value}`} className={styles.promptDetail}>
              <dt>{detail.label}</dt>
              <dd
                className={detail.tone === "danger" ? styles.promptDangerText : undefined}
                title={detail.title}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
