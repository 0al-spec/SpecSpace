# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `a60b5129e0a0fdaea3308b38cf8dc5b389136c31`
- Generated at: `2026-05-19T21:10:16Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:5bef08817a0aadea787a46a53d0e5608ec2aa1d0fd53448d3577fd76e9e1a2ae`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:36d419a2b893dcb360d9b6fa878c4e59d8271ae2d4b304d934f6eca36081a16d`
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
