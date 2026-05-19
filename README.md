# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `9a08b2d128f834b3de7ccfe14883a74e44e2fa16`
- Generated at: `2026-05-19T05:04:29Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c74f87ec4840b01d546e0739252f89cddff272cf3ab20b89bc20ae30b2cf2550`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:322e2065f196bbe676851af922aae0443079d62462f7786b5e6ad496f858df63`
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
