# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `2b790ddf633bf29eb8297306d804d7317788cfea`
- Generated at: `2026-05-17T18:12:26Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:26ce1bd72759a583eeb44d506e5ad645da45c76d453433612bb7e551d3cf3fdf`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:488901ecf94279a797001bf690f1ee96e59a66cff346a91ac0456232212d90fa`
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
