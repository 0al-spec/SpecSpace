# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `291185cc57d9035084c0fd9793451d1269e96eca`
- Generated at: `2026-05-18T16:15:17Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:d57f3fce5bb97c0b6f897be55f1a6e734b2a639991530921a364d7b6e8f85a38`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:9721f39e96eb48a54932ba6e5032019b8798dc09bb5676578f6e27cbaf7629df`
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
