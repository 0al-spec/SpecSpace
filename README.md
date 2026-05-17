# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `d122ad10fc6d9e82a4c6417c5684deddeb5c9b42`
- Generated at: `2026-05-17T23:35:27Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e7e7f7c63d438573051be246d4c656b29ae57b229fb56c16ec1c923fefb66d2e`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:b25e81dd723d9eb7b67599da90c055de40f1155fbcda2aeb34f1f0b6758ef656`
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
