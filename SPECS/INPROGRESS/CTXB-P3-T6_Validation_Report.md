# CTXB-P3-T6 Validation Report

Status: PASS
Date: 2026-05-15

## Scope

Conversation inspector message authoring through the existing file API.

## Checks

- `npm run typecheck --prefix viewer/app`
  - PASS
- `npm run lint --prefix viewer/app`
  - PASS
- `npm run build --prefix viewer/app`
  - PASS
  - Vite reported the existing chunk-size warning.
- `make lint`
  - PASS
- `make test`
  - PASS, 523 tests.
- `python -m pytest tests/test_validation.py -q`
  - PASS, 10 passed and 3 subtests passed.
- `python -m pytest tests/test_api_contracts.py::FileApiHttpTests::test_file_api_supports_read_write_delete_and_error_paths -q`
  - PASS, 1 passed.

## Browser Smoke

- Built `viewer/app/dist`.
- Started `viewer/server.py` on a temporary copy of `real_examples/canonical_json`
  at `http://127.0.0.1:18032/`.
- Selected `conv-trust-social-root` in conversation graph mode.
- Entered message content in the new inspector authoring form and clicked
  `Add Message`.
- Verified through `/api/graph`:
  - `checkpoint_count` changed from 2 to 3.
  - Last message id: `msg-0003-user-7748208c`.
  - Last message content: `Manual smoke append from CTXB-P3-T6.`
  - No inline authoring error was rendered.

## Notes

- Browser console showed expected 404s for optional spec endpoints and favicon
  when the smoke server was started without `--spec-dir`; conversation mode
  authoring was unaffected.
- Review fix: guarded post-write conversation refresh against stale selection.
  Re-ran `npm run typecheck --prefix viewer/app`, `npm run lint --prefix
  viewer/app`, and `npm run build --prefix viewer/app`; all passed with the
  same Vite chunk-size warning.
