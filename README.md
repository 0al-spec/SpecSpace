# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `6afa7e44ee9ffed819d1de3738b7eaa3839d494c`
- Generated at: `2026-05-22T08:07:57Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c233a60b4dd9e02edd5a69a4e33d6d82ab1fa2be23fe273d746699fa535a7ab2`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:752e55274ef3d8ad9cc7ae68e810956b0a89a7533d8336c1bf87fac5e9be4311`
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
