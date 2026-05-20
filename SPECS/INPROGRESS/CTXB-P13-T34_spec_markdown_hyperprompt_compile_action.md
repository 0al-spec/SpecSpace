# CTXB-P13-T34 — Add Spec Inspector Hyperprompt compile action for Spec Markdown exports

## Goal

Expose the local Spec Markdown Hyperprompt compile endpoint from the Spec
Inspector so local/operator deployments regain the useful old ContextBuilder
compile workflow without suggesting compile availability in HTTP/static
production deployments.

## Scope

- Add a typed frontend contract for `/api/v1/spec-markdown/compile`.
- Add a Spec Inspector model fetcher that posts the selected root and export
  scope to the compile endpoint.
- Add a capability-aware `Compile` action beside Markdown export controls.
- Show disabled diagnostic copy when `hyperprompt_compile` is unavailable.
- Show compiled Markdown preview plus copy/download actions on success.

## Non-Goals

- Do not enable compile for HTTP/static artifact providers.
- Do not call legacy `/api/compile`, `/api/spec-compile`, or conversation
  compile target routes.
- Do not add run-supervisor or SpecGraph mutation behavior.
- Do not add persistent compiled artifact storage outside the backend scratch
  workspace.

## Acceptance Criteria

- Spec Inspector shows a compile action next to Markdown export controls.
- The compile action is disabled unless `/api/v1/capabilities` reports
  `hyperprompt_compile: true`.
- Disabled state shows actionable diagnostic text from the capability payload.
- Successful compile response shows exit code, artifact paths, compiled
  Markdown preview, copy action, and download action.
- Compile response parsing rejects malformed success payloads.
- Focused GraphSpace tests cover compile response parsing and request behavior.
- `npm run build --prefix graphspace` and `npm run lint:fsd --prefix graphspace`
  pass.
