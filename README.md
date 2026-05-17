# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `69ff770ea9f9c9dc91982795349dbb7d90f53a09`
- Generated at: `2026-05-17T20:14:57Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:686eea1d0fbea611ee309ee482e27d829effbc7f8ccbefc88b522781e10fbd2b`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:cb8cba5ba86057202564075650ac4ac6428f084990bcd4fc9d12512e771e0dee`
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
