import { useState, useEffect } from "react";
import "./BranchDialog.css";
import "./MergeDialog.css";

interface GraphNode {
  conversation_id: string;
  title: string;
}

interface Message {
  message_id: string;
  role: string;
  content: string;
}

interface MergeDialogProps {
  parent1ConversationId: string;
  parent1MessageId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export default function MergeDialog({
  parent1ConversationId,
  parent1MessageId,
  onCreated,
  onCancel,
}: MergeDialogProps) {
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [parent2ConversationId, setParent2ConversationId] = useState("");
  const [parent2Messages, setParent2Messages] = useState<Message[]>([]);
  const [parent2MessageId, setParent2MessageId] = useState("");

  // Fetch graph nodes to populate the second parent conversation dropdown
  useEffect(() => {
    fetch("/api/graph")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const nodes: GraphNode[] = (data.graph?.nodes || []).map(
          (n: { conversation_id: string; title: string }) => ({
            conversation_id: n.conversation_id,
            title: n.title,
          }),
        );
        setAllNodes(nodes);
      })
      .catch(() => {});
  }, []);

  // When second parent conversation changes, fetch its messages
  useEffect(() => {
    if (!parent2ConversationId) {
      setParent2Messages([]);
      setParent2MessageId("");
      return;
    }
    fetch(`/api/conversation?conversation_id=${encodeURIComponent(parent2ConversationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const msgs: Message[] = (data.conversation?.checkpoints || []).map(
          (cp: { message_id: string; role: string; content: string }) => ({
            message_id: cp.message_id,
            role: cp.role,
            content: cp.content,
          }),
        );
        setParent2Messages(msgs);
        setParent2MessageId(msgs.length > 0 ? msgs[msgs.length - 1].message_id : "");
      })
      .catch(() => {});
  }, [parent2ConversationId]);

  const handleSubmit = async () => {
    setError(null);

    const trimmedName = fileName.trim();
    const trimmedTitle = title.trim();

    if (!trimmedName) {
      setError("File name is required.");
      return;
    }
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!parent2ConversationId) {
      setError("A second parent conversation is required.");
      return;
    }
    if (!parent2MessageId) {
      setError("A second parent checkpoint is required.");
      return;
    }

    const fullName = trimmedName.endsWith(".json")
      ? trimmedName
      : `${trimmedName}.json`;

    const conversationId = `conv-${trimmedName.replace(/\.json$/, "").replace(/[^a-zA-Z0-9-]/g, "-")}`;

    const payload = {
      name: fullName,
      data: {
        conversation_id: conversationId,
        title: trimmedTitle,
        messages: [],
        lineage: {
          parents: [
            {
              conversation_id: parent1ConversationId,
              message_id: parent1MessageId,
              link_type: "merge",
            },
            {
              conversation_id: parent2ConversationId,
              message_id: parent2MessageId,
              link_type: "merge",
            },
          ],
        },
      },
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const messages = (data.errors || []).map(
          (e: { message: string }) => e.message,
        );
        setError(messages.join("; ") || data.error || "Creation failed.");
        return;
      }
      onCreated();
    } catch {
      setError("Network error. Could not reach server.");
    } finally {
      setSubmitting(false);
    }
  };

  const otherNodes = allNodes.filter(
    (n) => n.conversation_id !== parent1ConversationId,
  );

  return (
    <div className="branch-dialog-backdrop" onClick={onCancel}>
      <div className="branch-dialog merge-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="branch-dialog-heading">Create Merge</h3>

        <p className="branch-dialog-meta">
          Parent 1: {parent1ConversationId} / {parent1MessageId}
        </p>

        <label className="branch-dialog-label">
          Parent 2 — conversation
          <select
            className="branch-dialog-input merge-dialog-select"
            value={parent2ConversationId}
            onChange={(e) => setParent2ConversationId(e.target.value)}
            disabled={submitting}
          >
            <option value="">— select conversation —</option>
            {otherNodes.map((n) => (
              <option key={n.conversation_id} value={n.conversation_id}>
                {n.title || n.conversation_id}
              </option>
            ))}
          </select>
        </label>

        {parent2Messages.length > 0 && (
          <label className="branch-dialog-label">
            Parent 2 — checkpoint
            <select
              className="branch-dialog-input merge-dialog-select"
              value={parent2MessageId}
              onChange={(e) => setParent2MessageId(e.target.value)}
              disabled={submitting}
            >
              {parent2Messages.map((m, i) => (
                <option key={m.message_id} value={m.message_id}>
                  {i + 1}. {m.role.toUpperCase()} — {m.message_id}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="branch-dialog-label">
          File name
          <input
            className="branch-dialog-input"
            type="text"
            placeholder="my-merge.json"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </label>

        <label className="branch-dialog-label">
          Title
          <input
            className="branch-dialog-input"
            type="text"
            placeholder="Merge title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </label>

        {error && <div className="branch-dialog-error">{error}</div>}

        <div className="branch-dialog-actions">
          <button
            className="branch-dialog-btn cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="branch-dialog-btn create merge-create-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Creating\u2026" : "Create Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
