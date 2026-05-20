# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `0c66af9dda539214d8038e1e5830dab5c243809d`
- Generated at: `2026-05-20T22:10:16Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:5726a112f14dfa956b041b2ef4d41a63d32547b3fcedcd8cf227aea616189199`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:c286b265099330f2e40db08eb195eb5b89e917b1d34cf252b9c31953881f02c6`
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
