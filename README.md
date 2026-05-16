# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `2c3dbe445a9d913f10b8d31fd4928a22edbee0b3`
- Generated at: `2026-05-16T17:25:04Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:2d641c13256bfad1e946533d04fa346837f9e17e20eac3377a48f95154f6b503`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:f3be407a4117218fcb3ef2198b8b32fae59be787e515bc2ab8a3cd6993908b29`
- SpecGraph artifact source: `https://specgraph.tech`

## Rollback

To roll back, restore `docker-compose.yml` to a previous generated commit on
this branch. Each generated commit pins both images by digest, so the API/UI pair
is selected together.

## Notes

- The first service is named `app` because Timeweb proxies the public domain to
  the first compose service.
- SpecGraph data is read over HTTP through `--artifact-base-url`.
- This branch should not contain application source files.
