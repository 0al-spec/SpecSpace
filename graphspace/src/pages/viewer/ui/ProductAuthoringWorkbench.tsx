import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./OntologySemanticReviewPanel.module.css";

const views = [
  ["questions", "Questions"],
  ["update", "Update candidate"],
  ["specification", "Specification"],
  ["diagnostics", "Diagnostics"],
] as const;
export type ProductAuthoringView = (typeof views)[number][0];

export function ProductAuthoringWorkbench({
  initialView,
  children,
}: {
  initialView: ProductAuthoringView;
  children: Record<ProductAuthoringView, ReactNode>;
}) {
  const [selection, setSelection] = useState<ProductAuthoringView | null>(null);
  const instanceId = useId();
  const root = useRef<HTMLDivElement>(null);
  const activeView = selection ?? initialView;

  useEffect(() => {
    const reveal = (hash: string) => {
      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (!target || !root.current?.contains(target)) return;
      const pane = target.closest<HTMLElement>("[data-authoring-view]");
      const view = views.find(([key]) => key === pane?.dataset.authoringView)?.[0];
      if (!view) return;
      setSelection(view);
      let parent = target.parentElement;
      while (parent && parent !== root.current) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    const onHash = () => reveal(window.location.hash);
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href^='#']") : null;
      if (link) reveal(link.hash);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div ref={root} className={styles.authoringWorkbench}>
      <div role="tablist" aria-label="Specification authoring" className={styles.authoringTabs}>
        {views.map(([key, label], index) => (
          <button
            key={key}
            id={`${instanceId}-authoring-tab-${key}`}
            role="tab"
            type="button"
            aria-selected={activeView === key}
            aria-controls={`${instanceId}-authoring-pane-${key}`}
            tabIndex={activeView === key ? 0 : -1}
            onClick={() => setSelection(key)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % views.length
                : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length
                : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              const nextView = views[next][0];
              setSelection(nextView);
              document.getElementById(`${instanceId}-authoring-tab-${nextView}`)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {views.map(([key]) => (
        <div
          key={key}
          id={`${instanceId}-authoring-pane-${key}`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-authoring-tab-${key}`}
          data-authoring-view={key}
          hidden={activeView !== key}
          tabIndex={0}
        >
          {children[key]}
        </div>
      ))}
    </div>
  );
}
