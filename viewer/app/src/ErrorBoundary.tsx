import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Human-readable name shown in the fallback UI (e.g. "Canvas", "Inspector"). */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.label ?? "Component";
    console.error(`[ErrorBoundary: ${label}] Uncaught error:`, error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label = this.props.label ?? "Component";
    const message = this.state.error?.message ?? "Unknown error";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          gap: 12,
          fontFamily: "Georgia, serif",
          color: "#5a4a3a",
          background: "rgba(236, 227, 212, 0.9)",
          border: "1px solid #c8b89a",
          borderRadius: 8,
          minHeight: 120,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <strong style={{ fontSize: "1rem" }}>
          {label}: Something went wrong
        </strong>
        <code
          style={{
            fontSize: "0.75rem",
            color: "#8b4513",
            maxWidth: 480,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </code>
        <button
          onClick={this.handleRetry}
          style={{
            marginTop: 4,
            padding: "6px 16px",
            fontFamily: "Georgia, serif",
            fontSize: "0.85rem",
            cursor: "pointer",
            background: "#5a7a5a",
            color: "#f0ebe3",
            border: "none",
            borderRadius: 4,
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
