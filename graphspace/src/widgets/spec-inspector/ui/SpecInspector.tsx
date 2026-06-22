import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { SpecMarkdownContextSource } from "@/entities/agent-workbench";
import { SpecNodeStatusBadge } from "@/entities/spec-node";
import {
  SpecIdText,
  type SpecRefResolver,
} from "@/shared/ui/spec-id-text";
import {
  buildSpecInspectorModel,
  fetchSpecMarkdownCompile,
  fetchSpecMarkdownExport,
  type SpecMarkdownCompileCapability,
  type SpecMarkdownCompileFetchResult,
  useSpecNodeDetail,
  type SpecMarkdownExportFetchResult,
  type SpecMarkdownExportScope,
  type SpecInspectorDetailModel,
  type SpecInspectorSelection,
  type SpecRelationGroup,
  type SpecRelation,
  type UseSpecNodeDetailState,
} from "../model";
import styles from "./SpecInspector.module.css";

type MarkdownExportState =
  | { kind: "idle" }
  | ({ kind: "loading" } & MarkdownExportRequest)
  | (SpecMarkdownExportFetchResult & MarkdownExportRequest);

type MarkdownExportRequest = {
  rootId: string;
  scope: SpecMarkdownExportScope;
};

type MarkdownCompileState =
  | { kind: "idle" }
  | ({ kind: "loading" } & MarkdownExportRequest)
  | (SpecMarkdownCompileFetchResult & MarkdownExportRequest);

type Props = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  selection: SpecInspectorSelection;
  specNodeDetailUrl?: string;
  specMarkdownUrl?: string;
  specMarkdownCompileUrl?: string;
  onClose: () => void;
  resolveSpecRef?: SpecRefResolver;
  onSelectNodeId?: (nodeId: string) => void;
  compileCapability?: SpecMarkdownCompileCapability | null;
  onAddMarkdownToAgentContext?: (source: SpecMarkdownContextSource) => void;
  onStartConversationFromMarkdown?: (source: SpecMarkdownContextSource) => void;
};

