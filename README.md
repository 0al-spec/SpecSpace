# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `d2db1b123ba4af5c7161b868e985e5ba78b0e036`
- Generated at: `2026-05-22T07:53:17Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:fefd8d6b34ab8dbe6ccee7977a168a5a29fdf76e1ffffe5a36344e68310b2fb3`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:7b98cadf768edf83d0a5453843e11901f63a2d9b93be437d73516b9f0260c123`
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
