# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `21cec913449b70ee5e8df33497104c3956212b76`
- Generated at: `2026-05-20T23:07:25Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:4a7df483d02f111e1cff77d6cd1654659626f2296c2aa5a77500ff46bfe069fa`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:8a160cb28653fd905b162ac4d42de742b7ebfb3a22e7234c94149d54e19e25ab`
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
