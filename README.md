# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `10d9c2be931e2cb846bb0f2adf33f4a08504ec9f`
- Generated at: `2026-05-17T18:50:51Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:063de783313cbfd0c29daec8f413388694199955990634788c4eedda7fe1ae7e`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:e5f781c9cea8de7195a92ce0fb9020d8d930befef082f3e299d0271fdb918754`
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
