# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `51a091885ca1bbc536b6eb690953aa894a4c3f6b`
- Generated at: `2026-05-18T17:05:52Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:aa4955a3ed042a710582dce9eb865e5f2844fae8a68441f7122114542a1cb523`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:156dc8d711d248458cec6c584bdc9a4ee2ec09a8afd7b341e9a451ad6a3bbc47`
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
