import { useState } from "react";
import "./BranchDialog.css";

interface BranchDialogProps {
  parentConversationId: string;
  parentMessageId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export default function BranchDialog({
  parentConversationId,
  parentMessageId,
  onCreated,
  onCancel,
}: BranchDialogProps) {
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
              conversation_id: parentConversationId,
              message_id: parentMessageId,
              link_type: "branch",
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

  return (
    <div className="branch-dialog-backdrop" onClick={onCancel}>
      <div
        className="branch-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="branch-dialog-heading">Create Branch</h3>
        <p className="branch-dialog-meta">
          From: {parentConversationId} / {parentMessageId}
        </p>

        <label className="branch-dialog-label">
          File name
          <input
            className="branch-dialog-input"
            type="text"
            placeholder="my-branch.json"
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
            placeholder="Branch title"
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
            className="branch-dialog-btn create"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Creating\u2026" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
