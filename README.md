# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `f4a3c72208645eeb08a558ceef8d083979bdd735`
- Generated at: `2026-05-17T18:13:02Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:142d53f7ec9b1f6aa5d466616363bde28cf5da7106cc6f23094b742234ed2b40`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:2a5343a4e5a4bcc3c8fc00fbdafd6558be347406b63b2bf4541c5433c34962d2`
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