export function SpecInspector({
  selection,
  specNodeDetailUrl,
  specMarkdownUrl,
  specMarkdownCompileUrl,
  onClose,
  resolveSpecRef,
  onSelectNodeId,
  compileCapability = null,
  onAddMarkdownToAgentContext,
  onStartConversationFromMarkdown,
  className,
  ...rest
}: Props) {
  const [copied, setCopied] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  const [compiledCopied, setCompiledCopied] = useState(false);
  const [markdownScope, setMarkdownScope] =
    useState<SpecMarkdownExportScope>("subtree");
  const [markdownState, setMarkdownState] = useState<MarkdownExportState>({
    kind: "idle",
  });
  const [compileState, setCompileState] = useState<MarkdownCompileState>({
    kind: "idle",
  });
  const markdownAbortRef = useRef<AbortController | null>(null);
  const compileAbortRef = useRef<AbortController | null>(null);
  const detailState = useSpecNodeDetail({
    nodeId: selection.node.node_id,
    url: specNodeDetailUrl,
  });
  const detail =
    detailState.kind === "ok" ? detailState.data.data : null;
  const model = buildSpecInspectorModel(selection, detail);
  const { node } = model;
  const cls = [styles.panel, className].filter(Boolean).join(" ");
  const activeMarkdownState: MarkdownExportState =
    markdownState.kind !== "idle" &&
    (markdownState.rootId !== node.node_id || markdownState.scope !== markdownScope)
      ? { kind: "idle" }
      : markdownState;
  const markdownExport =
    activeMarkdownState.kind === "ok" ? activeMarkdownState.data : null;
  const activeCompileState: MarkdownCompileState =
    compileState.kind !== "idle" &&
    (compileState.rootId !== node.node_id || compileState.scope !== markdownScope)
      ? { kind: "idle" }
      : compileState;
  const compileData =
    activeCompileState.kind === "ok" ? activeCompileState.data : null;

  useEffect(() => {
    markdownAbortRef.current?.abort();
    markdownAbortRef.current = null;
    compileAbortRef.current?.abort();
    compileAbortRef.current = null;
    setMarkdownState({ kind: "idle" });
    setCompileState({ kind: "idle" });
    setMarkdownCopied(false);
    setCompiledCopied(false);
  }, [node.node_id, markdownScope]);

  useEffect(() => {
    return () => {
      markdownAbortRef.current?.abort();
      compileAbortRef.current?.abort();
    };
  }, []);

  const copyFilePath = () => {
    void navigator.clipboard.writeText(model.filePath).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };
  const exportMarkdown = () => {
    markdownAbortRef.current?.abort();
    const controller = new AbortController();
    const requestRootId = node.node_id;
    const requestScope = markdownScope;
    markdownAbortRef.current = controller;
    setMarkdownCopied(false);
    setMarkdownState({
      kind: "loading",
      rootId: requestRootId,
      scope: requestScope,
    });

    void fetchSpecMarkdownExport({
      rootId: requestRootId,
      scope: requestScope,
      url: specMarkdownUrl,
      signal: controller.signal,
    })
      .then((result) => {
        if (markdownAbortRef.current === controller) {
          setMarkdownState({
            ...result,
            rootId: requestRootId,
            scope: requestScope,
          });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (markdownAbortRef.current === controller) {
          setMarkdownState({
            kind: "network-error",
            message: error instanceof Error ? error.message : "Network error",
            error,
            rootId: requestRootId,
            scope: requestScope,
          });
        }
      })
      .finally(() => {
        if (markdownAbortRef.current === controller) {
          markdownAbortRef.current = null;
        }
      });
  };
  const compileMarkdown = () => {
    if (!compileCapability?.available) return;
    compileAbortRef.current?.abort();
    const controller = new AbortController();
    const requestRootId = node.node_id;
    const requestScope = markdownScope;
    compileAbortRef.current = controller;
    setCompiledCopied(false);
    setCompileState({
      kind: "loading",
      rootId: requestRootId,
      scope: requestScope,
    });

    void fetchSpecMarkdownCompile({
      rootId: requestRootId,
      scope: requestScope,
      url: specMarkdownCompileUrl,
      signal: controller.signal,
    })
      .then((result) => {
        if (compileAbortRef.current === controller) {
          setCompileState({
            ...result,
            rootId: requestRootId,
            scope: requestScope,
          });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (compileAbortRef.current === controller) {
          setCompileState({
            kind: "network-error",
            message: error instanceof Error ? error.message : "Network error",
            error,
            rootId: requestRootId,
            scope: requestScope,
          });
        }
      })
      .finally(() => {
        if (compileAbortRef.current === controller) {
          compileAbortRef.current = null;
        }
      });
  };
  const copyMarkdown = () => {
    if (!markdownExport) return;
    void navigator.clipboard.writeText(markdownExport.markdown).then(() => {
      setMarkdownCopied(true);
      window.setTimeout(() => setMarkdownCopied(false), 1400);
    });
  };
  const downloadMarkdown = () => {
    if (!markdownExport) return;
    const blob = new Blob([markdownExport.markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = markdownExport.download_filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const copyCompiledMarkdown = () => {
    const compiledMarkdown = compileData?.compile.compiled_markdown;
    if (!compiledMarkdown) return;
    void navigator.clipboard.writeText(compiledMarkdown).then(() => {
      setCompiledCopied(true);
      window.setTimeout(() => setCompiledCopied(false), 1400);
    });
  };
  const downloadCompiledMarkdown = () => {
    const compiledMarkdown = compileData?.compile.compiled_markdown;
    if (!compiledMarkdown) return;
    const blob = new Blob([compiledMarkdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = compileData.export.download_filename.replace(
      /\.md$/i,
      ".compiled.md",
    );
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const markdownExportContextSource = (): SpecMarkdownContextSource | null => {
    if (!markdownExport) return null;
    return {
      node_id: node.node_id,
      title: node.title,
      scope: markdownExport.scope,
      source_kind: "export",
      download_filename: markdownExport.download_filename,
      node_count: markdownExport.manifest.node_count,
      markdown: markdownExport.markdown,
    };
  };
  const compiledMarkdownContextSource = (): SpecMarkdownContextSource | null => {
    const compiledMarkdown = compileData?.compile.compiled_markdown;
    if (!compiledMarkdown || !compileData) return null;
    return {
      node_id: node.node_id,
      title: node.title,
      scope: compileData.scope,
      source_kind: "hyperprompt_compile",
      download_filename: compileData.export.download_filename.replace(
        /\.md$/i,
        ".compiled.md",
      ),
      node_count: compileData.export.manifest.node_count,
      markdown: compiledMarkdown,
      compile: {
        exit_code: compileData.compile.exit_code,
        compiled_md: compileData.compile.compiled_md ?? null,
        manifest_json: compileData.compile.manifest_json ?? null,
        root_hc: compileData.compile.root_hc ?? null,
      },
    };
  };
  const addMarkdownExportToAgentContext = () => {
    const source = markdownExportContextSource();
    if (!source || !onAddMarkdownToAgentContext) return;
    onAddMarkdownToAgentContext(source);
  };
  const addCompiledMarkdownToAgentContext = () => {
    const source = compiledMarkdownContextSource();
    if (!source || !onAddMarkdownToAgentContext) return;
    onAddMarkdownToAgentContext(source);
  };
  const startMarkdownExportConversation = () => {
    const source = markdownExportContextSource();
    if (!source || !onStartConversationFromMarkdown) return;
    onStartConversationFromMarkdown(source);
  };
  const startCompiledMarkdownConversation = () => {
    const source = compiledMarkdownContextSource();
    if (!source || !onStartConversationFromMarkdown) return;
    onStartConversationFromMarkdown(source);
  };

  return (
    <aside className={cls} aria-label="Spec inspector" {...rest}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <SpecIdText
            text={node.node_id}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSelectNodeId}
            variant="bare"
            specClassName={styles.id}
          />
          <SpecNodeStatusBadge status={node.status} />
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </header>

      <div className={styles.scroll}>
        <h2 className={styles.title}>{node.title}</h2>
        {model.detail?.objective ? (
          <p className={styles.objective}>
            {renderRichInlineText(
              model.detail.objective,
              resolveSpecRef,
              onSelectNodeId,
            )}
          </p>
        ) : null}

        <dl className={styles.metaGrid}>
          <Field label="Kind" value={node.kind} />
          <Field label="Maturity" value={model.maturityLabel} />
          <Field label="Acceptance" value={String(node.acceptance_count)} />
          <Field label="Decisions" value={String(node.decisions_count)} />
          <Field label="Gaps" value={String(node.gap_count)} wide />
          <div className={`${styles.field} ${styles.wide}`}>
            <div className={styles.fieldHeader}>
              <dt>File</dt>
              <button
                type="button"
                className={styles.copyButton}
                onClick={copyFilePath}
              >
                {copied ? "Copied" : "Copy Path"}
              </button>
            </div>
            <dd className={styles.fileValue} title={model.filePath}>
              {node.file_name}
            </dd>
          </div>
        </dl>

        <MarkdownExportSection
          state={activeMarkdownState}
          compileState={activeCompileState}
          compileCapability={compileCapability}
          scope={markdownScope}
          copied={markdownCopied}
          compiledCopied={compiledCopied}
          canAddToAgentContext={Boolean(onAddMarkdownToAgentContext)}
          canStartConversation={Boolean(onStartConversationFromMarkdown)}
          onScopeChange={setMarkdownScope}
          onExport={exportMarkdown}
          onCompile={compileMarkdown}
          onCopy={copyMarkdown}
          onDownload={downloadMarkdown}
          onCopyCompiled={copyCompiledMarkdown}
          onDownloadCompiled={downloadCompiledMarkdown}
          onAddExportToAgentContext={addMarkdownExportToAgentContext}
          onAddCompiledToAgentContext={addCompiledMarkdownToAgentContext}
          onStartExportConversation={startMarkdownExportConversation}
          onStartCompiledConversation={startCompiledMarkdownConversation}
        />

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Gap profile</h3>
          <div className={styles.metricRow}>
            <Metric label="Evidence" value={node.evidence_gap} />
            <Metric label="Input" value={node.input_gap} />
            <Metric label="Execution" value={node.execution_gap} />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Direct links</h3>
          {model.relationGroups.map((group) => (
            <RelationGroup
              key={group.id}
              group={group}
              selectedNodeId={node.node_id}
              onSelectNodeId={onSelectNodeId}
            />
          ))}
        </section>

        <DetailLoadStatus state={detailState} />

        {model.detail ? (
          <RichSpecDetail
            detail={model.detail}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSelectNodeId}
          />
        ) : null}

        {node.diagnostics.length > 0 ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Diagnostics</h3>
            <ul className={styles.diagnostics}>
              {node.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.message}-${index}`}>
                  {renderRichInlineText(
                    diagnostic.message,
                    resolveSpecRef,
                    onSelectNodeId,
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function MarkdownExportSection({
  state,
  compileState,
  compileCapability,
  scope,
  copied,
  compiledCopied,
  canAddToAgentContext,
  canStartConversation,
  onScopeChange,
  onExport,
  onCompile,
  onCopy,
  onDownload,
  onCopyCompiled,
  onDownloadCompiled,
  onAddExportToAgentContext,
  onAddCompiledToAgentContext,
  onStartExportConversation,
  onStartCompiledConversation,
}: {
  state: MarkdownExportState;
  compileState: MarkdownCompileState;
  compileCapability: SpecMarkdownCompileCapability | null;
  scope: SpecMarkdownExportScope;
  copied: boolean;
  compiledCopied: boolean;
  canAddToAgentContext: boolean;
  canStartConversation: boolean;
  onScopeChange: (scope: SpecMarkdownExportScope) => void;
  onExport: () => void;
  onCompile: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onCopyCompiled: () => void;
  onDownloadCompiled: () => void;
  onAddExportToAgentContext: () => void;
  onAddCompiledToAgentContext: () => void;
  onStartExportConversation: () => void;
  onStartCompiledConversation: () => void;
}) {
  const exportData = state.kind === "ok" ? state.data : null;
  const compileData = compileState.kind === "ok" ? compileState.data : null;
  const status = describeMarkdownExportState(state);
  const compileStatus = describeMarkdownCompileState(
    compileState,
    compileCapability,
  );
  const compileAvailable = Boolean(compileCapability?.available);

  return (
    <section
      className={`${styles.section} ${styles.exportSection}`}
      aria-busy={state.kind === "loading" || compileState.kind === "loading"}
    >
      <div className={styles.exportHeader}>
        <h3 className={styles.sectionTitle}>Markdown export</h3>
        <div className={styles.exportActions}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onExport}
            disabled={state.kind === "loading"}
          >
            {exportData ? "Refresh" : "Export"}
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onCopy}
            disabled={!exportData}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onDownload}
            disabled={!exportData}
          >
            Download
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onAddExportToAgentContext}
            disabled={!exportData || !canAddToAgentContext}
            title={
              canAddToAgentContext
                ? "Add exported Markdown to Agent context"
                : "Agent context is not available"
            }
          >
            Add Context
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onStartExportConversation}
            disabled={!exportData || !canStartConversation}
            title={
              canStartConversation
                ? "Add exported Markdown and open Agent conversation"
                : "Agent conversation is not available"
            }
          >
            Start Chat
          </button>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onCompile}
            disabled={!compileAvailable || compileState.kind === "loading"}
            title={
              compileAvailable
                ? "Compile with Hyperprompt"
                : compileCapability?.detail
            }
          >
            {compileState.kind === "loading" ? "Compiling" : "Compile"}
          </button>
        </div>
      </div>

      <div className={styles.exportScope} aria-label="Markdown export scope">
        <button
          type="button"
          className={`${styles.scopeButton} ${
            scope === "node" ? styles.scopeButtonActive : ""
          }`}
          aria-pressed={scope === "node"}
          onClick={() => onScopeChange("node")}
        >
          Selected spec
        </button>
        <button
          type="button"
          className={`${styles.scopeButton} ${
            scope === "subtree" ? styles.scopeButtonActive : ""
          }`}
          aria-pressed={scope === "subtree"}
          onClick={() => onScopeChange("subtree")}
        >
          Refinement subtree
        </button>
      </div>

      {status ? <div className={styles.exportStatus}>{status}</div> : null}
      {compileStatus ? (
        <div className={styles.exportStatus}>{compileStatus}</div>
      ) : null}

      {exportData ? (
        <>
          <dl className={styles.exportStats} aria-label="Markdown export stats">
            <div className={styles.exportStat}>
              <dt className={styles.exportStatLabel}>Nodes</dt>
              <dd className={styles.exportStatValue}>
                {exportData.manifest.node_count}
              </dd>
            </div>
            <div className={styles.exportStat}>
              <dt className={styles.exportStatLabel}>Depth</dt>
              <dd className={styles.exportStatValue}>
                {exportData.manifest.max_depth_reached}
              </dd>
            </div>
            <div className={styles.exportStat}>
              <dt className={styles.exportStatLabel}>Cycles</dt>
              <dd className={styles.exportStatValue}>
                {exportData.manifest.cycles_skipped.length}
              </dd>
            </div>
            <div className={styles.exportStat}>
              <dt className={styles.exportStatLabel}>Missing</dt>
              <dd className={styles.exportStatValue}>
                {exportData.manifest.missing_skipped.length}
              </dd>
            </div>
          </dl>
          <pre className={`${styles.pre} ${styles.markdownPreview}`}>
            {exportData.markdown}
          </pre>
        </>
      ) : null}

      {compileData ? (
        <div className={styles.compileResult}>
          <div className={styles.compileHeader}>
            <div>
              <span className={styles.compileKicker}>Hyperprompt compile</span>
              <div className={styles.compileTitle}>
                Exit code {compileData.compile.exit_code}
              </div>
            </div>
            <div className={styles.exportActions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={onCopyCompiled}
                disabled={!compileData.compile.compiled_markdown}
              >
                {compiledCopied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={onDownloadCompiled}
                disabled={!compileData.compile.compiled_markdown}
              >
                Download
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={onAddCompiledToAgentContext}
                disabled={
                  !compileData.compile.compiled_markdown || !canAddToAgentContext
                }
                title={
                  canAddToAgentContext
                    ? "Add compiled Markdown to Agent context"
                    : "Agent context is not available"
                }
              >
                Add Context
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={onStartCompiledConversation}
                disabled={
                  !compileData.compile.compiled_markdown || !canStartConversation
                }
                title={
                  canStartConversation
                    ? "Add compiled Markdown and open Agent conversation"
                    : "Agent conversation is not available"
                }
              >
                Start Chat
              </button>
            </div>
          </div>
          <dl className={styles.compilePaths} aria-label="Compile artifacts">
            {compileData.compile.compiled_md ? (
              <KeyValue
                label="Compiled file"
                value={compileData.compile.compiled_md}
              />
            ) : null}
            {compileData.compile.manifest_json ? (
              <KeyValue
                label="Manifest"
                value={compileData.compile.manifest_json}
              />
            ) : null}
            {compileData.compile.root_hc ? (
              <KeyValue label="Root HC" value={compileData.compile.root_hc} />
            ) : null}
          </dl>
          {compileData.compile.compiled_markdown ? (
            <pre className={`${styles.pre} ${styles.markdownPreview}`}>
              {compileData.compile.compiled_markdown}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function describeMarkdownExportState(state: MarkdownExportState): string | null {
  switch (state.kind) {
    case "idle":
      return null;
    case "loading":
      return "Exporting Markdown...";
    case "ok":
      return null;
    case "http-error":
      return `Markdown export unavailable: HTTP ${state.status}`;
    case "network-error":
      return `Markdown export unavailable: ${state.message}`;
    case "response-error":
      return `Markdown export unavailable: ${state.reason}`;
    case "parse-error":
      return "Markdown export unavailable: response did not match the contract";
    case "invariant-violation":
      return `Markdown export unavailable: ${state.message}`;
    case "version-not-supported":
      return `Markdown export unavailable: schema v${state.schema_version} is not supported`;
    case "wrong-artifact-kind":
      return "Markdown export unavailable: wrong artifact kind";
  }
  return null;
}

function describeMarkdownCompileState(
  state: MarkdownCompileState,
  capability: SpecMarkdownCompileCapability | null,
): string | null {
  if (!capability?.available) {
    return capability
      ? `Hyperprompt compile disabled: ${capability.detail}`
      : "Hyperprompt compile status is loading...";
  }

  switch (state.kind) {
    case "idle":
      return capability.resolvedBinary
        ? `Hyperprompt compile ready: ${capability.resolvedBinary}`
        : "Hyperprompt compile ready";
    case "loading":
      return "Compiling Markdown with Hyperprompt...";
    case "ok":
      return null;
    case "http-error":
      return `Hyperprompt compile unavailable: HTTP ${state.status}${describeHttpErrorBody(state.body)}`;
    case "network-error":
      return `Hyperprompt compile unavailable: ${state.message}`;
    case "response-error":
      return `Hyperprompt compile unavailable: ${state.reason}`;
    case "parse-error":
      return "Hyperprompt compile unavailable: response did not match the contract";
    case "invariant-violation":
      return `Hyperprompt compile unavailable: ${state.message}`;
    case "version-not-supported":
      return `Hyperprompt compile unavailable: schema v${state.schema_version} is not supported`;
    case "wrong-artifact-kind":
      return "Hyperprompt compile unavailable: wrong artifact kind";
  }
  return null;
}

function describeHttpErrorBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  const compile =
    record.compile && typeof record.compile === "object"
      ? (record.compile as Record<string, unknown>)
      : null;
  const detail = typeof record.detail === "string" ? record.detail : null;
  const error = typeof record.error === "string" ? record.error : null;
  const compileError = typeof compile?.error === "string" ? compile.error : null;
  const exitCode =
    typeof compile?.exit_code === "number" ? `exit code ${compile.exit_code}` : null;
  const stderr = typeof compile?.stderr === "string" ? compile.stderr.trim() : "";
  const status = typeof record.status === "string" ? record.status : null;
  const message = detail ?? error ?? compileError ?? exitCode ?? stderr ?? status;
  return message ? ` — ${message}` : "";
}

function DetailLoadStatus({ state }: { state: UseSpecNodeDetailState }) {
  const message = describeDetailState(state);
  return message ? <div className={styles.detailStatus}>{message}</div> : null;
}

function describeDetailState(state: UseSpecNodeDetailState): string | null {
  switch (state.kind) {
    case "idle":
    case "loading":
      return "Loading detailed spec content...";
    case "ok":
      return null;
    case "http-error":
      return `Detailed spec content unavailable: HTTP ${state.status}`;
    case "network-error":
      return `Detailed spec content unavailable: ${state.message}`;
    case "response-error":
      return `Detailed spec content unavailable: ${state.reason}`;
    case "parse-error":
      return "Detailed spec content unavailable: response did not match the contract";
    case "invariant-violation":
      return `Detailed spec content unavailable: ${state.message}`;
    case "version-not-supported":
      return `Detailed spec content unavailable: schema v${state.schema_version} is not supported`;
    case "wrong-artifact-kind":
      return "Detailed spec content unavailable: wrong artifact kind";
  }
  return null;
}

function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? `${styles.field} ${styles.wide}` : styles.field}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function RichSpecDetail({
  detail,
  resolveSpecRef,
  onSpecIdClick,
}: {
  detail: SpecInspectorDetailModel;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  const hasScope = Boolean(detail.scope);
  const hasFlow =
    detail.inputs.length > 0 ||
    detail.outputs.length > 0 ||
    detail.allowedPaths.length > 0;
  const hasLifecycle = Boolean(detail.createdAt || detail.updatedAt);
  const hasRuntime = hasLifecycle || detail.runtime.length > 0;

  return (
    <>
      {hasScope ? (
        <ScopeSection
          scope={detail.scope!}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
        />
      ) : null}

      {detail.acceptance.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Acceptance</h3>
          <ol className={styles.contentList}>
            {detail.acceptance.map((item, index) => (
              <li key={`${item.text}-${index}`} className={styles.contentItem}>
                <span
                  className={
                    item.hasEvidence ? styles.evidenceBadge : styles.gapBadge
                  }
                >
                  {item.hasEvidence ? "evidence" : "gap"}
                </span>
                <span className={styles.contentText}>
                  {renderRichInlineText(item.text, resolveSpecRef, onSpecIdClick)}
                </span>
                {item.malformed ? (
                  <span className={styles.formatBadge}>format</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {detail.evidence.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Acceptance evidence</h3>
          <div className={styles.evidenceList}>
            {detail.evidence.map((item, index) => (
              <article key={`${item.criterion}-${index}`} className={styles.evidenceItem}>
                <div className={styles.evidenceCriterion}>{item.criterion}</div>
                {item.evidence ? (
                  <p className={styles.evidenceText}>
                    {renderRichInlineText(
                      item.evidence,
                      resolveSpecRef,
                      onSpecIdClick,
                    )}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {detail.terminology.length > 0 ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Terminology</h3>
          <dl className={styles.termList}>
            {detail.terminology.map((entry) => (
              <div key={entry.term} className={styles.termItem}>
                <dt>{entry.term}</dt>
                <dd>
                  {renderRichInlineText(
                    entry.definition,
                    resolveSpecRef,
                    onSpecIdClick,
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <DecisionSection
        title="Decisions"
        items={detail.decisions}
        resolveSpecRef={resolveSpecRef}
        onSpecIdClick={onSpecIdClick}
      />
      <DecisionSection
        title="Invariants"
        items={detail.invariants}
        resolveSpecRef={resolveSpecRef}
        onSpecIdClick={onSpecIdClick}
      />

      {hasFlow ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Files and paths</h3>
          <TagList
            label="Inputs"
            items={detail.inputs}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSpecIdClick}
          />
          <TagList
            label="Outputs"
            items={detail.outputs}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSpecIdClick}
          />
          <TagList
            label="Allowed paths"
            items={detail.allowedPaths}
            resolveSpecRef={resolveSpecRef}
            onSpecIdClick={onSpecIdClick}
          />
        </section>
      ) : null}

      {hasRuntime ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Lifecycle and runtime</h3>
          <div className={styles.fieldRows}>
            {detail.createdAt ? (
              <KeyValue label="Created" value={formatDate(detail.createdAt)} />
            ) : null}
            {detail.updatedAt ? (
              <KeyValue label="Updated" value={formatDate(detail.updatedAt)} />
            ) : null}
            {detail.runtime.map((field) => (
              <KeyValue
                key={field.label}
                label={field.label}
                value={field.value}
                resolveSpecRef={resolveSpecRef}
                onSpecIdClick={onSpecIdClick}
              />
            ))}
          </div>
        </section>
      ) : null}

      {detail.prompt ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Prompt</h3>
          <pre className={styles.pre}>{detail.prompt}</pre>
        </section>
      ) : null}

      {detail.rawSpecification ? (
        <details className={styles.rawDisclosure}>
          <summary>Specification raw</summary>
          <pre className={`${styles.pre} ${styles.rawPre}`}>
            {JSON.stringify(detail.rawSpecification, null, 2)}
          </pre>
        </details>
      ) : null}
    </>
  );
}

function ScopeSection({
  scope,
  resolveSpecRef,
  onSpecIdClick,
}: {
  scope: NonNullable<SpecInspectorDetailModel["scope"]>;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Scope</h3>
      <div className={styles.scopeGrid}>
        {scope.in.length > 0 ? (
          <div className={styles.scopeBlock}>
            <h4>In scope</h4>
            <ul className={styles.contentList}>
              {scope.in.map((item) => (
                <li key={item} className={styles.contentItem}>
                  <span className={styles.contentText}>
                    {renderRichInlineText(item, resolveSpecRef, onSpecIdClick)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {scope.out.length > 0 ? (
          <div className={styles.scopeBlock}>
            <h4>Out of scope</h4>
            <ul className={styles.contentList}>
              {scope.out.map((item) => (
                <li key={item} className={styles.contentItem}>
                  <span className={styles.contentText}>
                    {renderRichInlineText(item, resolveSpecRef, onSpecIdClick)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DecisionSection({
  title,
  items,
  resolveSpecRef,
  onSpecIdClick,
}: {
  title: string;
  items: SpecInspectorDetailModel["decisions"];
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <ul className={`${styles.contentList} ${styles.decisionList}`}>
        {items.map((item, index) => (
          <li
            key={`${item.id ?? item.statement}-${index}`}
            className={`${styles.contentItem} ${styles.decisionItem}`}
          >
            {item.id ? <span className={styles.idBadge}>{item.id}</span> : null}
            <span className={styles.contentText}>
              {renderRichInlineText(
                item.statement,
                resolveSpecRef,
                onSpecIdClick,
              )}
            </span>
            {item.rationale ? (
              <p className={styles.rationale}>
                {renderRichInlineText(
                  item.rationale,
                  resolveSpecRef,
                  onSpecIdClick,
                )}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TagList({
  label,
  items,
  resolveSpecRef,
  onSpecIdClick,
}: {
  label: string;
  items: readonly string[];
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className={styles.tagGroup}>
      <span className={styles.tagLabel}>{label}</span>
      <ul className={styles.tagList}>
        {items.map((item) => (
          <li key={item} className={styles.tag}>
            <SpecIdText
              text={item}
              resolveSpecRef={resolveSpecRef}
              onSpecIdClick={onSpecIdClick}
              variant="bare"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyValue({
  label,
  value,
  resolveSpecRef,
  onSpecIdClick,
}: {
  label: string;
  value: string;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
}) {
  return (
    <div className={styles.fieldRow}>
      <span>{label}</span>
      <strong>
        <SpecIdText
          text={value}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="bare"
        />
      </strong>
    </div>
  );
}

const inlineTokenPattern =
  /(`[^`]+`|\b[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)+\b|\b[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\b)/g;
const specReferenceTokenPattern =
  /^(?:[A-Za-z0-9_]+-)*SPEC-[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*$/i;

function isSpecReferenceToken(token: string): boolean {
  return specReferenceTokenPattern.test(token);
}

function renderRichInlineText(
  text: string,
  resolveSpecRef?: SpecRefResolver,
  onSpecIdClick?: (nodeId: string) => void,
): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(inlineTokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    const label =
      token.startsWith("`") && token.endsWith("`") ? token.slice(1, -1) : token;
    if (resolveSpecRef?.(label)) {
      parts.push(
        <SpecIdText
          key={`${token}-${index}`}
          text={label}
          resolveSpecRef={resolveSpecRef}
          onSpecIdClick={onSpecIdClick}
          variant="inline"
        />,
      );
      lastIndex = index + token.length;
      continue;
    }

    if (token.includes("-") && !token.startsWith("`")) {
      parts.push(
        isSpecReferenceToken(label) ? (
          <span
            key={`${token}-${index}`}
            className={styles.inlineCode}
          >
            {label}
          </span>
        ) : (
          token
        ),
      );
      lastIndex = index + token.length;
      continue;
    }

    parts.push(
      <span
        key={`${token}-${index}`}
        className={styles.inlineCode}
      >
        {label}
      </span>,
    );
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

const utcDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return utcDateFormatter.format(date);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function RelationGroup({
  group,
  selectedNodeId,
  onSelectNodeId,
}: {
  group: SpecRelationGroup;
  selectedNodeId: string;
  onSelectNodeId?: (nodeId: string) => void;
}) {
  return (
    <details className={styles.relationGroup}>
      <summary className={styles.relationSummary}>
        <span className={styles.relationLabel}>{group.label}</span>
        <span className={styles.relationCount}>{group.items.length}</span>
      </summary>
      {group.items.length === 0 ? (
        <span className={styles.empty}>None declared</span>
      ) : (
        <div className={styles.relationList}>
          {group.items.map((item) => (
            <RelationButton
              key={`${group.id}-${item.nodeId}`}
              item={item}
              selectedNodeId={selectedNodeId}
              onSelectNodeId={onSelectNodeId}
            />
          ))}
        </div>
      )}
    </details>
  );
}

function RelationButton({
  item,
  selectedNodeId,
  onSelectNodeId,
}: {
  item: SpecRelation;
  selectedNodeId: string;
  onSelectNodeId?: (nodeId: string) => void;
}) {
  const canSelect = item.status === "resolved" && item.nodeId !== selectedNodeId;
  const className =
    item.status === "broken"
      ? `${styles.relationButton} ${styles.brokenRelation}`
      : styles.relationButton;

  return (
    <button
      type="button"
      className={className}
      disabled={!canSelect}
      title={item.title ?? "Missing SpecGraph node"}
      onClick={() => onSelectNodeId?.(item.nodeId)}
    >
      {item.nodeId}
    </button>
  );
}
