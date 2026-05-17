# Agent UI Framework Evaluation

Date: 2026-05-17
Status: accepted for first adapter spike

## Decision

Use `assistant-ui` as the first React UI primitive candidate for the Agent
Workbench conversation panel, while keeping the SpecSpace runtime boundary
compatible with an AG-UI-style event stream.

Do not adopt CopilotKit or Vercel AI SDK as the core SpecSpace abstraction at
this stage. They remain useful references or later adapters, but SpecSpace
continues to own conversation artifacts, graph context, proposal origins, and
runtime ports through `entities/agent-workbench`.

## Evaluation Criteria

| Criterion | Why it matters for SpecSpace |
| --- | --- |
| React/Vite compatibility | GraphSpace is a Vite React app, not Next.js. |
| Headless/custom runtime support | Agent execution will be SpecSpace-owned and graph-aware. |
| Streaming and interruption UX | Agent turns need incremental events, cancellation, and retries. |
| Tool-call presentation | Future graph actions, proposal drafts, and analysis outputs need visible tool surfaces. |
| FSD fit | Framework types must stay inside adapter slices and not leak into entities. |
| Persistence boundary | SpecSpace owns conversation artifacts; cloud/thread storage must be optional. |
| License and operational risk | Dependencies must be compatible with the project and easy to replace. |

## Candidates

### assistant-ui

Source:

- [assistant-ui website](https://www.assistant-ui.com/)
- [assistant-ui GitHub](https://github.com/assistant-ui/assistant-ui)

Observed fit:

- React/TypeScript-focused chat UI library.
- Official positioning covers chat components, state management, streaming,
  interruptions, retries, and multi-turn conversations.
- The website says it works with React-based providers including Vercel AI SDK,
  LangChain, or any LLM provider.
- MIT license in the repository license file.

SpecSpace decision:

- Best first UI adapter candidate.
- Use only from a future `widgets/agent-conversation-panel` or
  adapter-specific slice.
- Do not let assistant-ui thread/message/runtime types become persisted
  conversation artifact types.

### AG-UI

Source:

- [AG-UI GitHub](https://github.com/ag-ui-protocol/ag-ui)

Observed fit:

- Open event-based protocol for connecting agents to user-facing apps.
- README describes roughly 16 standard event types, loose event matching,
  transport flexibility across SSE/WebSockets/webhooks, and a reference HTTP
  implementation.
- MIT license in the repository license file.

SpecSpace decision:

- Good protocol target for future runtime interop.
- Map AG-UI events into `AgentRuntimeEvent` at the adapter boundary.
- Do not replace SpecSpace's persisted conversation artifact contract with
  raw AG-UI event logs.

### CopilotKit

Source:

- [CopilotKit GitHub](https://github.com/CopilotKit/CopilotKit)

Observed fit:

- Full frontend stack for agent-native apps and generative UI.
- README advertises React chat UI, backend tool rendering, generative UI,
  shared state, and human-in-the-loop workflows.
- CopilotKit is closely tied to AG-UI and offers a `useAgent` hook over AG-UI.
- MIT license in the repository license file.

SpecSpace decision:

- Keep as a later candidate if SpecSpace needs full generative UI or
  human-in-the-loop workflow primitives.
- Too broad for the first Agent Workbench step because it wants to connect UI,
  agents, tools, and shared state as a single interaction loop.
- Avoid making CopilotKit providers/hooks part of page or entity contracts.

### Vercel AI SDK

Source:

- [Vercel AI SDK GitHub](https://github.com/vercel/ai)

Observed fit:

- Provider-agnostic TypeScript toolkit for AI-powered applications and agents.
- README says AI SDK UI provides framework-oriented hooks for chatbots and
  generative UI, including `@ai-sdk/react`.
- Apache-2.0 license in the repository license file.

SpecSpace decision:

- Useful runtime/server toolkit candidate, not the first UI framework choice.
- Keep it behind an adapter if selected later for model provider streaming.
- Avoid Next.js route assumptions in SpecSpace's Vite/Python server setup.

## Target FSD Shape

Initial adapter spike should use:

```text
entities/agent-workbench/
  model/runtime.ts          # SpecSpace-owned runtime port
  model/context.ts          # SpecSpace-owned context set

features/start-agent-conversation/
  model/                    # user action, no UI framework SDK exports

widgets/agent-conversation-panel/
  ui/                       # chat shell, may adapt assistant-ui internally
  model/                    # panel state and event projection
```

Allowed adapter dependency:

```text
widgets/agent-conversation-panel -> entities/agent-workbench
widgets/agent-conversation-panel -> shared/ui
widgets/agent-conversation-panel -> assistant-ui package
```

Forbidden dependency:

```text
entities/agent-workbench -> assistant-ui
entities/agent-workbench -> CopilotKit
entities/agent-workbench -> AG-UI SDK
pages/viewer -> assistant-ui runtime types
```

## Next Implementation Slice

`CTXB-P13-T11` should add a local/mock `AgentConversationRuntime` adapter and
small event projection tests. It should not install a third-party framework yet
unless the mock runtime proves the domain event shape is insufficient.
