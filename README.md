# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `fe40522c4538d3eafc4ba17aa1340f15fa87fd4b`
- Generated at: `2026-05-20T07:33:56Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c456df3d582e8fa4f4747325f12df95a505810b8cbe8591b5a07f1526f5b68b5`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:6d5570232e25cf1b11fba084ebd57a12e218364589ae2b26ac4822a3cacaedd4`
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
