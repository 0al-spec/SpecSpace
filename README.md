# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `778b7189059d7a29743d0f379830f13d1fbcc6b1`
- Generated at: `2026-05-20T20:16:16Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e3e7b9680c0103519a205dc7a7ce574fa599fa9f55843a4647c069ee831a2b66`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:4a908da60d21d70dba80e5bb9c2c1caae19f5c4077028fb14d0285229d5d2763`
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
