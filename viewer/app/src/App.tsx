import ErrorBoundary from "./ErrorBoundary";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./theme.css";
import "./ConversationNode.css";
import "./MessageNode.css";
import "./SpecNode.css";
import "./ProductWorkspacePage.css";
import { ToastProvider } from "./Toast";
import AppShell from "./AppShell";
import ProductWorkspacePage from "./ProductWorkspacePage";
import { useViewerAppController } from "./useViewerAppController";

function productWorkspaceSlugFromPath(pathname: string): string | null {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (!trimmed || trimmed === "index.html") {
    return null;
  }
  if (trimmed.includes("/")) {
    return null;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(trimmed)) {
    return null;
  }
  return decodeURIComponent(trimmed);
}

function LegacyAppShell() {
  const controller = useViewerAppController();
  return <AppShell controller={controller} />;
}

function AppInner() {
  const workspaceId = productWorkspaceSlugFromPath(window.location.pathname);
  if (workspaceId) {
    return <ProductWorkspacePage workspaceId={workspaceId} />;
  }
  return <LegacyAppShell />;
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
