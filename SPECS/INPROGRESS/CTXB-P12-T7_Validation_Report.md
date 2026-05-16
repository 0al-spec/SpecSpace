# CTXB-P12-T7 Validation Report

**Task:** Publish pinned SpecSpace images and generate manifest-only Timeweb branch  
**Date:** 2026-05-16  
**Verdict:** PASS

## Summary

SpecSpace CI now builds API/UI Docker images and, on `main`, publishes them to
GHCR with commit-SHA tags. The follow-up deploy job renders a manifest-only
`timeweb-deploy` branch that contains only `docker-compose.yml` and `README.md`
and references the published images by digest.

The live `timeweb-deploy` branch is not modified by this PR. It will be updated
by the new CI deploy job after the PR lands on `main`.

## Acceptance Criteria

| Criterion | Result |
| --- | --- |
| CI builds API and UI images tagged by commit SHA | PASS — `SpecSpace Images` builds both Dockerfiles and pushes SHA tags on `main` |
| Generated `timeweb-deploy` branch has no source requirement | PASS — renderer emits only `docker-compose.yml` and `README.md`; strict checker rejects extra top-level files |
| Timeweb compose references pinned images | PASS — renderer requires `@sha256:<digest>` refs and rejects `latest` |
| Guardrails keep UI first and HTTP artifacts enabled | PASS — strict checker verifies first service `app`, no `volumes`, no `build`, and `--artifact-base-url https://specgraph.tech` |
| Documentation explains rollback | PASS — Timeweb deployment guide documents rollback through prior generated branch commits |

## Validation Commands

```bash
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/specspace-timeweb-render.XXXXXX") && \
SPECSPACE_API_IMAGE_REF=ghcr.io/0al-spec/specspace-api@sha256:1111111111111111111111111111111111111111111111111111111111111111 \
SPECSPACE_UI_IMAGE_REF=ghcr.io/0al-spec/specspace-ui@sha256:2222222222222222222222222222222222222222222222222222222222222222 \
SPECSPACE_RELEASE_COMMIT=test-release \
SPECSPACE_RELEASE_CREATED_AT=1970-01-01T00:00:00Z \
scripts/render-timeweb-deploy-branch.sh "$tmp_dir" && \
scripts/validate-timeweb-deploy-tree.sh "$tmp_dir"
```

Result: PASS.

```bash
python - <<'PY'
from pathlib import Path
import yaml
for path in [Path(".github/workflows/ci.yml")]:
    yaml.safe_load(path.read_text())
    print(f"{path}: yaml ok")
PY
```

Result: PASS.

```bash
TIMEWEB_DEPLOY_REMOTE=specspace scripts/check-timeweb-deploy-branch.sh
```

Result: PASS against the current deploy branch in compatibility mode.

```bash
python -m pytest tests/test_timeweb_deploy_scripts.py tests/test_specspace_api_v1.py -q
```

Result: PASS — 18 passed.

```bash
make lint
python -m mypy viewer/
```

Result: PASS.

```bash
docker build -q -f Dockerfile .
docker build -q -f graphspace/Dockerfile .
```

Result: PASS.

```bash
python -m pytest tests/ -q
```

Result: PASS — 550 passed, 41 subtests passed.

## Notes

- CI ignores pushes to `timeweb-deploy`; once the branch becomes manifest-only
  it no longer contains the repository source required by normal CI jobs.
- The publish script updates `timeweb-deploy` with a normal branch push, not a
  force push.
- GHCR package visibility must allow Timeweb to pull the images. The docs call
  out public packages or future private-pull credential support.
