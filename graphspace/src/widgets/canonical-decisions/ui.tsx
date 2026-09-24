import { useEffect, useMemo, useState } from "react";
import styles from "./ui.module.css";

const DECISION_STATUSES = [
  "idea",
  "stub",
  "outlined",
  "specified",
  "linked",
  "reviewed",
  "frozen",
] as const;

type DecisionSource = { doc: string; section?: string };

export type CanonicalDecision = {
  id: string;
  key: string;
  title: string;
  status: (typeof DECISION_STATUSES)[number];
  created_at: string;
  updated_at: string;
  revision: number;
  statement: string;
  rationale: string;
  alternatives_considered?: unknown[];
  provenance: {
    authority: string;
    authored_by?: string;
    sources?: DecisionSource[];
  };
  lifecycle?: Record<string, unknown>;
  source_ref: string;
  source_sha256: string;
};

export type ProductWorkspaceDecisions = {
  status: "available" | "unavailable";
  available: boolean;
  workspace_id: string;
  decisions: readonly CanonicalDecision[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeRelativePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("://") &&
    !value.split("/").some(part => !part || part === "." || part === "..")
  );
}

function isDecisionSource(value: unknown): value is DecisionSource {
  if (!isRecord(value) || !isSafeRelativePath(value.doc)) return false;
  return value.section === undefined || (typeof value.section === "string" && value.section.length > 0);
}

function isDecision(value: unknown): value is CanonicalDecision {
  if (!isRecord(value)) return false;
  const provenance = value.provenance;
  if (!isRecord(provenance)) return false;
  const sources = provenance.sources;
  const alternatives = value.alternatives_considered;
  const lifecycle = value.lifecycle;

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.key === "string" &&
    value.key.length > 0 &&
    typeof value.title === "string" &&
    typeof value.status === "string" &&
    DECISION_STATUSES.includes(value.status as (typeof DECISION_STATUSES)[number]) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    typeof value.revision === "number" &&
    Number.isInteger(value.revision) &&
    value.revision > 0 &&
    typeof value.statement === "string" &&
    typeof value.rationale === "string" &&
    typeof provenance.authority === "string" &&
    provenance.authority.trim().length > 0 &&
    (provenance.authored_by === undefined ||
      (typeof provenance.authored_by === "string" && provenance.authored_by.length > 0)) &&
    (sources === undefined || (Array.isArray(sources) && sources.every(isDecisionSource))) &&
    (alternatives === undefined || Array.isArray(alternatives)) &&
    (lifecycle === undefined ||
      (isRecord(lifecycle) &&
        (lifecycle.supersededBy === undefined ||
          lifecycle.supersededBy === null ||
          (typeof lifecycle.supersededBy === "string" && lifecycle.supersededBy.trim().length > 0)))) &&
    isSafeRelativePath(value.source_ref) &&
    value.source_ref.startsWith("specs/") &&
    typeof value.source_sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(value.source_sha256)
  );
}

export function parseProductWorkspaceDecisions(value: unknown): ProductWorkspaceDecisions | null {
  if (!isRecord(value)) return null;
  if (
    value.artifact_kind !== "specgraph_product_workspace_decision_index" ||
    value.schema_version !== 1 ||
    value.contract_ref !== "specgraph.product-workspace-decisions.v0.1" ||
    typeof value.workspace_id !== "string" ||
    value.workspace_id.length === 0 ||
    typeof value.available !== "boolean" ||
    !Array.isArray(value.decisions)
  ) {
    return null;
  }

  if (value.available) {
    if (
      value.status !== "available" ||
      !isRecord(value.summary) ||
      value.summary.decision_count !== value.decisions.length
    ) {
      return null;
    }
  } else if (value.status !== "unavailable" || value.decisions.length > 0) {
    return null;
  }

  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const candidate of value.decisions) {
    if (!isDecision(candidate) || ids.has(candidate.id) || keys.has(candidate.key)) return null;
    ids.add(candidate.id);
    keys.add(candidate.key);
  }

  return value as unknown as ProductWorkspaceDecisions;
}

type Props = {
  url: string;
  artifactContentUrl: string;
  refreshKey?: number;
  fixture?: ProductWorkspaceDecisions;
};

