# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `c8a309231e70d8d9a12c8ea57d37307efe91b1fc`
- Generated at: `2026-05-22T21:10:26Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c2659d350bfec533aa5eb19880509b1d280eb8a7d0da09d3f389096f07144b0b`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:0316854c21852b93da9e97b312d2f60f9f847599e9ae6122a30870dc4d4e2e5e`
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
