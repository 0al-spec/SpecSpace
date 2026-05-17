# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `7e085b90331ff6a8ff9326bc4bdb022942a710cc`
- Generated at: `2026-05-17T20:41:47Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:4b225fa1120f5a59506e50af869aab13fe11d136c9f3823094931f7db289dc73`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:fe0b107ef2d3e4fe6175802f264d05a13b8b3e20868db187849f819e8ea85f1d`
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
