# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `240fb498bd90aae601337925b19ae86403fea4fa`
- Generated at: `2026-05-17T12:24:53Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:842cab66cd3a74ca4fd273f2e26b93d3668296031263689834d8b8c124bd5d93`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:0d9f143d59cbf51898406fcc6dc82fdd148d39c969d8365a3f12335afd9d4ed6`
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
