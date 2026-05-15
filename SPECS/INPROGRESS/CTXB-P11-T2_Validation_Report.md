# CTXB-P11-T2 Validation Report

## Result

IN PROGRESS — deployment contract, Docker/Compose wiring, and smoke script are
implemented. Local Compose config validates readonly SpecGraph mounts. The
smoke script verifies health, graph, runs, UI, and UI-proxied API surfaces.
Full image build and Compose smoke pass with the normal Docker Desktop config
after the local Docker Desktop credential prompt was approved.

## Validation

| Check | Result |
| --- | --- |
| `docker compose -f compose.specspace.yml config` with local SpecGraph env | Passed |
| `python -m pip install -r requirements-dev.txt` | Passed |
| `make lint` | Passed |
| `python -m pytest tests/test_specspace_api_v1.py tests/test_server_runtime.py -q` | 16 passed |
| `npm test --prefix graphspace` | 26 files / 166 tests passed |
| `npm run build --prefix graphspace` | Passed; retained existing Vite chunk-size warning |
| `bash -n scripts/smoke-specspace-deploy.sh` | Passed |
| `SPECSPACE_SMOKE_MODE=probe scripts/smoke-specspace-deploy.sh` against local services | Passed; covered `/api/v1/runs/recent` |
| `docker compose -f compose.specspace.yml build` with normal Docker config | Passed |
| `SPECSPACE_SMOKE_MODE=compose scripts/smoke-specspace-deploy.sh` on ports `8011`/`5183` | Passed |

## Local Smoke Inputs

- `SPECSPACE_SPEC_NODES_DIR=/Users/egor/Development/GitHub/0AL/SpecGraph/specs/nodes`
- `SPECSPACE_RUNS_DIR=/Users/egor/Development/GitHub/0AL/SpecGraph/runs`
- API base: `http://127.0.0.1:8001`
- UI base: `http://127.0.0.1:5173`
