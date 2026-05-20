# CTXB-P13-T37 Validation Report

## Summary

Result: PASS.

`CTXB-P13-T37` makes the Agent Conversation mock runtime describe attached
context items in the transcript, without rendering raw Spec Markdown bodies.

## Local Validation

```bash
npm test --prefix graphspace -- start-agent-conversation agent-conversation-panel agent-workbench
```

Result: PASS — 5 files / 20 tests passed.

```bash
npm test --prefix graphspace
```

Result: PASS — 51 files / 278 tests passed.

```bash
npm run build --prefix graphspace
```

Result: PASS. Vite emitted the existing chunk-size warning.

```bash
npm run lint:fsd --prefix graphspace
```

Result: PASS — no FSD problems found.

## Browser Smoke

Target: `http://127.0.0.1:5173/`.

Desktop viewport: `1440x1000`.

- Selected `SG-SPEC-0001`.
- Exported Spec Markdown from Spec Inspector.
- Started Agent Conversation from the export.
- Sent the seeded prompt.
- Verified the transcript includes `Attached context`.
- Verified the transcript summarizes `SG-SPEC-0001 Markdown export`,
  `refinement subtree`, and `SG-SPEC-0001.md`.
- Verified the transcript text uses `pre-wrap` so the attached context list
  remains readable.
- Verified the raw Markdown body is not rendered into the transcript.

Mobile viewport: `390x844`.

- Repeated the same flow.
- Verified the attached context summary is present.
- Verified no page-level runtime error occurred.
- Verified the raw Markdown body is not rendered into the transcript.

Known local dev console noise: `/api/v1/specpm/registry` returns `503` in this
local setup. It is unrelated to this task.
