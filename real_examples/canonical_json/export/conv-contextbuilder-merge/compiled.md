# ContextBuilder export root
## ContextBuilder compile provenance

<!-- contextbuilder_provenance schema=contextbuilder.compile_provenance.v1 -->

## ContextBuilder Compile Provenance

- Scope: conversation
- Target conversation_id: conv-contextbuilder-merge
- Target message_id: (none)
- Target kind: canonical-merge
- Lineage complete: yes
- Lineage conversations: conv-trust-social-root -> conv-trust-social-branding-branch -> conv-contextbuilder-merge

### Source Conversations
- `conv-trust-social-root` from `root_conversation.json` (2 node files)
- `conv-trust-social-branding-branch` from `branch_conversation.json` (2 node files)
- `conv-contextbuilder-merge` from `merge_conversation.json` (2 node files)

## Trust Social Root Conversation

<!-- conversation_id: conv-trust-social-root  message_id: msg-root-1  role: user  turn_id: turn-root-1  source: conversation-turn-1 -->

Outline the core idea for a trust-based social network.

<!-- conversation_id: conv-trust-social-root  message_id: msg-root-2  role: assistant  turn_id: turn-root-2  source: conversation-turn-2 -->

Start from local trust edges and grow communities outward.

## Trust Social Branding Branch

<!-- conversation_id: conv-trust-social-branding-branch  message_id: msg-branch-1  role: user  turn_id: turn-branch-1  source: conversation-turn-1 -->

Continue from the protocol naming checkpoint and explore product branding.

<!-- conversation_id: conv-trust-social-branding-branch  message_id: msg-branch-2  role: assistant  turn_id: turn-branch-2  source: conversation-turn-2 -->

Use a warm product brand and keep MIR as the protocol layer.

## ContextBuilder Merge Conversation

<!-- conversation_id: conv-contextbuilder-merge  message_id: msg-merge-1  role: user  turn_id: turn-merge-1  source: conversation-turn-1 -->

Combine the graph model idea with the Hyperprompt compile path.

<!-- conversation_id: conv-contextbuilder-merge  message_id: msg-merge-2  role: assistant  turn_id: turn-merge-2  source: conversation-turn-2 -->

Treat the graph as the selection model and Hyperprompt as the deterministic compiler.
