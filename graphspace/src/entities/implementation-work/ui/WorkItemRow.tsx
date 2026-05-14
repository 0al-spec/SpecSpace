import type { HTMLAttributes } from "react";
import { SpecIdText } from "@/shared/ui/spec-id-text";
import type { WorkItem } from "../model/types";
import { toneFor } from "../lib/readiness";
import styles from "./WorkItemRow.module.css";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  item: WorkItem;
  onSpecIdClick?: (nodeId: string) => void;
};

// The work_item_id contract is `implementation_work::<spec>::<reason>`. Strip
// the prefix when rendering — the prefix carries no information for humans.
const shortenWorkId = (id: string): string => id.replace(/^implementation_work::/, "");

export function WorkItemRow({
  item,
  onSpecIdClick,
  className,
  ...rest
}: Props) {
  const tone = toneFor(item);
  const specList = item.affected_spec_ids.join(", ");
  const cls = [styles.row, className].filter(Boolean).join(" ");
  const pillCls = [styles.pill, styles[`tone-${tone}`]].join(" ");

  return (
    <div className={cls} {...rest}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          <span className={styles.reason}>{item.implementation_reason.replace(/_/g, " ")}</span>
          {specList && (
            <SpecIdText
              text={specList}
              onSpecIdClick={onSpecIdClick}
              variant="bare"
              specClassName={styles["spec-id"]}
            />
          )}
        </p>
        <div className={styles.right}>
          <span className={pillCls} title={`readiness: ${item.readiness}`}>
            {item.readiness.replace(/_/g, " ")}
          </span>
          {item.next_gap && (
            <span className={styles["next-gap"]}>next: {item.next_gap.replace(/_/g, " ")}</span>
          )}
        </div>
      </header>
      <h3 className={styles.title}>
        <SpecIdText
          text={shortenWorkId(item.work_item_id)}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />
      </h3>
      {item.blockers.length > 0 && (
        <ul className={styles.blockers}>
          {item.blockers.map((b) => (
            <li key={b}>
              <SpecIdText
                text={b}
                onSpecIdClick={onSpecIdClick}
                variant="bare"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
