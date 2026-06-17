import type { MouseEvent } from "react";
import { useMemo, useState } from "react";
import type { ProposalIndexEntry } from "@/shared/proposal-viewer-contract";
import {
  SpecIdText,
  splitSpecIdText,
  type SpecIdTextPart,
  type SpecRefResolver,
} from "@/shared/ui/spec-id-text";
import {
  filterProposalEntries,
  filterProposalEntriesByContext,
  sortedFilterOptions,
  type ProposalViewerContextFilter,
  type ProposalViewerFilters,
} from "../model/proposal-filters";
import type { UseProposalIndexState } from "../model/use-proposal-index";
import { proposalViewerSpecRefs } from "../model/proposal-spec-refs";
import styles from "./ProposalViewerPanel.module.css";

type Props = {
  state: UseProposalIndexState;
  resolveSpecRef?: SpecRefResolver;
  contextFilter?: ProposalViewerContextFilter | null;
  onSpecIdClick?: (nodeId: string) => void;
  onClearContextFilter?: () => void;
  onAddProposalToAgentContext?: (entry: ProposalIndexEntry) => void;
  onStartConversationFromProposal?: (entry: ProposalIndexEntry) => void;
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
  contextFilter = null,
  onSpecIdClick,
  onClearContextFilter,
  onAddProposalToAgentContext,
  onStartConversationFromProposal,
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
  const contextEntries = useMemo(
    () =>
      proposalData
        ? filterProposalEntriesByContext(proposalData.entries, contextFilter)
        : [],
    [contextFilter, proposalData],
  );
  const filtered = useMemo(
    () => filterProposalEntries(contextEntries, filters),
    [contextEntries, filters],
  );
  const [selectedProposalKey, setSelectedProposalKey] = useState<string | null>(null);
  const selectedProposal = useMemo(
    () =>
      proposalData && selectedProposalKey
        ? proposalData.entries.find((entry) => entry.proposal_key === selectedProposalKey) ?? null
        : null,
    [proposalData, selectedProposalKey],
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

      {contextFilter ? (
        <ContextFilterNotice
          value={`Spec ${contextFilter.specId}`}
          onClear={onClearContextFilter}
        />
      ) : null}

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

      {selectedProposal ? (
        <ProposalDetail
          entry={selectedProposal}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          onClose={() => setSelectedProposalKey(null)}
          onAddProposalToAgentContext={onAddProposalToAgentContext}
          onStartConversationFromProposal={onStartConversationFromProposal}
        />
      ) : null}

      <div className={styles.entries}>
        {filtered.length === 0 ? (
          <Status label="No proposals" detail="No proposal entries match the current filters." />
        ) : (
          filtered.map((entry) => (
            <ProposalRow
              key={entry.proposal_key}
              entry={entry}
              selected={entry.proposal_key === selectedProposalKey}
              onSelect={() => setSelectedProposalKey(entry.proposal_key)}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ContextFilterNotice({
  value,
  onClear,
}: {
  value: string;
  onClear?: () => void;
}) {
  return (
    <div className={styles.contextFilter} role="status">
      <div className={styles.contextFilterText}>
        <span className={styles.contextFilterLabel}>Canvas filter</span>
        <span className={styles.contextFilterValue}>{value}</span>
      </div>
      <button
        type="button"
        className={styles.contextFilterClear}
        onClick={onClear}
        disabled={!onClear}
      >
        Clear
      </button>
    </div>
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
  selected,
  onSelect,
  resolveSpecRef,
  onSpecIdClick,
}: {
  entry: ProposalIndexEntry;
  selected: boolean;
  onSelect: () => void;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  const secondary = [
    entry.authority_state ? `lane ${entry.authority_state}` : null,
    entry.runtime_state ? `runtime ${entry.runtime_state}` : null,
    entry.promotion_status ? `promotion ${entry.promotion_status}` : null,
    entry.next_gap ? `next ${entry.next_gap}` : null,
  ].filter((item): item is string => Boolean(item));
  const affectedSpecIds = proposalViewerSpecRefs(entry.affected_spec_ids);

  return (
    <article className={[styles.row, selected ? styles.rowSelected : ""].join(" ")}>
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
      {entry.markdown.content_excerpt ? (
        <p className={styles.excerpt}>
          <SpecIdText
            text={entry.markdown.content_excerpt}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSpecIdClick}
            variant="bare"
          />
        </p>
      ) : null}
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
        {affectedSpecIds.length > 0 ? (
          affectedSpecIds.slice(0, 8).map((specId, index) => (
            <ProposalSpecRefChip
              key={`${specId}-${index}`}
              specId={specId}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
            />
          ))
        ) : (
          <span className={styles.emptyRefs}>No affected specs</span>
        )}
      </div>
      <div className={styles.path}>
        {entry.markdown.available ? "markdown" : "artifact"} · {entry.proposal_path ?? "no path"}
      </div>
      <button type="button" className={styles.openButton} onClick={onSelect}>
        {selected ? "Viewing Details" : "View Details"}
      </button>
    </article>
  );
}

function ProposalDetail({
  entry,
  resolveSpecRef,
  onSpecIdClick,
  onClose,
  onAddProposalToAgentContext,
  onStartConversationFromProposal,
}: {
  entry: ProposalIndexEntry;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
  onClose: () => void;
  onAddProposalToAgentContext?: (entry: ProposalIndexEntry) => void;
  onStartConversationFromProposal?: (entry: ProposalIndexEntry) => void;
}) {
  const metadata = [
    ["Status", entry.status],
    ["Lane", entry.authority_state],
    ["Type", entry.proposal_type],
    ["Runtime", entry.runtime_state],
    ["Posture", entry.runtime_posture],
    ["Promotion", entry.promotion_status],
    ["Trace", entry.trace_status],
    ["Next gap", entry.next_gap],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const preview = entry.markdown.content_preview ?? entry.markdown.content_excerpt ?? "";
  const body = entry.markdown.content_body ?? "";
  const affectedSpecIds = proposalViewerSpecRefs(entry.affected_spec_ids);

  return (
    <article className={styles.detail} aria-label={`Proposal ${entry.proposal_id} details`}>
      <div className={styles.detailHeader}>
        <div>
          <span className={styles.detailKicker}>Proposal detail</span>
          <h3 className={styles.detailTitle}>
            <SpecIdText
              text={entry.title}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
              variant="bare"
            />
          </h3>
        </div>
        <button type="button" className={styles.closeDetailButton} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.detailActions}>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => onAddProposalToAgentContext?.(entry)}
          disabled={!onAddProposalToAgentContext}
        >
          Add to Agent Context
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => onStartConversationFromProposal?.(entry)}
          disabled={!onStartConversationFromProposal}
        >
          Start Conversation
        </button>
      </div>

      <dl className={styles.detailGrid}>
        {metadata.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {affectedSpecIds.length > 0 ? (
        <section className={styles.detailSection} aria-label="Affected specs">
          <span className={styles.detailSectionTitle}>Affected specs</span>
          <div className={styles.specRefs}>
            {affectedSpecIds.map((specId, index) => (
              <ProposalSpecRefChip
                key={`${specId}-${index}`}
                specId={specId}
                resolveSpecRef={resolveSpecRef}
                onSpecIdClick={onSpecIdClick}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.detailSection} aria-label="Proposal preview">
        <span className={styles.detailSectionTitle}>Summary</span>
        {preview ? (
          <p className={styles.detailPreview}>
            <SpecIdText
              text={preview}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
              variant="bare"
            />
          </p>
        ) : (
          <p className={styles.detailMuted}>
            {entry.markdown.available
              ? "Markdown is available; no narrative preview was extracted."
              : "Markdown body is not available for this proposal."}
          </p>
        )}
      </section>

      <section className={styles.detailSection} aria-label="Proposal markdown">
        <span className={styles.detailSectionTitle}>Markdown</span>
        {body ? (
          <pre className={styles.markdownBody}>{body}</pre>
        ) : (
          <p className={styles.detailMuted}>
            {entry.markdown.available
              ? "Markdown metadata is available, but the full proposal body was not included."
              : "Markdown body is not available for this proposal."}
          </p>
        )}
      </section>

      <section className={styles.detailSection} aria-label="Source artifacts">
        <span className={styles.detailSectionTitle}>Sources</span>
        <div className={styles.meta}>
          {entry.source_kinds.map((source) => (
            <span key={source} className={styles.chip}>
              {source.replace(/^proposal_/, "")}
            </span>
          ))}
          <span className={styles.chip}>
            {entry.markdown.available ? "markdown available" : "artifact only"}
          </span>
        </div>
        <p className={styles.path}>{entry.proposal_path ?? "no path"}</p>
      </section>
    </article>
  );
}

function ProposalSpecRefChip({
  specId,
  resolveSpecRef,
  onSpecIdClick,
}: {
  specId: string;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  if (!resolveSpecRef) {
    return <span className={styles.chip}>{specId}</span>;
  }

  const parts = splitSpecIdText(specId, resolveSpecRef);
  if (!parts.some((part) => part.kind === "spec-ref")) {
    return <span className={styles.chip}>{specId}</span>;
  }

  return (
    <>
      {parts.map((part, index) => (
        <ProposalSpecRefPart
          key={`${part.value}-${index}`}
          part={part}
          onSpecIdClick={onSpecIdClick}
        />
      ))}
    </>
  );
}

function ProposalSpecRefPart({
  part,
  onSpecIdClick,
}: {
  part: SpecIdTextPart;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  if (part.kind === "text") {
    return <span className={styles.chip}>{part.value}</span>;
  }

  if (!onSpecIdClick) {
    return <span className={styles.chip}>{part.value}</span>;
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSpecIdClick(part.nodeId);
  };

  return (
    <button type="button" className={styles.chip} onClick={handleClick}>
      {part.value}
    </button>
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
