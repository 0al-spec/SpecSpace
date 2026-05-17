# Agent UI Framework Boundary

SpecSpace can adopt an existing React agent UI framework only behind a local
Agent Workbench boundary. Framework types must not become the persisted
conversation contract, graph context model, or proposal origin model.

## Decision

Use a replaceable adapter boundary:

```text
pages/viewer
  -> widgets/agent-context-panel
  -> features/add-spec-to-agent-context
  -> entities/agent-workbench
  -> shared/*
```

The first UI framework candidate can be integrated later as a widget-level or
feature-level adapter. The adapter must translate between the framework runtime
shape and SpecSpace-owned `AgentConversationRuntime` / `AgentRuntimeEvent`
types.

## FSD Placement

| Layer | Owns | Must Not Own |
| --- | --- | --- |
| `pages/viewer` | Screen composition, panel toggles, current selection wiring | Agent conversation semantics or framework-specific message models |
| `widgets/agent-context-panel` | Utility panel composition and local workbench presentation | SpecGraph mutations, conversation persistence, agent execution |
| `features/add-spec-to-agent-context` | User action that maps a selected SpecNode into an Agent Workbench context draft | Generic context serialization or UI framework rendering |
| `entities/agent-workbench` | Conversation runtime port, context set entity, serializable workbench types | React components, transport clients, concrete agent framework SDKs |
| `shared/*` | Generic HTTP, reusable UI primitives, artifact contracts | SpecSpace workbench business semantics |

## Adapter Rules

- Framework packages are adapters, not source-of-truth contracts.
- Domain code imports only SpecSpace-owned interfaces from
  `entities/agent-workbench`.
- Adapter code may depend on a framework SDK, but framework SDK types cannot be
  exported from `entities/agent-workbench`.
- Conversation artifacts remain compatible with
  `docs/AGENT_WORKBENCH_CONVERSATIONS.md`.
- Streaming and tool-call UX must normalize into `AgentRuntimeEvent` before the
  rest of SpecSpace consumes it.

## Future Framework Spike

When the UI framework is selected, add a narrow adapter slice rather than
rewriting the workbench entity:

```text
widgets/agent-conversation-panel/
  ui/
  model/

features/start-agent-conversation/
  model/

shared/agent-runtime-adapter-{framework}/
  client/
  mappers/
```

The `shared/agent-runtime-adapter-*` slice is allowed only if it is generic
transport/framework integration with no SpecSpace business decisions. If the
adapter knows about specs, proposals, gaps, metrics, or conversation artifacts,
it belongs in `features` or `widgets` and must depend downward on
`entities/agent-workbench`.
