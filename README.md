# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `3d1570cf0d3b3b54da49ac43c3aa1ddeb47ee787`
- Generated at: `2026-05-21T07:03:08Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:51bd56b286b62bbadf14bef2d00ec9080ad793b8cb601472e503bdcf6bf7095a`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:a68f434b2be05228e2fc3ea5248d965e0050b8a38097902f2235b7eb945b8d57`
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
