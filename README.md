# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `fffa8f13faa5f917a8bac8ca4fabe038c9644d7d`
- Generated at: `2026-05-16T19:51:19Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:32eb4a3df081456c73495af78accd4081b5c1726da8654057b3a22a108eece64`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:7cfef30ada42ba4de1f622b89dd8e4f95e4cc2a91c963cfcedc3f26111c3ab31`
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
