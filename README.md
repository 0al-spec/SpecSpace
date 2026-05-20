# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `88f9c1d6767fdb940ddde5dd5ba08e71a81f1eb2`
- Generated at: `2026-05-20T23:27:15Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:db655398e32a0b0ad8d414709888ae09752fbf294556d64d77e4ce92d980f702`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:5eeb8948f64a9eaf42907e66ab5b618e5da2cc308c9690cc646a2e8143216903`
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
