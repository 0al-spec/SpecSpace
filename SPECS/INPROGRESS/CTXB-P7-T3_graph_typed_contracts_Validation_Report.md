# CTXB-P7-T3 Graph Typed Contracts Validation Report

## Scope

Introduce typed graph payload contracts in `viewer/graph.py` without changing
the serialized API shape:

- `GraphCheckpoint`
- `GraphNode`
- `GraphEdge`
- `GraphDiagnostic`
- `BlockedGraphFile`
- `GraphSnapshot`

Also tighten schema narrowing with `TypeGuard` so the graph/schema slice can be
checked directly by mypy.

## Acceptance

| Check | Result |
| --- | --- |
| Graph node, edge, and checkpoint payloads have explicit typed contracts | Passed |
| Existing JSON API payload shape remains unchanged | Passed |
| `build_compile_target()` returns the existing `CompileTargetPayload` contract | Passed |
| `viewer/schema.py` and `viewer/graph.py` are mypy-clean together | Passed |

## Validation

```bash
python -m py_compile viewer/schema.py viewer/graph.py
python -m mypy viewer/schema.py viewer/graph.py
python -m pytest tests/test_graph.py tests/test_api_contracts.py::GraphApiContractTests tests/test_selection.py::CompileTargetKindTests tests/test_selection.py::CompileTargetLineageFieldsTests tests/test_selection.py::CompileTargetCheckpointScopeTests tests/test_selection.py::CompileTargetDeterminismTests tests/test_selection.py::CompileTargetBrokenLineageTests
```

Result: passed.
