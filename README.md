# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `272fc120f5c8e69cb371ca825f02bab38c323db3`
- Generated at: `2026-05-24T12:43:13Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:5738c69dae684a27e2dead50451eef98c55cd628973615d9ab47f9ec146991b9`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:581475904d6cfbc73acd81a58bca9f054da5727367cd979e12f7546032bfab4a`
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
