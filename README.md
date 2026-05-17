# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `6c3bb66943ed50880dfd0b829646f3c67351bb8c`
- Generated at: `2026-05-17T12:29:11Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:a2e6620726cda65f2e57269893ac1594bd90011c0b869f45cd4d631cd5bc6c2b`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:b1086b331b5fc0d07a8a8a587f9ea09845222f7ce3cf82041e2c4fb90695feb3`
- SpecGraph artifact source: `https://specgraph.tech`

## Rollback

To roll back, restore `docker-compose.yml` to a previous generated commit on
this branch. Each generated commit pins both images by digest, so the API/UI pair
is selected together.

## Notes

- The first service is named `app` because Timeweb proxies the public domain to
  the first compose service.
- SpecGraph data is read over HTTP through `--artifact-base-url`.
- This branch should not contain application source files.
