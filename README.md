# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `0c49d65d2b6d7ec5d2335deb5cb521e076a40323`
- Generated at: `2026-05-20T21:09:05Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e1a9cfad3fe717a513abbade984dd1b2867361f4a06d8a45bb127533caaf4ab0`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:1008b17565dd43582b833537632f2811ac3d587ee78339fc761f61ef6ebaf1ab`
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
