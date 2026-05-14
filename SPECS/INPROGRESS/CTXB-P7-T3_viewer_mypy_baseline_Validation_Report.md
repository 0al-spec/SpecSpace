# CTXB-P7-T3 Viewer Mypy Baseline Validation Report

## Scope

Close the remaining `mypy viewer/` blockers after the graph typed-contract and
handler protocol slices.

Changes:

- type the viewer runtime server attributes through `ViewerRuntimeServer`;
- type workspace IO loader callback seams;
- align export helpers with graph `TypedDict` contracts;
- preserve server compatibility wrappers while making their signatures
  mypy-compatible;
- document the PyYAML import as untyped where no local stubs are present.

## Acceptance

| Check | Result |
| --- | --- |
| `python -m mypy viewer/` passes | Passed |
| Export pipeline accepts typed graph nodes/checkpoints without API shape changes | Passed |
| Runtime setup and workspace IO focused tests continue to pass | Passed |

## Validation

```bash
python -m py_compile viewer/specgraph.py viewer/server_runtime.py viewer/workspace_io.py viewer/export.py viewer/server.py
python -m mypy viewer/
python -m pytest tests/test_server_runtime.py tests/test_workspace_io.py tests/test_workspace_cache.py tests/test_export.py tests/test_api_contracts.py::ExportApiTests tests/test_specgraph.py::SpecGraphEndpointTests
```

Result: passed.
