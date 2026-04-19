import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import type { Node } from "@xyflow/react";
import type { ConversationNodeData, GraphMode } from "./types";
import type { SpecNodeData } from "./SpecNode";
import "./SearchPalette.css";

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeClass: string;
  itemType: "conversation" | "spec";
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  graphMode: GraphMode;
  nodes: Node[];
  onSelectConversation: (conversationId: string) => void;
  onSelectSpec: (nodeId: string) => void;
  onMatchingIdsChange?: (ids: Set<string> | null) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase().trim();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchPalette({
  open,
  onClose,
  graphMode,
  nodes,
  onSelectConversation,
  onSelectSpec,
  onMatchingIdsChange,
}: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Extract searchable items from nodes
  const searchItems = useMemo(() => {
    const items: SearchItem[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      if (graphMode === "conversations") {
        if (node.type === "conversation" || node.type === "group") {
          const d = node.data as ConversationNodeData;
          if (seen.has(d.conversationId)) continue;
          seen.add(d.conversationId);
          items.push({
            id: d.conversationId,
            title: d.title,
            subtitle: d.fileName,
            badge: d.kind.toUpperCase(),
            badgeClass: d.kind,
            itemType: "conversation",
          });
        }
      } else {
        if (node.type === "spec") {
          const d = node.data as SpecNodeData;
          if (seen.has(d.nodeId)) continue;
          seen.add(d.nodeId);
          items.push({
            id: d.nodeId,
            title: d.title,
            subtitle: d.nodeId,
            badge: d.status.toUpperCase(),
            badgeClass: "spec",
            itemType: "spec",
          });
        }
      }
    }
    return items;
  }, [nodes, graphMode]);

  // Filter by query
  const filteredResults = useMemo(() => {
    if (!query.trim()) return searchItems.slice(0, 50);
    const q = query.toLowerCase().trim();
    return searchItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [searchItems, query]);

  // Notify parent of matching node IDs for graph highlighting
  useEffect(() => {
    if (!onMatchingIdsChange) return;
    if (!open) { onMatchingIdsChange(null); return; }
    if (!query.trim()) { onMatchingIdsChange(null); return; }
    onMatchingIdsChange(new Set(filteredResults.map((r) => r.id)));
  }, [open, query, filteredResults, onMatchingIdsChange]);

  // Select an item
  const selectItem = useCallback(
    (item: SearchItem) => {
      if (item.itemType === "conversation") {
        onSelectConversation(item.id);
      } else {
        onSelectSpec(item.id);
      }
    },
    [onSelectConversation, onSelectSpec],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < filteredResults.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : filteredResults.length - 1,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredResults.length) {
          selectItem(filteredResults[activeIndex]);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeIndex, filteredResults, selectItem, onClose]);

  // Auto-scroll active item into view
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Clamp activeIndex when results change
  useEffect(() => {
    setActiveIndex((prev) =>
      prev >= filteredResults.length ? 0 : prev,
    );
  }, [filteredResults.length]);

  if (!open) return null;

  const placeholder =
    graphMode === "conversations"
      ? "Search conversations…"
      : "Search specs…";

  return (
    <div className="search-palette-backdrop" onClick={onClose}>
      <div
        className="search-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-palette-input-wrap">
          <span className="search-palette-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
          <input
            ref={inputRef}
            className="search-palette-input"
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
          <span className="search-palette-shortcut">ESC</span>
        </div>
        <div className="search-palette-results">
          {filteredResults.length === 0 && query.trim() && (
            <div className="search-palette-empty">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {filteredResults.map((item, idx) => (
            <div
              key={item.id}
              className={`search-palette-item${idx === activeIndex ? " active" : ""}`}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(idx)}
              ref={idx === activeIndex ? activeItemRef : undefined}
            >
              <div className="search-palette-item-info">
                <div className="search-palette-item-title">
                  {highlightMatch(item.title, query)}
                </div>
                <div className="search-palette-item-subtitle">
                  {highlightMatch(item.subtitle, query)}
                </div>
              </div>
              <span className={`search-palette-badge ${item.badgeClass}`}>
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
