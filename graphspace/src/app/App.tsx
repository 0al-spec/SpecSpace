import { useEffect, useMemo } from "react";
import { ViewerPage, resolveWorkspaceRoute } from "@/pages/viewer";

export function App() {
  const route = useMemo(
    () => resolveWorkspaceRoute(window.location.pathname),
    [],
  );

  useEffect(() => {
    if (!route.shouldReplace) return;
    window.history.replaceState(null, "", route.canonicalPath);
  }, [route]);

  return <ViewerPage workspace={route.workspace} />;
}
