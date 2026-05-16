# CTXB-P12-T6 Validation Report

**Task:** Plan registry-backed Timeweb deploy branch and HTTP artifacts  
**Status:** PASS  
**Date:** 2026-05-16

## Summary

SpecSpace now has a readonly HTTP/static SpecGraph artifact provider behind the
same `/api/v1/*` boundary as the file provider. Timeweb no longer needs bundled
demo artifacts: the `timeweb-deploy` branch has been updated to start the API
with `--artifact-base-url https://specgraph.tech`.

The registry-backed manifest-only branch remains a follow-up implementation
task (`CTXB-P12-T7`) because it changes image publishing and release
permissions.

## Acceptance

| Criterion | Result |
| --- | --- |
| Plan explains CI-built/pinned API/UI images | PASS — documented as the future manifest-only branch in `docs/TIMEWEB_DEPLOYMENT.md` and split into `CTXB-P12-T7` |
| Plan explains `timeweb-deploy` maintenance | PASS — Timeweb guide and guard scripts define the branch shape |
| Minimal static artifact contract is defined | PASS — provider consumes `artifact_manifest.json` with relative paths, checksums, sizes, and `generated_at` |
| Follow-up tasks are independently PR-sized | PASS — HTTP provider, Timeweb switch/docs, and registry-backed image publishing are separated |

## Validation

| Command | Result |
| --- | --- |
| `python -m py_compile viewer/specspace_provider.py viewer/specspace_v1_api.py viewer/server_runtime.py` | PASS |
| `python -m pytest tests/test_specspace_api_v1.py -q` | PASS, 13 passed |
| `python -m pytest tests/test_specspace_api_v1.py tests/test_capabilities_api.py -q` | PASS, 15 passed |
| `python -m mypy viewer/` | PASS |
| `make lint` | PASS |
| `TIMEWEB_DEPLOY_REMOTE=specspace scripts/check-timeweb-deploy-branch.sh` | PASS |
| `TIMEWEB_DEPLOY_REMOTE=specspace scripts/validate-timeweb-deploy-branch.sh` | PASS |

## Live Artifact Smoke

Against `https://specgraph.tech`:

- `/artifact_manifest.json` loaded as `specgraph_static_artifact_manifest`.
- HTTP provider built a graph with 65 nodes and 169 edges.
- `SG-SPEC-0001` detail loaded from `specs/nodes/SG-SPEC-0001.yaml`.
- `spec_activity_feed.json` loaded through the runs artifact envelope.

## Deployment Branch

Updated and pushed:

```text
specspace/timeweb-deploy -> 8c05749
```

The root Timeweb compose keeps `app` as the first service and starts
`specspace-api` with:

```text
--artifact-base-url https://specgraph.tech
```
