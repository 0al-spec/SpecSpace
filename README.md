# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `d82dddaad3125b1615b7393385b577dc01d3aa9f`
- Generated at: `2026-05-17T08:01:58Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:1a7cab559e4dda6d47d94b750401fe61573963013e5cf085e35dfb31ec7ce539`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:be71b131c6df57b422d59eff84e7e1741087e55d4ae3c7eac8c64d5c2762989e`
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
