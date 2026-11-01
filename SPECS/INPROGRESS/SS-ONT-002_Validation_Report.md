# SS-ONT-002 local validation

Read-only autoload through existing workspace-scoped catalog/content APIs. Optional
ontology.graph.json was added to the explicitly public run-artifact allowlist;
product diagrams additionally require a verified binding-scoped run root. Content responses add
the SHA-256 of the exact UTF-8 text read. Frontend checks workspace, path, envelope
and supplied catalog digest. No cross-workspace bootstrap fallback or external
artifact URL fetch. Legacy IR is explicitly labeled; a missing producer diagram
is not synthesized or claimed to exist.

Local checks on verified TB5 source copy: 39 frontend tests before the additional
legacy-autoload regression (40 after it), 79 existing artifact/ontology API tests,
2 new provider/digest/scoping tests, 6 Chromium scenarios (desktop/mobile and
missing/invalid workspace controls), production build and FSD lint. Browser
fixtures use intercepted HTTP responses; provider/API tests are separate. This
is not a live production publication/deploy test. Two autoload screenshots were
captured for desktop/mobile and inspected. Manual views remain usable on errors.

React StrictMode repeats/cancels the first catalog request during development;
the test allows that while requiring one content read. An early test interceptor
matched frontend module paths containing /api/; restricted it to /api/v1/.

Hosted CI and independent review remain pending. No merge/deploy performed.
Next: quality-tooling profile in a separate PR; producer-side diagram publication
can follow when its released compiler/profile is selected.

Review regressions: ignore import fixtures/compatibility reports in the broad
ontology_ir catalog group; retain explicitly indexed IR filenames. Reload clears
a failed selection and restores the chooser. An empty global runs directory's
candidate metadata never establishes product diagram ownership, including the
default demo workspace; even a ready binding resolver's global fallback is denied.
After fixes: 33 focused frontend tests, 377 API/artifact/binding tests plus 25
subtests, 7 Chromium scenarios, production build and FSD checks passed on TB5.
