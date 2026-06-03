import type { MouseEvent, ReactNode } from "react";
import styles from "./SpecIdText.module.css";

export type SpecIdTextVariant = "inline" | "bare" | "chip";
export type SpecRefResolver = (token: string) => string | null;

export type SpecIdTextPart =
  | { kind: "text"; value: string }
  | { kind: "spec-ref"; value: string; nodeId: string };

const REF_TOKEN_PATTERN = /[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)+/g;
const ADJACENT_SPEC_REF_PATTERN = /(?:[A-Za-z0-9_]+-)?SPEC-\d+/g;

function pushText(parts: SpecIdTextPart[], value: string) {
  if (!value) return;
  const previous = parts.at(-1);
  if (previous?.kind === "text") {
    previous.value += value;
    return;
  }
  parts.push({ kind: "text", value });
}

export function splitSpecIdText(
  text: string,
  resolveSpecRef?: SpecRefResolver,
): SpecIdTextPart[] {
  const parts: SpecIdTextPart[] = [];
  let lastIndex = 0;

  if (!resolveSpecRef) return [{ kind: "text", value: text }];

  for (const match of text.matchAll(REF_TOKEN_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;
    const nodeId = resolveSpecRef(value);

    if (!nodeId) {
      const adjacentParts = splitAdjacentSpecRefText(value, resolveSpecRef);
      if (adjacentParts.some((part) => part.kind === "spec-ref")) {
        pushText(parts, text.slice(lastIndex, index));
        pushParts(parts, adjacentParts);
        lastIndex = index + value.length;
      }
      continue;
    }

    pushText(parts, text.slice(lastIndex, index));
    parts.push({ kind: "spec-ref", value, nodeId });
    lastIndex = index + value.length;
  }

  pushText(parts, text.slice(lastIndex));

  return parts.length > 0 ? parts : [{ kind: "text", value: text }];
}

function pushParts(parts: SpecIdTextPart[], nextParts: readonly SpecIdTextPart[]) {
  for (const part of nextParts) {
    if (part.kind === "text") {
      pushText(parts, part.value);
      continue;
    }
    parts.push(part);
  }
}

function splitAdjacentSpecRefText(
  text: string,
  resolveSpecRef: SpecRefResolver,
): SpecIdTextPart[] {
  const parts: SpecIdTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(ADJACENT_SPEC_REF_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;
    const nodeId = resolveSpecRef(value);

    if (!nodeId) continue;

    pushText(parts, text.slice(lastIndex, index));
    parts.push({ kind: "spec-ref", value, nodeId });
    lastIndex = index + value.length;
  }

  pushText(parts, text.slice(lastIndex));

  return parts.length > 0 ? parts : [{ kind: "text", value: text }];
}

type Props = {
  text: string;
  resolveSpecRef?: SpecRefResolver;
  onSpecIdClick?: (nodeId: string) => void;
  variant?: SpecIdTextVariant;
  specClassName?: string;
};

export function SpecIdText({
  text,
  resolveSpecRef,
  onSpecIdClick,
  variant = "inline",
  specClassName,
}: Props) {
  const parts = splitSpecIdText(text, resolveSpecRef);

  return (
    <>
      {parts.map((part, index) =>
        part.kind === "spec-ref" ? (
          <SpecIdToken
            key={`${part.value}-${index}`}
            value={part.value}
            nodeId={part.nodeId}
            onSpecIdClick={onSpecIdClick}
            variant={variant}
            className={specClassName}
          />
        ) : (
          part.value
        ),
      )}
    </>
  );
}

function SpecIdToken({
  value,
  nodeId,
  onSpecIdClick,
  variant,
  className,
}: {
  value: string;
  nodeId: string;
  onSpecIdClick?: (nodeId: string) => void;
  variant: SpecIdTextVariant;
  className?: string;
}) {
  const cls = [
    styles.specId,
    styles[variant],
    onSpecIdClick ? styles.clickable : "",
    onSpecIdClick ? styles.button : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!onSpecIdClick) {
    return <span className={cls}>{value}</span>;
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSpecIdClick(nodeId);
  };

  return (
    <button
      type="button"
      className={cls}
      title={`Select ${nodeId}`}
      onClick={handleClick}
    >
      {value}
    </button>
  );
}

export function renderSpecIdText(
  text: string,
  resolveSpecRef?: SpecRefResolver,
  onSpecIdClick?: (nodeId: string) => void,
  variant?: SpecIdTextVariant,
): ReactNode {
  return (
    <SpecIdText
      text={text}
      resolveSpecRef={resolveSpecRef}
      onSpecIdClick={onSpecIdClick}
      variant={variant}
    />
  );
}
