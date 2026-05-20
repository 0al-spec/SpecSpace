# CTXB-P13-T36 Validation Report

## Summary

Result: PASS.

`CTXB-P13-T36` adds direct Agent Conversation starts from Spec Inspector
Markdown artifacts. The implementation is frontend-only: it adds the selected
Markdown artifact to Agent Context and opens Agent Conversation with a seeded
prompt over the existing mock runtime boundary. The Agent Conversation panel
also exposes per-item context removal so users do not have to return to the
separate Agent Context panel.

## Local Validation

```bash
npm test --prefix graphspace -- agent-workbench start-agent-conversation
```

Result: PASS — 4 files / 17 tests passed.

```bash
npm test --prefix graphspace
```

Result: PASS — 51 files / 277 tests passed.

```bash
npm run build --prefix graphspace
```

Result: PASS. Vite emitted the existing chunk-size warning.

```bash
npm run lint:fsd --prefix graphspace
```

Result: PASS — no FSD problems found.

```bash
git diff --check
```

Result: PASS.

## Browser Smoke

Target: `http://127.0.0.1:5173/`.

Desktop viewport: `1440x1000`.

- Opened Sidebar and selected `SG-SPEC-0001`.
- Exported Markdown from Spec Inspector.
- Clicked `Start Chat` from the Markdown export controls.
- Verified Agent Conversation opened.
- Verified one Markdown context token was attached.
- Verified the prompt composer was seeded with:
  - root spec `SG-SPEC-0001`;
  - artifact kind `Spec Markdown export`;
  - scope `refinement subtree`;
  - node count;
  - filename.

Mobile viewport: `390x844`.

- Verified Agent Conversation remains inside the mobile utility panel.
- Verified utility header and content do not overlap.
- Verified the Markdown context token and seeded prompt remain visible.
- Verified `Remove` on the conversation context token removes the item and shows
  the empty context state.
- Verified the mobile utility panel stays above the Spec Inspector when both
  would otherwise overlap, so the conversation token controls remain clickable.

Known local dev console noise: `/api/v1/specpm/registry` returns `503` in this
local setup. It is unrelated to this task.
