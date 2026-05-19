# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `cbc4217af2c9277d5789d2abcfa5655c0ee4991c`
- Generated at: `2026-05-19T06:13:41Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:0acdd13d6744b9412e2a62cdbd74a728fc5f1cc725352f2e2194048ac9c11465`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:528cbf9230f991f99a2d8ea178f3d37b9e17bb3d9b3707f13ea1ad336f3df061`
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
