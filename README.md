# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `a568274888b2bb37382fbea8d2c56a41b84d7acb`
- Generated at: `2026-05-20T05:48:16Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:06152e010ec06acec75c0465c0a1ea04f8c96fa04e7d93e9e24b80cb2217cd5d`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:0dc099386b120f34b01ad2e1503d332ae8abeebe275a4ad6fb7566686d718017`
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
