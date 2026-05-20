# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `f47aa5791fcf40ac3288162a366d26cf0a791373`
- Generated at: `2026-05-20T06:09:49Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:b836f13ea6d3ad5e3b56edfb21b435b7119e772153457e3f735469bbad4adb9d`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:27056f02720d4ad32a558cf0c9bb60831d6c0a597b3a1f62117378363adacd4c`
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
