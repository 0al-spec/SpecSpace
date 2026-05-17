# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `6bb98be5970e1ba77ff5c158985e57bbeb7a4248`
- Generated at: `2026-05-17T13:41:29Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:64d5fc697d3dc373bebb3c0fd431070c1e7ae7e83a5f21eb2426441a139c9384`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:bb33cb6d357f10fdd6cea54f20fcfd1317aa26f845c79e91d6272d3810027d36`
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
