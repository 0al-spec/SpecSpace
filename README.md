# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `ba99ce7b31f0084159234e8b6e4cfd4fc4b1fe8d`
- Generated at: `2026-05-18T20:48:26Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:95550fe82e1b1a755478fd0add155950dd2c7a292d4fd904855e8f73edf73aad`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:db3db30831ac47c8639006f882c89b7e2bc0312a48b4bb22f7655f49724291d3`
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
