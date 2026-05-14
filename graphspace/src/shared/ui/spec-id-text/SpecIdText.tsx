import type { MouseEvent, ReactNode } from "react";
import styles from "./SpecIdText.module.css";

export type SpecIdTextVariant = "inline" | "bare" | "chip";

export type SpecIdTextPart =
  | { kind: "text"; value: string }
  | { kind: "spec-id"; value: string; nodeId: string };

const SPEC_ID_PATTERN = /\b(?:SG-)?SPEC-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;
const SPEC_ID_EXACT_PATTERN = /^(?:SG-)?SPEC-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export function isSpecIdToken(value: string): boolean {
  return SPEC_ID_EXACT_PATTERN.test(value);
}

export function normalizeSpecId(value: string): string {
  return value.startsWith("SG-") ? value : `SG-${value}`;
}

export function splitSpecIdText(text: string): SpecIdTextPart[] {
  const parts: SpecIdTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SPEC_ID_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, index) });
    }

    parts.push({ kind: "spec-id", value, nodeId: normalizeSpecId(value) });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ kind: "text", value: text }];
}

type Props = {
  text: string;
  onSpecIdClick?: (nodeId: string) => void;
  variant?: SpecIdTextVariant;
  specClassName?: string;
};

export function SpecIdText({
  text,
  onSpecIdClick,
  variant = "inline",
  specClassName,
}: Props) {
  const parts = splitSpecIdText(text);

  return (
    <>
      {parts.map((part, index) =>
        part.kind === "spec-id" ? (
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
  onSpecIdClick?: (nodeId: string) => void,
  variant?: SpecIdTextVariant,
): ReactNode {
  return (
    <SpecIdText
      text={text}
      onSpecIdClick={onSpecIdClick}
      variant={variant}
    />
  );
}
