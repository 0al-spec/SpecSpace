import type { ReactNode } from "react";

/**
 * Splits a string on `backtick` pairs and returns React nodes:
 * plain text segments interleaved with styled <code> elements.
 *
 * Pass onRefClick to make the chips interactive when a resolver is ready.
 */
export function renderInlineText(
  text: string,
  onRefClick?: (ref: string) => void,
): ReactNode {
  const parts = text.split(/`([^`]+)`/);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (i % 2 === 0) return part || null;
    return (
      <code
        key={i}
        className={`spec-inline-ref${onRefClick ? " spec-inline-ref--clickable" : ""}`}
        onClick={onRefClick ? (e) => { e.stopPropagation(); onRefClick(part); } : undefined}
        title={onRefClick ? `Look up "${part}"` : undefined}
      >
        {part}
      </code>
    );
  });
}
