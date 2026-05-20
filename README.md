# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `54aa0a2b4aa966ce96dbd43e3c9c0580a92fe11c`
- Generated at: `2026-05-20T21:25:07Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e93df33a5fdae4e2f4162b54f46edfc86cb4431b9666acdbcba189a2c7872fcc`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:5aa2a520e52c2c3993826c4cd1fc7069d66d30e00a6f18878afdb44afaee62de`
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
