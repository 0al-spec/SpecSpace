export const MESSAGE_AUTHORING_ROLES = ["user", "assistant", "system", "tool"] as const;

export type MessageAuthoringRole = (typeof MESSAGE_AUTHORING_ROLES)[number];

export interface MessagePayload {
  message_id: string;
  role: MessageAuthoringRole;
  content: string;
}

interface ConversationFilePayload {
  conversation_id?: unknown;
  message_count?: unknown;
  messages?: unknown;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeMessageAuthoringRole(value: string): MessageAuthoringRole | null {
  return MESSAGE_AUTHORING_ROLES.find((role) => role === value) ?? null;
}

export function nextMessageId(params: {
  conversationId: string;
  role: MessageAuthoringRole;
  content: string;
  existingMessageIds: Iterable<string>;
}): string {
  const existingIds = new Set(params.existingMessageIds);
  const index = existingIds.size + 1;
  const digest = stableHash(
    JSON.stringify({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      index,
    }),
  );
  const baseId = `msg-${String(index).padStart(4, "0")}-${params.role}-${digest.slice(0, 8)}`;
  let candidate = baseId;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function appendMessageToConversationData(params: {
  data: unknown;
  conversationId: string;
  role: MessageAuthoringRole;
  content: string;
}): { data: ConversationFilePayload; message: MessagePayload } {
  if (!isRecord(params.data)) {
    throw new Error("Conversation file payload must be a JSON object.");
  }

  const source = params.data as ConversationFilePayload;
  if (!Array.isArray(source.messages)) {
    throw new Error("Conversation file payload must include a messages array.");
  }

  const existingMessageIds = source.messages
    .map((message) => {
      if (!isRecord(message)) return null;
      return typeof message.message_id === "string" ? message.message_id : null;
    })
    .filter((messageId): messageId is string => Boolean(messageId));

  const content = params.content.trim();
  const message: MessagePayload = {
    message_id: nextMessageId({
      conversationId: params.conversationId,
      role: params.role,
      content,
      existingMessageIds,
    }),
    role: params.role,
    content,
  };

  const data: ConversationFilePayload = {
    ...source,
    messages: [...source.messages, message],
  };

  if (typeof source.message_count === "number") {
    data.message_count = source.messages.length + 1;
  }

  return { data, message };
}
