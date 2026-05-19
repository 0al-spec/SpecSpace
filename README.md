# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `3bc94da3a385a19f86ee0e1bbca19bd4bd7ca538`
- Generated at: `2026-05-19T19:36:14Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:45af4c082338ef90b4cab265b57996c875811c4fb98fecc6df094be089daca0c`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:d8f9c58e11ab6d67d492d205b2aa19c9570c59a88de91deb9c3d9e835a30d2aa`
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
