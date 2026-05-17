# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `5a07077eb3046733cb7de95a1e3a4b85e84ca6a3`
- Generated at: `2026-05-17T18:11:47Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:2f5b717f332d2f23c005b5d061a6e9431c3d198ae214e210634461c490e68720`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:735c8cd6186a88e48a39ee236be1f20231afa0eb78ed790f6639e2c2e1038489`
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
