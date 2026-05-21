# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `a0ac547c33f2fea2b28f1774e29aa291d9e22279`
- Generated at: `2026-05-21T15:45:18Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:b2d980d8d13c3463db272085fce5be45c7be1455a5a306bec31d8f9d55576dfe`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:a662e88a7583382f8740d64731c67b519881c7d84b55d2708d7389117269ea28`
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
