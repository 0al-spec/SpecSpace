import "./KindBadge.css";

const kindColors: Record<string, string> = {
  "canonical-root":   "root",
  "canonical-branch": "branch",
  "canonical-merge":  "merge",
  root:    "root",
  branch:  "branch",
  merge:   "merge",
  invalid: "broken",
};

const kindLabels: Record<string, string> = {
  "canonical-root":   "ROOT",
  "canonical-branch": "BRANCH",
  "canonical-merge":  "MERGE",
  root:    "ROOT",
  branch:  "BRANCH",
  merge:   "MERGE",
  invalid: "INVALID",
};

interface KindBadgeProps {
  kind: string;
  className?: string;
}

export default function KindBadge({ kind, className }: KindBadgeProps) {
  const color = kindColors[kind] || "";
  const label = kindLabels[kind] || kind.toUpperCase();
  return (
    <span className={`kind-badge${color ? ` kind-badge-${color}` : ""}${className ? ` ${className}` : ""}`}>
      {label}
    </span>
  );
}
