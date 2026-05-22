# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `e7650de2fafd4866e9beec0921cb472cda3910ce`
- Generated at: `2026-05-22T09:45:36Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e87108f16c1bd80b8bc49e418a0a5b7cea30b1ccd8b59046338e0d8021a184b5`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:0f75f677352329deaf7cc0ce031590f9e45d288d1189c9a7423d571e3b98c335`
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
