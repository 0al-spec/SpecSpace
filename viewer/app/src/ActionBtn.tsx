import "./ActionBtn.css";

export type ActionBtnVariant = "compile" | "branch" | "merge";

interface ActionBtnProps {
  variant?: ActionBtnVariant;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export default function ActionBtn({
  variant = "branch",
  active = false,
  disabled = false,
  onClick,
  children,
}: ActionBtnProps) {
  return (
    <button
      className={`action-btn action-btn-${variant}${active ? " action-btn-active" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
