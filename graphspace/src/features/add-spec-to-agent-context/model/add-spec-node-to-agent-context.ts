import {
  addAgentContextItem,
  createSpecNodeContextItem,
  type AgentContextDraft,
} from "@/entities/agent-workbench";
import type { SpecNode } from "@/entities/spec-node";

export function addSpecNodeToAgentContext(
  draft: AgentContextDraft,
  node: SpecNode,
): AgentContextDraft {
  return addAgentContextItem(draft, createSpecNodeContextItem(node));
}
