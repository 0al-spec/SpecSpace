import { useState, useEffect } from "react";
import "./InspectorOverlay.css";
import BranchDialog from "./BranchDialog";
import MergeDialog from "./MergeDialog";
import type { CompileTarget } from "./types";

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
}

const kindLabels: Record<string, string> = {
  "canonical-root": "ROOT",
  "canonical-branch": "BRANCH",
  "canonical-merge": "MERGE",
  root: "ROOT",
  branch: "BRANCH",
  merge: "MERGE",
};

export default function InspectorOverlay({
  selectedConversationId,
  selectedMessageId,
  onDismiss,
  onGraphRefresh,
  compileTargetConversationId,
  compileTargetMessageId,
  onSetCompileTarget,
}: InspectorOverlayProps) {
  const [convDetail, setConvDetail] = useState<ConversationDetail | null>(null);
  const [checkpointDetail, setCheckpointDetail] =
    useState<CheckpointDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  useEffect(() => {
    if (!selectedConversationId) {
      setConvDetail(null);
      setCheckpointDetail(null);
      return;
    }

    setLoading(true);
    fetch(`/api/conversation?conversation_id=${encodeURIComponent(selectedConversationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setConvDetail(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  const visible = Boolean(selectedConversationId);
  const conv = convDetail?.conversation;

  return (
    <div className={`inspector-overlay ${visible ? "visible" : ""}`}>
      <button className="inspector-close" onClick={onDismiss} title="Close">
        {"\u2715"}
      </button>

      {loading && <div className="inspector-loading">Loading…</div>}

      {conv && (
        <>
          <div className="inspector-section-label">CONVERSATION INSPECTOR</div>
          <h2 className="inspector-title">Selection details</h2>

          <div className="inspector-meta">
            {conv.conversation_id} | {kindLabels[conv.kind] || conv.kind} |{" "}
            {conv.file_name} | {conv.checkpoint_count} checkpoints
          </div>

          <div className="inspector-section-label">LINEAGE</div>

          {/* Current conversation */}
          <div className="inspector-lineage-card">
            <div className="inspector-lineage-title">{conv.title}</div>
            <span
              className={`inspector-lineage-badge ${convDetail?.compile_target?.is_lineage_complete ? "complete" : "incomplete"}`}
            >
              {convDetail?.compile_target?.is_lineage_complete
                ? "LINEAGE COMPLETE"
                : "LINEAGE INCOMPLETE"}
            </span>
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

          <button
            className={`inspector-branch-btn inspector-compile-target-btn${compileTargetConversationId === selectedConversationId && !compileTargetMessageId ? " active" : ""}`}
            onClick={() => onSetCompileTarget(selectedConversationId, null)}
          >
            {compileTargetConversationId === selectedConversationId &&
            !compileTargetMessageId
              ? "Compile Target \u2713"
              : "Set as Compile Target"}
          </button>

          {/* Parent edges */}
          {(convDetail?.parent_edges || []).length === 0 && (
            <div className="inspector-lineage-card">
              <div className="inspector-lineage-title">No parent edges</div>
              <span className="inspector-lineage-badge">
                {kindLabels[conv.kind] || conv.kind}
              </span>
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
          <button
            className={`inspector-branch-btn inspector-compile-target-btn${compileTargetConversationId === selectedConversationId && compileTargetMessageId === checkpointDetail.checkpoint.message_id ? " active" : ""}`}
            onClick={() =>
              onSetCompileTarget(
                selectedConversationId,
                checkpointDetail.checkpoint.message_id,
              )
            }
          >
            {compileTargetConversationId === selectedConversationId &&
            compileTargetMessageId === checkpointDetail.checkpoint.message_id
              ? "Compile Target \u2713"
              : "Set as Compile Target"}
          </button>
          <button
            className="inspector-branch-btn"
            onClick={() => setShowBranchDialog(true)}
          >
            Create Branch
          </button>
          <button
            className="inspector-branch-btn inspector-merge-btn"
            onClick={() => setShowMergeDialog(true)}
          >
            Create Merge
          </button>
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
