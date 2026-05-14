# CTXB-P11-T1 Validation Report

## Result

PASS — SpecSpace now has a readonly file-backed SpecGraph provider, versioned
`/api/v1/*` endpoints, contract documentation, and GraphSpace data reads routed
through the versioned API boundary. Legacy endpoints remain available.

## Backend

| Check | Result |
| --- | --- |
| `python -m py_compile viewer/specspace_provider.py viewer/specspace_v1_api.py viewer/routes.py viewer/server.py viewer/server_runtime.py` | Passed |
| `python -m mypy viewer/` | Passed |
| `make lint` | Passed |
| `python -m pytest tests/test_specspace_api_v1.py tests/test_server_runtime.py -q` | 13 passed |
| `python -m pytest tests/ -q` | 539 passed, 41 subtests passed |

## GraphSpace

| Check | Result |
| --- | --- |
| `npm test --prefix graphspace` | 26 files / 165 tests passed |
| `npm run lint:fsd --prefix graphspace` | Passed, no FSD warnings |
| `npm run build --prefix graphspace` | Passed; retained existing Vite chunk-size warning |

## Runtime Smoke

Local service was restarted on the existing ports:

- Backend: `http://127.0.0.1:8001`
- Frontend: `http://127.0.0.1:5173`

Smoke checks:

- `GET /api/v1/health` returned JSON `200` with `api_version: v1`, provider `file`, and readonly status.
- `GET /api/v1/spec-graph` returned JSON `200` with `api_version: v1` and live SpecGraph node count.
- `GET /api/v1/spec-nodes/SG-SPEC-0001` returned JSON `200` for the focused node.
- `GET /api/v1/spec-activity?limit=1` returned JSON `200` with the runs envelope shape.
- `GET /api/v1/implementation-work-index?limit=1` returned JSON `200`.
- In-app browser smoke on `http://localhost:5173/` rendered live SpecGraph rows including `SG-SPEC-0001`.
