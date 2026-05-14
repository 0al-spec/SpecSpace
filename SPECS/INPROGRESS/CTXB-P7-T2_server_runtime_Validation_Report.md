# CTXB-P7-T2 Server Runtime Validation Report

## Scope

Extract viewer CLI parsing, runtime server configuration, and runs watcher path
selection from `viewer/server.py` into `viewer/server_runtime.py`.

## Acceptance

| Check | Result |
| --- | --- |
| `viewer.server.main()` still launches the same `ViewerHandler` runtime | Passed |
| `DEFAULT_HYPERPROMPT_BINARY` compatibility remains owned by `viewer.server` | Passed |
| Runs watcher path still prefers `--spec-dir` layout and falls back to `--specgraph-dir` | Passed |
| `viewer/server.py` is reduced from 445 to 399 lines in this slice | Passed |

## Validation

```bash
python -m py_compile viewer/server.py viewer/server_runtime.py
python -m pytest tests/test_server_runtime.py tests/test_runs_watcher.py tests/test_specgraph.py::CapabilitiesEndpointTests tests/test_exploration_preview.py::ExplorationCapabilityTests tests/test_routes.py
```

Result: passed.
