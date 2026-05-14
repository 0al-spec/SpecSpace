import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

export default function FitViewShortcut() {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === "f" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        fitView({ duration: 300 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitView]);

  return null;
}
