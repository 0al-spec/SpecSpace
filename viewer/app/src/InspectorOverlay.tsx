import { useState, useEffect, useCallback } from "react";
import "./InspectorOverlay.css";
import KindBadge from "./KindBadge";
import ActionBtn from "./ActionBtn";
import PanelBtn from "./PanelBtn";
import { useToast } from "./Toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import BranchDialog from "./BranchDialog";
import MergeDialog from "./MergeDialog";
import type { CompileTarget, CompileResult } from "./types";

interface ConversationDetail {
  conversation: {
    conversation_id: string;
    file_name: string;
    kind: string;
    title: string;
    checkpoint_count: number;
    checkpoints: CheckpointEntry[];
  };
  parent_edges: EdgeEntry[];
  child_edges: EdgeEntry[];
  compile_target: CompileTarget;
}

interface CheckpointEntry {
  message_id: string;
  index: number;
  role: string;
  content: string;
  child_edge_ids: string[];
}

interface EdgeEntry {
  edge_id: string;
  link_type: string;
  parent_conversation_id: string;
  parent_file_name: string | null;
  parent_message_id: string;
  child_conversation_id: string;
  child_file_name: string;
  status: string;
}

interface CheckpointDetail {
  checkpoint: CheckpointEntry;
  child_edges: EdgeEntry[];
  conversation: {
    conversation_id: string;
    title: string;
  };
  compile_target?: CompileTarget;
}

interface InspectorOverlayProps {
  selectedConversationId: string | null;
  selectedMessageId: string | null;
  onDismiss: () => void;
  onGraphRefresh: () => void;
  compileTargetConversationId: string | null;
  compileTargetMessageId: string | null;
  onSetCompileTarget: (convId: string | null, msgId: string | null) => void;
  /** Whether the Hyperprompt binary is available server-side. Default: true. */
  compileAvailable?: boolean;
}

