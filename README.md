# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `b9e3cff379f253ff79ea8e97c5fabcceef47a131`
- Generated at: `2026-05-17T15:02:26Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:3eb3e3fd0e7207885f766a17616496d597856b1be58a56f928eada09c9a0b5d9`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:952cf773e1a0f628850a4afc81162c1e4c74d1b90667bc351200d2ece8afc17a`
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
