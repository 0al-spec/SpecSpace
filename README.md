# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `73150b0b8d6e13301a0d55dbb1a5f4046267bba2`
- Generated at: `2026-05-19T05:16:57Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c7c5d97b60727614083033ac49dd87f41d88c43b013056e34bde1643842c6082`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:9466a95134b16a9487ec9e26c2e67d73af85476eebd89f6d74814af1ec67b9d4`
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
