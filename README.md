# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `819b2f453dfd9a788bb70d4ff02fc5e0ac577183`
- Generated at: `2026-05-17T18:13:35Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:9151a5c7ec0f10035a8fa9127a3820103a9bc0343697508fef0dd05c2e72899f`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:7fa1b3fc78ed3679bbbdd563961c09a7542be6532d1237c5c38f6c3a566fc9ca`
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
