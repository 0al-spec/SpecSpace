# CTXB-P7-T2 Capabilities API Validation Report

## Scope

Extract `/api/capabilities` payload construction from `viewer/server.py` into
`viewer/capabilities_api.py`.

## Acceptance

| Check | Result |
| --- | --- |
| Route-compatible `handle_capabilities` remains on `ViewerHandler` | Passed |
| Capability flags preserve existing configured/unconfigured behavior | Passed |
| Capability payload has direct unit coverage without starting an HTTP server | Passed |
| `viewer/server.py` is reduced from 540 to 523 lines in this slice | Passed |

## Validation

```bash
python -m py_compile viewer/server.py viewer/capabilities_api.py
python -m pytest tests/test_capabilities_api.py tests/test_specgraph.py::CapabilitiesEndpointTests tests/test_exploration_preview.py::ExplorationCapabilityTests tests/test_routes.py
```

Result: passed.
