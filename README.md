# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `6878295a3080f84442e3b32f6ef18fb2bfd91e74`
- Generated at: `2026-05-19T07:47:55Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:795b16c449ab0a8f659a4016020b85c111e9afb16d676c0db363d98b333cad7e`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:33dedcfd5dba346972009c6c81073901346bf715469b0372d721d63f828719fc`
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
