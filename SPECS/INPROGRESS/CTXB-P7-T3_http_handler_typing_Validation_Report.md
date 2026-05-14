# CTXB-P7-T3 HTTP Handler Typing Validation Report

## Scope

Make the extracted HTTP API handler modules type-check against structural
handler protocols instead of requiring concrete `BaseHTTPRequestHandler`.

Changes:

- `JsonResponseHandler` protocol in `viewer/http_response.py`.
- API handler protocols inherit the shared response-writing contract.
- `query_value()` overloads distinguish string defaults from nullable lookups.

## Acceptance

| Check | Result |
| --- | --- |
| Extracted handler protocols can call `json_response()` without concrete inheritance | Passed |
| Query parsing preserves existing runtime behavior | Passed |
| Focused API handler tests continue to pass | Passed |
| Handler slice is mypy-clean except for the pre-existing untyped PyYAML import in `viewer/specgraph.py` | Passed |

## Validation

```bash
python -m py_compile viewer/http_response.py viewer/request_query.py viewer/file_api.py viewer/conversation_api.py viewer/specgraph_api.py viewer/specgraph_surfaces_api.py viewer/specpm_exploration_api.py viewer/capabilities_api.py
python -m mypy viewer/http_response.py viewer/request_query.py viewer/file_api.py viewer/conversation_api.py viewer/specgraph_api.py viewer/specpm_exploration_api.py viewer/specgraph_surfaces_api.py viewer/capabilities_api.py
python -m pytest tests/test_http_response.py tests/test_request_query.py tests/test_api_contracts.py::FileApiHttpTests tests/test_api_contracts.py::GraphApiHttpTests tests/test_specgraph.py::CapabilitiesEndpointTests tests/test_exploration_preview.py::ExplorationCapabilityTests tests/test_specgraph_surfaces.py tests/test_exploration_preview.py::ExplorationBuildPostValidationTests
```

Result: passed for py_compile and pytest. The mypy command now reports only
the pre-existing missing PyYAML stubs through `viewer/specgraph.py`; the handler
protocol errors are resolved in this slice.
