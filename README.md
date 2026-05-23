# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `27ca028d7acadf13d29c7b0e18f1f0df1d445e77`
- Generated at: `2026-05-23T12:13:07Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:186db28db0a215d9ceeb856985f801eb5d7ab01116e71c9365e4b4d755fa9e0d`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:12ee59360a552b8ff23499c909a53a060c8a0cb98bf03081fcbcbc1da7b3765d`
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
