# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `beb0a77f323cd70734dcccafd64560d41279ddb7`
- Generated at: `2026-05-17T08:11:22Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:4b572539e1e1df4b587a211cf365e65d8ae2b8ffa6a3c6b02f722cf523a477b2`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:e4d470a6282ba66aa8081d56df2daedca09c65499b6054931b33c40a5ba14039`
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
