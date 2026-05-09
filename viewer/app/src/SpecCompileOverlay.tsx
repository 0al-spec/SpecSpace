import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate, faCopy, faDownload, faCheck } from "@fortawesome/free-solid-svg-icons";
import PanelActions from "./PanelActions";
import "./SpecPMExportPreview.css";
import "./SpecCompileOverlay.css";

interface CompileManifest {
  root_id: string;
  node_count: number;
  max_depth_reached: number;
  nodes_included: string[];
  cycles_skipped: string[];
  missing_skipped: string[];
}

interface CompileResult {
  root_id: string;
  markdown: string;
  manifest: CompileManifest;
  load_errors: { file_name: string; message: string }[];
}

interface CompileOptions {
  depth: number;
  objective: boolean;
  acceptance: boolean;
  deps: boolean;
  prompt: boolean;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; result: CompileResult }
  | { kind: "error"; message: string };

interface Props {
  rootId: string;
  onClose: () => void;
}

const DEFAULT_OPTIONS: CompileOptions = {
  depth: 6,
  objective: true,
  acceptance: true,
  deps: true,
  prompt: false,
};

export default function SpecCompileOverlay({ rootId, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [options, setOptions] = useState<CompileOptions>(DEFAULT_OPTIONS);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const compile = useCallback(async (opts: CompileOptions) => {
    setState({ kind: "loading" });
    const params = new URLSearchParams({
      root: rootId,
      depth: String(opts.depth),
      objective: opts.objective ? "1" : "0",
      acceptance: opts.acceptance ? "1" : "0",
      deps: opts.deps ? "1" : "0",
      prompt: opts.prompt ? "1" : "0",
    });
    try {
      const res = await fetch(`/api/spec-compile?${params}`);
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        setState({ kind: "error", message: typeof body.error === "string" ? body.error : `HTTP ${res.status}` });
        return;
      }
      setState({ kind: "ok", result: body as unknown as CompileResult });
    } catch (err) {
      setState({ kind: "error", message: String(err) });
    }
  }, [rootId]);

  // Auto-compile on mount
  useEffect(() => { compile(options); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus trap
  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => { previousFocusRef.current?.focus(); };
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleOptionChange = useCallback(<K extends keyof CompileOptions>(key: K, value: CompileOptions[K]) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      compile(next);
      return next;
    });
  }, [compile]);

  const handleCopy = useCallback(async () => {
    if (state.kind !== "ok") return;
    await navigator.clipboard.writeText(state.result.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [state]);

  const handleDownload = useCallback(() => {
    if (state.kind !== "ok") return;
    const blob = new Blob([state.result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rootId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state, rootId]);

  const manifest = state.kind === "ok" ? state.result.manifest : null;

  return (
    <div className="specpm-overlay spec-compile-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="specpm-panel spec-compile-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spec-compile-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="specpm-titlebar">
          <div className="specpm-title">
            <span id="spec-compile-title" className="specpm-title-main">Compile Spec Tree</span>
            <span className="specpm-title-sub">
              {rootId}
              {manifest && ` · ${manifest.node_count} nodes · depth ${manifest.max_depth_reached}`}
            </span>
          </div>
          <PanelActions
            extra={[
              {
                icon: <FontAwesomeIcon icon={faRotate} spin={state.kind === "loading"} />,
                title: state.kind === "loading" ? "Compiling…" : "Recompile",
                onClick: state.kind === "loading" ? undefined : () => compile(options),
              },
              {
                icon: <FontAwesomeIcon icon={copied ? faCheck : faCopy} />,
                title: copied ? "Copied!" : "Copy markdown",
                onClick: state.kind === "ok" ? handleCopy : undefined,
              },
              {
                icon: <FontAwesomeIcon icon={faDownload} />,
                title: `Download ${rootId}.md`,
                onClick: state.kind === "ok" ? handleDownload : undefined,
              },
            ]}
            onClose={onClose}
          />
        </div>

        {/* Options bar */}
        <div className="spec-compile-options">
          <label className="spec-compile-option">
            <span>Depth</span>
            <select
              value={options.depth}
              onChange={(e) => handleOptionChange("depth", Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          {(["objective", "acceptance", "deps", "prompt"] as const).map((key) => (
            <label key={key} className="spec-compile-option">
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(e) => handleOptionChange(key, e.target.checked)}
              />
              <span>{{
                objective: "Objective",
                acceptance: "Acceptance",
                deps: "Deps",
                prompt: "Prompt",
              }[key]}</span>
            </label>
          ))}
        </div>

        {/* Warnings */}
        {state.kind === "ok" && (state.result.manifest.cycles_skipped.length > 0 || state.result.manifest.missing_skipped.length > 0 || state.result.load_errors.length > 0) && (
          <div className="spec-compile-warnings">
            {state.result.manifest.cycles_skipped.length > 0 && (
              <span>Cycles skipped: {state.result.manifest.cycles_skipped.join(", ")}</span>
            )}
            {state.result.manifest.missing_skipped.length > 0 && (
              <span>Missing nodes: {state.result.manifest.missing_skipped.join(", ")}</span>
            )}
            {state.result.load_errors.length > 0 && (
              <span>{state.result.load_errors.length} YAML load errors</span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="specpm-body spec-compile-body">
          {state.kind === "loading" && (
            <div className="specpm-info">Compiling {rootId}…</div>
          )}
          {state.kind === "error" && (
            <div className="specpm-build-error">
              <strong>Error:</strong>
              <pre>{state.message}</pre>
            </div>
          )}
          {state.kind === "ok" && (
            <div className="spec-compile-output">
              {state.result.markdown.split("\n").map((line, i) => (
                <div key={i} className="spec-compile-line">{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
