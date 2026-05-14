import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { GraphMode } from "./types";

interface UseKeyboardShortcutsOptions {
  graphMode: GraphMode;
  recentMultiSelectIds: Set<string> | null;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setRecentMultiSelectIds: Dispatch<SetStateAction<Set<string> | null>>;
  onSpecNavBack: () => void;
  onSpecNavForward: () => void;
  toggleRecent: () => void;
  toggleTimeline: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(element?.isContentEditable);
}

function isEscapeProtectedTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || Boolean(element?.isContentEditable);
}

export function useKeyboardShortcuts({
  graphMode,
  recentMultiSelectIds,
  setSearchOpen,
  setRecentMultiSelectIds,
  onSpecNavBack,
  onSpecNavForward,
  toggleRecent,
  toggleTimeline,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  useEffect(() => {
    if (!recentMultiSelectIds || recentMultiSelectIds.size === 0) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isEscapeProtectedTarget(event.target)) return;
      setRecentMultiSelectIds(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [recentMultiSelectIds, setRecentMultiSelectIds]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey || graphMode !== "specifications") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSpecNavBack();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSpecNavForward();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [graphMode, onSpecNavBack, onSpecNavForward]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (graphMode !== "specifications") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "r") {
        event.preventDefault();
        toggleRecent();
        return;
      }
      if (key === "t") {
        event.preventDefault();
        toggleTimeline();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [graphMode, toggleRecent, toggleTimeline]);
}
