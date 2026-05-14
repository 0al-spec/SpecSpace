import ErrorBoundary from "./ErrorBoundary";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./theme.css";
import "./ConversationNode.css";
import "./MessageNode.css";
import "./SpecNode.css";
import { ToastProvider } from "./Toast";
import AppShell from "./AppShell";
import { useViewerAppController } from "./useViewerAppController";

function AppInner() {
  const controller = useViewerAppController();
  return <AppShell controller={controller} />;
}

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary label="App">
        <ReactFlowProvider>
          <AppInner />
        </ReactFlowProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}
