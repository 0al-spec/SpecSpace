const NUMERIC_SPEC_REF_PATTERN = /(?:[A-Za-z0-9_]+-)?SPEC-\d+/g;

export function proposalTraceSpecRefs(ids: readonly string[]): string[] {
  return ids.flatMap(splitAdjacentSpecRefs);
}

function splitAdjacentSpecRefs(value: string): string[] {
  const refs = [...value.matchAll(NUMERIC_SPEC_REF_PATTERN)].map(
    (match) => match[0],
  );

  if (refs.length < 2 || refs.join("") !== value) return [value];

  return refs;
}
