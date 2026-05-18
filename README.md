# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `0b68d5bca4de0730f0ca0dcfbf8a2b603b507997`
- Generated at: `2026-05-18T18:41:54Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:b9c82d883fb067e6a60eaef4d6cb7da16e624d4c5989e5573fa3a55bdbc27152`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:0f20d3c58c598617df2052d7118b9ef3b58ceab690b03de6e48434c9acc778e2`
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
