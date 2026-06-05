# HTTP Provider Hyperprompt Compile Contract

Status: implemented runtime contract for SpecSpace issues #220 and #221.

## Purpose

SpecSpace can export SpecGraph Markdown from both local file providers and
read-only HTTP artifact providers. The production Timeweb deployment also
bundles a Hyperprompt binary at `/app/deps/hyperprompt`. Compile remains
disabled by default for HTTP providers, but can be enabled explicitly under the
bounded materialization contract below.

This document defines that contract. It is intentionally narrower than a
general remote workspace compiler: HTTP-backed SpecGraph artifacts remain
read-only, and SpecSpace writes only to a local scratch workspace that it owns.

## Supported API Surface

The first supported API is the existing v1 endpoint:

```text
POST /api/v1/spec-markdown/compile
```

Request fields remain identical to `GET /api/v1/spec-markdown`:

- `root`: required spec node id.
- `scope`: `node` or `subtree`; default `subtree`.
- `depth`: heading depth clamp `1..6`; default `6`.
- `objective`: boolean; default `true`.
- `acceptance`: boolean; default `true`.
- `deps`: boolean; default `true`.
- `prompt`: boolean; default `false`.

Legacy conversation compile endpoints are not included in this contract.

## Availability Gate

HTTP-provider Hyperprompt compile is disabled by default. It becomes available
only when all of the following are true:

1. The active provider kind is `http`.
2. `SPECSPACE_HYPERPROMPT_HTTP_COMPILE_ENABLED=true` is set, or
   `--enable-http-hyperprompt-compile` is passed.
3. A Hyperprompt binary is configured and executable.
4. `SPECSPACE_HYPERPROMPT_WORK_DIR` or `--hyperprompt-work-dir` points to an
   existing writable directory.
5. The configured limits are valid.

Local file-provider compile keeps its current gate: binary plus scratch
workspace. It does not require the HTTP-specific feature flag.

## Materialization Model

SpecSpace must not mount, clone, mutate, or write back to the HTTP artifact
source. For each compile request it must:

1. Read the requested SpecGraph data through the existing read-only provider.
2. Render the same SpecSpace Markdown export payload that
   `GET /api/v1/spec-markdown` would return.
3. Create a SpecSpace-owned bundle under the scratch workspace.
4. Write only generated compile inputs into that bundle:
   - `export.md`;
   - `root.hc`;
   - `export_manifest.json`;
   - `.specspace-hyperprompt-bundle` sentinel.
5. Invoke Hyperprompt with list-form subprocess arguments, never through a
   shell.
6. Read `compiled.md` and `manifest.json` back from the bundle.
7. Return compile results and provenance through the API.

The bundle is a materialized view of the remote artifacts, not a product
workspace. Hyperprompt receives `--root <bundle-dir>` and must not be given a
remote URL as its workspace root.

## Scratch Workspace

The scratch workspace must be explicit and writable. SpecSpace owns only bundle
directories that match both:

- name prefix: `specspace-`;
- sentinel file: `.specspace-hyperprompt-bundle`.

Cleanup is best-effort and must never remove directories without the sentinel.
Default retention is the latest 20 SpecSpace-owned bundles unless a future
configuration overrides it.

Platform/Timeweb wiring should provide a scratch path such as:

```text
SPECSPACE_HYPERPROMPT_WORK_DIR=/data/specspace-hyperprompt
```

## Limits

The runtime must enforce bounded execution. Default limits:

- compile timeout: 60 seconds;
- maximum generated Markdown input: 1 MiB;
- maximum compiled Markdown output read into the API response: 2 MiB;
- maximum retained bundles: 20.

Configuration names:

```text
SPECSPACE_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS
SPECSPACE_HYPERPROMPT_MAX_INPUT_BYTES
SPECSPACE_HYPERPROMPT_MAX_OUTPUT_BYTES
SPECSPACE_HYPERPROMPT_BUNDLE_RETENTION_COUNT
```

Invalid limit configuration makes `hyperprompt_compile` unavailable and should
surface as a capability diagnostic rather than a traceback.