export function CanonicalDecisionsPanel({
  url,
  artifactContentUrl,
  refreshKey = 0,
  fixture,
}: Props) {
  const [payload, setPayload] = useState<ProductWorkspaceDecisions | null>(fixture ?? null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState<string | null>(null);

  useEffect(() => {
    if (fixture) {
      setPayload(fixture);
      return;
    }

    const controller = new AbortController();
    setPayload(null);
    setError(null);
    fetch(url, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail ?? body.error ?? `HTTP ${response.status}`);
        const parsed = parseProductWorkspaceDecisions(body);
        if (!parsed) throw new Error("Unsupported or invalid Decision index response");
        setPayload(parsed);
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(String(reason));
      });

    return () => controller.abort();
  }, [url, refreshKey, fixture]);

  const selected = useMemo(
    () => payload?.decisions.find(item => item.id === selectedId) ?? payload?.decisions[0] ?? null,
    [payload, selectedId],
  );

  useEffect(() => {
    if (!selected || fixture) {
      setSourceText(null);
      return;
    }

    const controller = new AbortController();
    setSourceText(null);
    const separator = artifactContentUrl.includes("?") ? "&" : "?";
    fetch(`${artifactContentUrl}${separator}path=${encodeURIComponent(selected.source_ref)}`, {
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        setSourceText(body.content_kind === "text" ? body.text : JSON.stringify(body.data, null, 2));
      })
      .catch(() => {
        if (!controller.signal.aborted) setSourceText("Source artifact is unavailable.");
      });

    return () => controller.abort();
  }, [selected?.source_ref, artifactContentUrl, refreshKey, fixture]);

  return (
    <section className={styles.panel} aria-labelledby="canonical-decisions-title">
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Product Workspace · read only</span>
          <h2 id="canonical-decisions-title">Canonical decisions</h2>
        </div>
        <span>
          {payload?.available
            ? `${payload.decisions.length} ${payload.decisions.length === 1 ? "decision" : "decisions"}`
            : payload
              ? "not published"
              : "loading"}
        </span>
      </header>

      {error ? (
        <p className={styles.message} role="alert">
          Decision index unavailable: {error}
        </p>
      ) : !payload ? (
        <p className={styles.message}>Loading canonical Decisions…</p>
      ) : !payload.available ? (
        <p className={styles.message}>Canonical Decisions have not been published for this workspace yet.</p>
      ) : payload.decisions.length === 0 ? (
        <p className={styles.message}>No canonical Decisions are published for this workspace.</p>
      ) : (
        <div className={styles.body}>
          <nav className={styles.list} aria-label="Canonical Decisions">
            {payload.decisions.map(decision => (
              <button
                type="button"
                key={decision.id}
                aria-pressed={selected?.id === decision.id}
                onClick={() => setSelectedId(decision.id)}
                className={styles.item}
              >
                <strong>{decision.title}</strong>
                <span>
                  {decision.key} · {decision.status}
                </span>
              </button>
            ))}
          </nav>

          {selected && (
            <article className={styles.detail}>
              <div className={styles.identity}>
                <span>
                  ID <code>{selected.id}</code>
                </span>
                <span>
                  Key <code>{selected.key}</code>
                </span>
                <span>
                  Lifecycle status <code>{selected.status}</code>
                </span>
                {typeof selected.lifecycle?.supersededBy === "string" && (
                  <span>
                    Superseded by <code>{selected.lifecycle.supersededBy}</code>
                  </span>
                )}
              </div>
              <h3>{selected.title}</h3>
              <h4>Statement</h4>
              <p>{selected.statement}</p>
              <h4>Rationale</h4>
              <p>{selected.rationale}</p>
              <dl>
                <dt>Authority</dt>
                <dd>{selected.provenance.authority}</dd>
                {selected.provenance.authored_by && (
                  <>
                    <dt>Authored by</dt>
                    <dd>{selected.provenance.authored_by}</dd>
                  </>
                )}
                {selected.provenance.sources?.length ? (
                  <>
                    <dt>Evidence sources</dt>
                    <dd>
                      {selected.provenance.sources.map((source, index) => (
                        <span key={`${source.doc}-${index}`}>
                          <code>{source.doc}</code>
                          {source.section ? ` · ${source.section}` : ""}
                          {index < (selected.provenance.sources?.length ?? 0) - 1 ? ", " : ""}
                        </span>
                      ))}
                    </dd>
                  </>
                ) : null}
                <dt>Revision</dt>
                <dd>{selected.revision}</dd>
                <dt>Created</dt>
                <dd>{selected.created_at}</dd>
                <dt>Updated</dt>
                <dd>{selected.updated_at}</dd>
                <dt>Source</dt>
                <dd>
                  <code>{selected.source_ref}</code>
                </dd>
              </dl>
              {selected.alternatives_considered?.length ? (
                <details>
                  <summary>Alternatives considered</summary>
                  <pre>{JSON.stringify(selected.alternatives_considered, null, 2)}</pre>
                </details>
              ) : null}
              <details>
                <summary>View source YAML</summary>
                <pre>{sourceText ?? "Loading source artifact…"}</pre>
              </details>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
