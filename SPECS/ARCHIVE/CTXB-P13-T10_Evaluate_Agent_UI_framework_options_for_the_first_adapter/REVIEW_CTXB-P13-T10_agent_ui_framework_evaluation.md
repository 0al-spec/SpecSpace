# REVIEW CTXB-P13-T10 — Agent UI framework evaluation

Verdict: PASS

## Findings

No blocking findings.

## Review Notes

- The decision chooses `assistant-ui` for the first UI adapter spike and AG-UI
  compatibility as the runtime/protocol direction.
- CopilotKit is deferred because it is broader than the first Workbench panel
  slice and wants app/agent/tool state as a larger loop.
- Vercel AI SDK is deferred as a runtime/toolkit candidate, not the first UI
  framework.
- The decision keeps SpecSpace-owned conversation artifacts and
  `AgentConversationRuntime` as the local contract.

## Residual Risk

The next code slice should validate the local runtime event shape with a mock
adapter before installing `assistant-ui`. If that mock exposes missing event
states, update `entities/agent-workbench` first rather than bending the UI
adapter around an incomplete domain contract.
