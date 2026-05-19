# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `a7dd71c55e10ed5926e4a993c3f2b89c76d7e9dc`
- Generated at: `2026-05-19T21:09:13Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:7362387da9e4e9fffb0c768a6c7e5cef1ee09ffc6e5749022123e91bb74c2f6a`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:3e8059eef15ecbcc09ef9cfb485e11f8e3e8965f804487268c5ecf5af6ae762b`
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
