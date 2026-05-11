import type { HTMLAttributes } from "react";
import styles from "./SpecSearchBox.module.css";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange"> & {
  query: string;
  onQueryChange: (query: string) => void;
  onClear?: () => void;
  resultCount: number;
  totalCount: number;
};

export function SpecSearchBox({
  query,
  onQueryChange,
  onClear,
  resultCount,
  totalCount,
  className,
  ...rest
}: Props) {
  const hasQuery = query.trim().length > 0;
  const cls = [styles.search, className].filter(Boolean).join(" ");

  return (
    <div className={cls} role="search" {...rest}>
      <input
        className={styles.input}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="SG-SPEC-0028 or specs/nodes"
        aria-label="Search recent changes by spec id or source path"
        autoComplete="off"
        spellCheck={false}
      />
      <span className={styles.count}>
        {hasQuery ? `${resultCount}/${totalCount}` : `${totalCount}`}
      </span>
      <button
        type="button"
        className={styles.clear}
        onClick={onClear}
        disabled={!hasQuery || !onClear}
      >
        Clear
      </button>
    </div>
  );
}