## Capability Diagnostics

`GET /api/v1/capabilities` remains the operator-facing source of truth.

Expected `hyperprompt_compile.status` values:

- `available`: compile can run for the active provider.
- `http_compile_disabled`: provider is `http`, but the explicit HTTP compile
  feature flag is not enabled.
- `provider_unsupported`: provider kind cannot support compile.
- `compiler_missing`: no configured/resolved Hyperprompt binary.
- `compiler_not_executable`: configured binary exists but cannot execute.
- `scratch_not_configured`: no scratch workspace was configured.
- `scratch_missing`: configured scratch path does not exist.
- `scratch_not_directory`: configured scratch path is not a directory.
- `scratch_not_writable`: scratch path is not writable/executable.
- `scratch_unreadable`: scratch path inspection raised an OS error.
- `invalid_limit`: configured timeout/size/retention limit is invalid.

When available, diagnostics include:

- configured binary path;
- resolved binary path;
- binary resolution source;
- checked binary paths;
- scratch workspace;
- provider kind;
- configured timeout and size limits.

## Compile Response Contract

Successful compile responses keep the existing shape and add provenance fields
where available:

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_hyperprompt_compile",
  "root_id": "SG-SPEC-0001",
  "scope": "subtree",
  "source": {
    "provider": "http",
    "read_only": true
  },
  "compile": {
    "exit_code": 0,
    "compiled_markdown": "# Compiled output ...",
    "compiler_manifest": {},
    "export_dir": "/data/specspace-hyperprompt/specspace-SG-SPEC-0001-abc123",
    "root_hc": "/data/specspace-hyperprompt/specspace-SG-SPEC-0001-abc123/root.hc",
    "markdown_file": "/data/specspace-hyperprompt/specspace-SG-SPEC-0001-abc123/export.md",
    "export_manifest": "/data/specspace-hyperprompt/specspace-SG-SPEC-0001-abc123/export_manifest.json",
    "compiled_md": "/data/specspace-hyperprompt/specspace-SG-SPEC-0001-abc123/compiled.md",
    "manifest_json": "/data/specspace-hyperprompt/specspace-SG-SPEC-0001-abc123/manifest.json",
    "binary_path": "/app/deps/hyperprompt",
    "binary_resolution": "configured",
    "timeout_seconds": 60
  }
}
```

Failure mapping:

- capability unavailable: `503` with the same diagnostic shape used by
  `/api/v1/capabilities`;
- invalid request/options: `400`;
- unknown root id or missing provider artifact: provider-specific `404` or
  `503`;
- materialization failure: `500` with a bounded message;
- Hyperprompt timeout: `500` with `error = "Hyperprompt compiler timed out"`;
- Hyperprompt non-zero exit: `422` with `compile.exit_code`, `stderr`, and
  `stdout`;
- oversized generated input/output: `413`.

Tracebacks, local tokens, environment variables, and raw secrets must never be
returned.

## Platform Deployment Inputs

Platform should keep production compile disabled unless an operator explicitly
enables this runtime. To enable it, Platform must render:

```text
SPECSPACE_HYPERPROMPT_HTTP_COMPILE_ENABLED=true
SPECSPACE_HYPERPROMPT_WORK_DIR=/data/specspace-hyperprompt
SPECSPACE_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS=60
SPECSPACE_HYPERPROMPT_MAX_INPUT_BYTES=1048576
SPECSPACE_HYPERPROMPT_MAX_OUTPUT_BYTES=2097152
SPECSPACE_HYPERPROMPT_BUNDLE_RETENTION_COUNT=20
```

and a writable `/data/specspace-hyperprompt` volume/path in the Timeweb deploy
manifest.

Rollback is setting `SPECSPACE_HYPERPROMPT_HTTP_COMPILE_ENABLED=false` or
omitting it entirely; Markdown export remains available.

## Non-Goals

- No writes to SpecGraph, SpecPM, or the HTTP artifact site.
- No remote shell execution.
- No persistent user workspaces.
- No authentication model for user-specific compile history.
- No change to Hyperprompt language semantics.
