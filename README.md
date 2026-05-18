# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `37effde8707b1d39d8787e36309d8322eca50dde`
- Generated at: `2026-05-18T20:11:40Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:982635fd5f320f5c50481229b04fc939ce8c12b4c520b170f6f5583d52da3191`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:d13b4a1b1c68f8c574694dd87c8f748b53cd645108bd0dc7bfc9efd33c446793`
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
