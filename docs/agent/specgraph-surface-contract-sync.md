# SpecGraph Surface Contract Sync

**Treat SpecGraph JSON artifacts as versioned contracts, not informal sample data.**
When a SpecGraph PR changes `docs/*viewer_contract.md`, `runs/*`, or producer
metadata such as `schema_version`, `input_catalog_version`, `viewer_projection`,
`source_artifact`, or `source_field`, update ContextBuilder from the contract
first and then from the current artifact shape.

Before wiring a new viewer surface or adapting an existing one:

1. Read the relevant SpecGraph viewer contract doc and PR summary.
2. Inspect the current generated artifact shape, including `artifact_kind`,
   `schema_version`, version fields, `summary`, `entries[]`, and
   `viewer_projection`.
3. Verify every documented `source_field` points to a real path in the current
   artifact. Do not assume paths such as `entries[]` exist just because they are
   common in other artifacts.
4. Update ContextBuilder endpoint/types/fixtures/tests together when the
   contract changes. Tests should catch internal fixture contradictions such as
   count fields not matching list lengths.
5. Render proxy or draft surfaces with explicit caveats. For example,
   SpecGraph metric-pack `verification_runs` currently means
   `runs/review_feedback_index.json` via
   `viewer_projection.verification_kind`; it is not yet full CI/device-farm
   verification cost telemetry.
6. Preserve future compatibility: unknown statuses, filters, and fields should
   pass through as neutral UI states unless the contract explicitly marks them
   as invalid.

If the current artifact is missing, stale, or has a newer version than the UI
understands, show a readable "not built / version not yet supported" state
rather than crashing or silently hiding the section.
