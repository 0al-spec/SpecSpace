# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `4250637a7e5930f738ab83897f4615be96525d3d`
- Generated at: `2026-05-23T11:28:39Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:8447e9c6b4cd62a427dfa7e311d54769a07c53531de59513bf61e90732973828`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:db6db88d246990b37a845ce11ef9535cde2aad4ab9ac74a95b79344b47a4cb93`
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
