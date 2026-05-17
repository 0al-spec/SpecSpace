# CTXB-P13-T4 — Add SpecPM registry package/version read adapter

Status: PASS  
Date: 2026-05-17

## Summary

SpecSpace now exposes readonly SpecPM registry metadata beyond the existing status/package-index summary. Backend package and package-version endpoints proxy the configured registry, and GraphSpace includes a SpecPM Registry utility panel so operators can inspect the connected registry and published package list.

## Outputs

- `GET /api/v1/specpm/registry/packages/{package_id}`
- `GET /api/v1/specpm/registry/packages/{package_id}/versions/{version}`
- Structured backend errors for missing path parameters, not configured registry, HTTP failures, invalid JSON, non-object payloads, and unsupported registry API versions.
- `graphspace/src/shared/specpm-registry-contract/` parser/schema.
- GraphSpace SpecPM Registry utility panel.

## Boundaries

SpecSpace treats the SpecPM registry as readonly metadata. It does not run package content, publish packages, mutate registry state, or treat registry metadata as canonical SpecGraph authority.

## Next

The next parity task is `CTXB-P13-T5`: Proposal Viewer parity using static proposal indexes.
