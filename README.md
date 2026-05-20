# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `00b417109b9abef2d40070dfead2a16ce241697f`
- Generated at: `2026-05-20T20:42:50Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:2e42265108d948ae15fbbcca2a47849f8063640da46f1155e0be26ca3b20f419`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:f45d4583f7069c87b0029b958dc54a803ec65ce7512dc534ed61faec30ed11ad`
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
