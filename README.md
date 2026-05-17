# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `bd08e6c07a0d5e2edb2e793aa8796385b1dcd90e`
- Generated at: `2026-05-17T23:36:21Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:2d1c60c6eba123dfd31b32ac32efeb76dd42c698910fac143c8bf7d50bbfb0aa`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:2364d3248348f48225481bd165592668527d6a3e07c7aed432f547c46338fc40`
- SpecGraph artifact source: `https://specgraph.tech`
- SpecPM registry source: `https://specpm.dev`

## Rollback

To roll back, restore `docker-compose.yml` to a previous generated commit on
this branch. Each generated commit pins both images by digest, so the API/UI pair
is selected together.

## Notes

- The first service is named `app` because Timeweb proxies the public domain to
  the first compose service.
- SpecGraph data is read over HTTP through `--artifact-base-url`.
- SpecPM registry metadata is read over HTTP through `--specpm-registry-url`.
- This branch should not contain application source files.