export default function InspectorOverlay({
  selectedConversationId,
  selectedMessageId,
  onDismiss,
  onGraphRefresh,
  compileTargetConversationId,
  compileTargetMessageId,
  onSetCompileTarget,
  compileAvailable = true,
}: InspectorOverlayProps) {
  const { showToast } = useToast();
  const [convDetail, setConvDetail] = useState<ConversationDetail | null>(null);
  const [checkpointDetail, setCheckpointDetail] =
    useState<CheckpointDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);

  useEffect(() => {
    if (!selectedConversationId) {
      setConvDetail(null);
      setCheckpointDetail(null);
      setConvError(null);
      return;
    }

    setLoading(true);
    setConvError(null);
    fetch(`/api/conversation?conversation_id=${encodeURIComponent(selectedConversationId)}`)
      .then((r) => {
        if (r.ok) return r.json();
        setConvError(`Conversation not found (${r.status})`);
        return null;
      })
      .then((data) => {
        setConvDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        setConvError(`Failed to load conversation: ${err.message ?? err}`);
        setLoading(false);
      });
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !selectedMessageId) {
      setCheckpointDetail(null);
      return;
    }

    fetch(
      `/api/checkpoint?conversation_id=${encodeURIComponent(selectedConversationId)}&message_id=${encodeURIComponent(selectedMessageId)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCheckpointDetail(data))
      .catch(() => {});
  }, [selectedConversationId, selectedMessageId]);

  // Reset compile result when the active compile target changes.
  useEffect(() => {
    setCompileResult(null);
  }, [compileTargetConversationId, compileTargetMessageId]);

  const handleCompile = useCallback(async () => {
    if (!compileTargetConversationId || compiling) return;
    setCompiling(true);
    setCompileResult(null);
    try {
      const body: Record<string, string> = { conversation_id: compileTargetConversationId };
      if (compileTargetMessageId) body.message_id = compileTargetMessageId;
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const compilePayload = data.compile ?? data;
      if (res.ok && compilePayload.exit_code === 0) {
        setCompileResult({
          status: "ok",
          compiled_md: compilePayload.compiled_md,
          manifest_json: compilePayload.manifest_json,
          provenance_json: compilePayload.provenance_json,
          provenance_md: compilePayload.provenance_md,
          exit_code: 0,
          stdout: compilePayload.stdout ?? "",
          stderr: compilePayload.stderr ?? "",
        });
      } else {
        setCompileResult({
          status: "error",
          error: compilePayload.error ?? "Compile failed",
          details: compilePayload.details,
          exit_code: compilePayload.exit_code ?? null,
          stderr: compilePayload.stderr ?? "",
          stdout: compilePayload.stdout ?? "",
        });
      }
    } catch (err) {
      setCompileResult({
        status: "error",
        error: String(err),
        exit_code: null,
      });
    } finally {
      setCompiling(false);
    }
  }, [compileTargetConversationId, compileTargetMessageId, compiling]);

  const visible = Boolean(selectedConversationId);
  const conv = convDetail?.conversation;

  // Keep CSS variable in sync so minimap can anchor to the inspector's left edge
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--conv-inspector-width", visible ? "420px" : "0px");
    return () => root.style.setProperty("--conv-inspector-width", "0px");
  }, [visible]);

  return (
    <div className={`inspector-overlay ${visible ? "visible" : ""}`}>
      <button className="inspector-close" onClick={onDismiss} title="Close">
        <FontAwesomeIcon icon={faXmark} />
      </button>

      {loading && <div className="inspector-loading">Loading…</div>}

      {!loading && convError && (
        <div className="inspector-section-label">CONVERSATION INSPECTOR</div>
      )}
      {!loading && convError && (
        <div className="inspector-meta">{convError}</div>
      )}

      {conv && (
        <>
          <div className="inspector-section-label">CONVERSATION INSPECTOR</div>

          <div className="inspector-section-label">LINEAGE</div>

          {/* Current conversation */}
          <div className="inspector-lineage-card">
            <div className="inspector-lineage-title">{conv.title}</div>
            <div className="inspector-lineage-card-meta">
              <KindBadge kind={conv.kind} />
              <span className="inspector-lineage-badge">{conv.checkpoint_count} checkpoints</span>
              <span
                className={`inspector-lineage-badge ${convDetail?.compile_target?.is_lineage_complete ? "complete" : "incomplete"}`}
              >
                {convDetail?.compile_target?.is_lineage_complete
                  ? "LINEAGE COMPLETE"
                  : "LINEAGE INCOMPLETE"}
              </span>
            </div>
            {compileTargetConversationId === selectedConversationId &&
              !compileTargetMessageId && (
                <span className="inspector-lineage-badge inspector-compile-target-active">
                  ACTIVE COMPILE TARGET
                </span>
              )}
            <div className="inspector-lineage-meta">
              Source file: {conv.file_name}
            </div>
            {convDetail?.compile_target?.export_dir && (
              <div className="inspector-lineage-meta">
                Export: <code>{convDetail.compile_target.export_dir}</code>
              </div>
            )}
          </div>

          <ActionBtn
            variant="compile"
            active={compileTargetConversationId === selectedConversationId && !compileTargetMessageId}
            onClick={() => onSetCompileTarget(selectedConversationId, null)}
          >
            {compileTargetConversationId === selectedConversationId && !compileTargetMessageId
              ? "Compile Target ✓"
              : "Set as Compile Target"}
          </ActionBtn>

          {/* Parent edges */}
          {(convDetail?.parent_edges || []).length === 0 && (
            <div className="inspector-lineage-card">
              <div className="inspector-lineage-title">No parent edges</div>
              <div className="inspector-lineage-meta">
                Root conversation in the current graph snapshot
              </div>
            </div>
          )}

          {(convDetail?.parent_edges || []).map((edge) => (
            <div key={edge.edge_id} className="inspector-lineage-card">
              <div className="inspector-lineage-title">
                {edge.parent_conversation_id}
              </div>
              <span
                className={`inspector-lineage-badge ${edge.status === "resolved" ? "complete" : "broken"}`}
              >
                {edge.status.toUpperCase()}
              </span>
              <div className="inspector-lineage-meta">
                {edge.link_type} from {edge.parent_message_id}
              </div>
              {edge.parent_file_name && (
                <div className="inspector-lineage-meta">
                  Parent file: {edge.parent_file_name}
                </div>
              )}
            </div>
          ))}

          {/* Child edges */}
          {(convDetail?.child_edges || []).map((edge) => (
            <div key={edge.edge_id} className="inspector-lineage-card">
              <div className="inspector-lineage-title">
                {edge.child_conversation_id}
              </div>
              <span
                className={`inspector-lineage-badge ${edge.status === "resolved" ? "complete" : "broken"}`}
              >
                {edge.status.toUpperCase()}
              </span>
              <div className="inspector-lineage-meta">
                {edge.link_type} child from {edge.parent_message_id}
              </div>
              <div className="inspector-lineage-meta">
                Child file: {edge.child_file_name}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Checkpoint detail */}
      {checkpointDetail?.checkpoint && (
        <>
          <div className="inspector-divider" />
          <div className="inspector-section-label">CHECKPOINT INSPECTOR</div>
          <div className="inspector-checkpoint-header">
            {checkpointDetail.checkpoint.index + 1}.{" "}
            {checkpointDetail.checkpoint.role.toUpperCase()} |{" "}
            {checkpointDetail.checkpoint.message_id}
          </div>
          <div className="inspector-checkpoint-content">
            <PanelBtn
              icon={<FontAwesomeIcon icon={faCopy} />}
              title="Copy message text"
              onClick={() => {
                showToast("Message copied");
                navigator.clipboard?.writeText(checkpointDetail.checkpoint.content).catch(() => {});
              }}
              className="inspector-checkpoint-copy"
            />
            {checkpointDetail.checkpoint.content}
          </div>
          {checkpointDetail.child_edges.length > 0 && (
            <div className="inspector-checkpoint-children">
              <div className="inspector-section-label">CHILD EDGES</div>
              {checkpointDetail.child_edges.map((edge) => (
                <div key={edge.edge_id} className="inspector-lineage-card">
                  <div className="inspector-lineage-title">
                    {edge.child_conversation_id}
                  </div>
                  <span className="inspector-lineage-badge">
                    {edge.link_type.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {checkpointDetail.compile_target && (
            <>
              {compileTargetConversationId === selectedConversationId &&
                compileTargetMessageId === checkpointDetail.checkpoint.message_id && (
                  <span className="inspector-lineage-badge inspector-compile-target-active" style={{ display: "inline-block", marginBottom: 8 }}>
                    ACTIVE COMPILE TARGET
                  </span>
                )}
            </>
          )}
          <ActionBtn
            variant="compile"
            active={compileTargetConversationId === selectedConversationId && compileTargetMessageId === checkpointDetail.checkpoint.message_id}
            onClick={() => onSetCompileTarget(selectedConversationId, checkpointDetail.checkpoint.message_id)}
          >
            {compileTargetConversationId === selectedConversationId && compileTargetMessageId === checkpointDetail.checkpoint.message_id
              ? "Compile Target ✓"
              : "Set as Compile Target"}
          </ActionBtn>
          <ActionBtn variant="branch" onClick={() => setShowBranchDialog(true)}>
            Create Branch
          </ActionBtn>
          <ActionBtn variant="merge" onClick={() => setShowMergeDialog(true)}>
            Create Merge
          </ActionBtn>
        </>
      )}

      {compileTargetConversationId && (
        <>
          <div className="inspector-divider" />
          <div className="inspector-section-label">COMPILE</div>
          <div className="inspector-compile-target-summary">
            <span className="inspector-compile-target-id">{compileTargetConversationId}</span>
            {compileTargetMessageId && (
              <span className="inspector-compile-target-msg"> @ {compileTargetMessageId}</span>
            )}
          </div>
          <ActionBtn
            variant="compile"
            disabled={compiling || !compileAvailable}
            onClick={handleCompile}
          >
            {compiling ? "Compiling…" : "Compile"}
          </ActionBtn>
          {!compileAvailable && (
            <div className="inspector-compile-unavailable">
              Hyperprompt binary not found. Start the server with{" "}
              <code>--hyperprompt-binary</code> pointing to a valid binary.
            </div>
          )}

          {compileResult && (
            <div className={`inspector-compile-result ${compileResult.status === "ok" ? "inspector-compile-ok" : "inspector-compile-error"}`}>
              {compileResult.status === "ok" ? (
                <>
                  <div className="inspector-compile-result-label">COMPILE RESULT</div>
                  <div className="inspector-compile-exit">Exit code: {compileResult.exit_code}</div>
                  <div className="inspector-compile-artifact">
                    <span className="inspector-compile-artifact-name">compiled.md</span>
                    <button
                      className="inspector-copy-btn"
                      onClick={() => navigator.clipboard?.writeText(compileResult.compiled_md)}
                      title="Copy path"
                    >
                      copy
                    </button>
                    <div className="inspector-compile-path">{compileResult.compiled_md}</div>
                  </div>
                  <div className="inspector-compile-artifact">
                    <span className="inspector-compile-artifact-name">manifest.json</span>
                    <button
                      className="inspector-copy-btn"
                      onClick={() => navigator.clipboard?.writeText(compileResult.manifest_json)}
                      title="Copy path"
                    >
                      copy
                    </button>
                    <div className="inspector-compile-path">{compileResult.manifest_json}</div>
                  </div>
                  {compileResult.provenance_json && (
                    <div className="inspector-compile-artifact">
                      <span className="inspector-compile-artifact-name">provenance.json</span>
                      <button
                        className="inspector-copy-btn"
                        onClick={() => navigator.clipboard?.writeText(compileResult.provenance_json ?? "")}
                        title="Copy path"
                      >
                        copy
                      </button>
                      <div className="inspector-compile-path">{compileResult.provenance_json}</div>
                    </div>
                  )}
                  {compileResult.provenance_md && (
                    <div className="inspector-compile-artifact">
                      <span className="inspector-compile-artifact-name">provenance.md</span>
                      <button
                        className="inspector-copy-btn"
                        onClick={() => navigator.clipboard?.writeText(compileResult.provenance_md ?? "")}
                        title="Copy path"
                      >
                        copy
                      </button>
                      <div className="inspector-compile-path">{compileResult.provenance_md}</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="inspector-compile-result-label">
                    COMPILE ERROR{compileResult.exit_code != null ? ` \u2014 Exit code: ${compileResult.exit_code}` : ""}
                  </div>
                  <div className="inspector-compile-error-msg">{compileResult.error}</div>
                  {compileResult.details && (
                    <div className="inspector-compile-error-detail">{compileResult.details}</div>
                  )}
                  {compileResult.stderr && (
                    <pre className="inspector-compile-stderr">{compileResult.stderr}</pre>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {showBranchDialog && selectedConversationId && selectedMessageId && (
        <BranchDialog
          parentConversationId={selectedConversationId}
          parentMessageId={selectedMessageId}
          onCreated={() => {
            setShowBranchDialog(false);
            onGraphRefresh();
          }}
          onCancel={() => setShowBranchDialog(false)}
        />
      )}

      {showMergeDialog && selectedConversationId && selectedMessageId && (
        <MergeDialog
          parent1ConversationId={selectedConversationId}
          parent1MessageId={selectedMessageId}
          onCreated={() => {
            setShowMergeDialog(false);
            onGraphRefresh();
          }}
          onCancel={() => setShowMergeDialog(false)}
        />
      )}
    </div>
  );
}
