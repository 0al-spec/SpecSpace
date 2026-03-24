import type { SubflowHeaderData } from "./types";
import "./SubflowHeader.css";

interface SubflowHeaderProps {
  data: SubflowHeaderData;
}

export default function SubflowHeader({ data }: SubflowHeaderProps) {
  return (
    <div className="subflow-header">
      <span className="subflow-header-title">
        {data.title} ({data.kind})
      </span>
      <button
        className="conversation-node-expand"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleExpand(data.conversationId);
        }}
        title="Collapse"
      >
        {"\u25BE"}
      </button>
    </div>
  );
}
