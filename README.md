# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `b71cdc6cbb6a095fae0bb189f8b2c71ffea66da1`
- Generated at: `2026-05-23T07:04:16Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:58ebb749bc700a746898b0e7f48fcdc5ce44d81ed59d0d923accf3376fe3e233`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:eafc0ac769d8032878aee33d541b6334134af900bd76974efbe5e87fb31808e4`
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
