import { useMemo, useState } from "react";
import type { ProposalIndexEntry } from "@/shared/proposal-viewer-contract";
import { SpecIdText, type SpecRefResolver } from "@/shared/ui/spec-id-text";
import {
  filterProposalEntries,
  sortedFilterOptions,
  type ProposalViewerFilters,
} from "../model/proposal-filters";
import type { UseProposalIndexState } from "../model/use-proposal-index";
import styles from "./ProposalViewerPanel.module.css";

type Props = {
  state: UseProposalIndexState;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
};

function errorDetail(state: Exclude<UseProposalIndexState, { kind: "ok" | "idle" | "loading" }>): string {
  switch (state.kind) {
    case "http-error":
      return `HTTP ${state.status}${state.statusText ? ` ${state.statusText}` : ""}`;
    case "network-error":
      return "Proposal index endpoint is unreachable from the browser.";
    case "response-error":
      return state.reason;
    case "parse-error":
      return state.issues[0]?.message ?? "Proposal index response did not match the expected shape.";
  }
}

export function ProposalViewerPanel({
  state,
  resolveSpecRef,
  onSpecIdClick,
}: Props) {
  const [filters, setFilters] = useState<ProposalViewerFilters>({
    status: "",
    authorityState: "",
    runtimeState: "",
    specQuery: "",
  });

  const updateFilter = (patch: Partial<ProposalViewerFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };
  const proposalData = state.kind === "ok" ? state.data : null;
  const filtered = useMemo(
    () => proposalData ? filterProposalEntries(proposalData.entries, filters) : [],
    [proposalData, filters],
  );

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <section className={styles.panel} aria-label="Proposal viewer">
        <Status label="Loading proposals" detail="Reading /api/v1/proposals" />
      </section>
    );
  }

  if (state.kind !== "ok") {
    return (
      <section className={styles.panel} aria-label="Proposal viewer">
        <Status label="Proposal index unavailable" detail={errorDetail(state)} />
      </section>
    );
  }

  const { data } = state;
  const statusOptions = sortedFilterOptions(data.filters.status_counts);
  const authorityOptions = sortedFilterOptions(data.filters.authority_state_counts);
  const runtimeOptions = sortedFilterOptions(data.filters.runtime_state_counts);

  return (
    <section className={styles.panel} aria-label="Proposal viewer">
      <div className={styles.summary}>
        <Metric label="Proposals" value={data.entry_count} />
        <Metric label="Visible" value={filtered.length} />
        <Metric label="Spec refs" value={data.filters.affected_spec_ids.length} />
      </div>

      <div className={styles.filters} role="group" aria-label="Proposal filters">
        <FilterSelect
          label="Status"
          value={filters.status}
          options={statusOptions}
          onChange={(status) => updateFilter({ status })}
        />
        <FilterSelect
          label="Lane"
          value={filters.authorityState}
          options={authorityOptions}
          onChange={(authorityState) => updateFilter({ authorityState })}
        />
        <FilterSelect
          label="Runtime"
          value={filters.runtimeState}
          options={runtimeOptions}
          onChange={(runtimeState) => updateFilter({ runtimeState })}
        />
        <label className={styles.filterField}>
          <span>Spec</span>
          <input
            value={filters.specQuery}
            onChange={(event) => updateFilter({ specQuery: event.target.value })}
            placeholder="SG-SPEC-0001"
          />
        </label>
      </div>

      <div className={styles.sourceStrip}>
        {Object.entries(data.sources).map(([name, source]) => (
          <span
            key={name}
            className={[
              styles.source,
              source.available ? styles.sourceOk : styles.sourceMuted,
            ].join(" ")}
            title={source.path ?? source.reason ?? name}
          >
            {name.replace(/^proposal_/, "")}: {source.available ? source.entry_count : "missing"}
          </span>
        ))}
      </div>

      <div className={styles.entries}>
        {filtered.length === 0 ? (
          <Status label="No proposals" detail="No proposal entries match the current filters." />
        ) : (
          filtered.map((entry) => (
            <ProposalRow
              key={entry.proposal_key}
              entry={entry}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProposalRow({
  entry,
  resolveSpecRef,
  onSpecIdClick,
}: {
  entry: ProposalIndexEntry;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  const secondary = [
    entry.authority_state ? `lane ${entry.authority_state}` : null,
    entry.runtime_state ? `runtime ${entry.runtime_state}` : null,
    entry.promotion_status ? `promotion ${entry.promotion_status}` : null,
    entry.next_gap ? `next ${entry.next_gap}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.proposalId}>{entry.proposal_id}</span>
        <span className={styles.status}>{entry.status}</span>
      </div>
      <h3 className={styles.title}>
        <SpecIdText
          text={entry.title}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />
      </h3>
      {secondary.length > 0 ? (
        <div className={styles.meta}>
          {secondary.map((item) => (
            <span key={item} className={styles.chip}>
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.specRefs}>
        {entry.affected_spec_ids.length > 0 ? (
          entry.affected_spec_ids.slice(0, 8).map((specId) => (
            <SpecIdText
              key={specId}
              text={specId}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
              variant="chip"
            />
          ))
        ) : (
          <span className={styles.emptyRefs}>No affected specs</span>
        )}
      </div>
      <div className={styles.path}>
        {entry.markdown.available ? "markdown" : "artifact"} · {entry.proposal_path ?? "no path"}
      </div>
    </article>
  );
}

function Status({ label, detail }: { label: string; detail: string }) {
  return (
    <div className={styles.statusBox}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusDetail}>{detail}</span>
    </div>
  );
}
