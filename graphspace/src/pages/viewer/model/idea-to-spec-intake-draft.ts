import type { IdeaToSpecActiveFrame } from "./use-idea-to-spec-workspace";

export type IdeaToSpecIntakeDraft = {
  artifactKind: "idea_event_storming_intake_draft";
  sourceMode: "local_browser_draft";
  canonicalMutationsAllowed: false;
  trackedArtifactsWritten: false;
  project: string;
  summary: string;
  activeFrame: IdeaToSpecActiveFrame;
  actors: readonly string[];
  domainEvents: readonly string[];
  commands: readonly string[];
  policies: readonly string[];
  constraints: readonly string[];
  vocabularyQuestions: readonly string[];
  contextCompletionQuestions: readonly string[];
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "build",
  "create",
  "decision",
  "feature",
  "from",
  "idea",
  "into",
  "product",
  "record",
  "should",
  "system",
  "that",
  "their",
  "there",
  "this",
  "with",
]);

function slug(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

function sentences(value: string): string[] {
  return value
    .split(/[.!?\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function inferActors(text: string): string[] {
  const lower = text.toLowerCase();
  const actors = ["actor.user"];
  if (/\bteam|teams|collaborat/.test(lower)) actors.push("actor.team");
  if (/\bowner|approver|reviewer\b/.test(lower)) actors.push("actor.owner");
  if (/\badmin|administrator\b/.test(lower)) actors.push("actor.admin");
  if (/\bcustomer|client\b/.test(lower)) actors.push("actor.customer");
  return unique(actors);
}

function inferVocabularyQuestions(text: string): string[] {
  const terms = unique(
    text
      .split(/[^A-Za-z0-9]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 4)
      .map((word) => word.toLowerCase())
      .filter((word) => !STOP_WORDS.has(word)),
  ).slice(0, 4);
  if (terms.length === 0) {
    return ["question.vocabulary.bind-domain-terms"];
  }
  return terms.map((term) => `question.vocabulary.${slug(term, "term")}`);
}

export function buildIdeaToSpecIntakeDraft({
  idea,
  activeFrame,
}: {
  idea: string;
  activeFrame: IdeaToSpecActiveFrame;
}): IdeaToSpecIntakeDraft | null {
  const trimmed = idea.trim();
  if (!trimmed) return null;
  const parts = sentences(trimmed);
  const first = parts[0] ?? trimmed;
  const project = activeFrame.project ?? "Product idea";
  const eventSeeds = (parts.length > 0 ? parts : [trimmed]).slice(0, 3);
  const domainEvents = eventSeeds.map(
    (item, index) => `event.${slug(item, `idea-event-${index + 1}`)}`,
  );
  const commands = [
    `command.capture-${slug(first, "idea")}`,
    ...inferActors(trimmed)
      .filter((actor) => actor !== "actor.user")
      .map((actor) => `command.${actor.replace("actor.", "")}-reviews-idea`),
  ];
  const lower = trimmed.toLowerCase();
  const policies = [];
  if (/\breview|approve|owner|decision\b/.test(lower)) {
    policies.push("policy.owner-review-before-promotion");
  }
  if (/\bconflict|supersede|replace\b/.test(lower)) {
    policies.push("policy.conflict-and-supersession-tracked");
  }
  const constraints = ["constraint.non-canonical-intake-draft"];
  if (/\bprivate|security|secure|secret\b/.test(lower)) {
    constraints.push("constraint.private-data-not-published");
  }
  if (/\boffline|mobile|latency|slow\b/.test(lower)) {
    constraints.push("constraint.execution-context-must-be-confirmed");
  }

  return {
    artifactKind: "idea_event_storming_intake_draft",
    sourceMode: "local_browser_draft",
    canonicalMutationsAllowed: false,
    trackedArtifactsWritten: false,
    project,
    summary: first.slice(0, 180),
    activeFrame,
    actors: inferActors(trimmed),
    domainEvents: unique(domainEvents),
    commands: unique(commands),
    policies: unique(policies),
    constraints: unique(constraints),
    vocabularyQuestions: inferVocabularyQuestions(trimmed),
    contextCompletionQuestions: [
      "question.context.out-of-scope",
      "question.context.primary-success-metric",
      ...(activeFrame.ontologyRefs.length === 0
        ? ["question.context.active-ontology-package"]
        : []),
    ],
  };
}
