# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `f9ed73abac65ab905087efee9895c0a0b3708e13`
- Generated at: `2026-05-19T09:04:14Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:660aa6909c3590381fe135a1522c7b2ca00413b3c9fe05f440c512afc9db850f`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:a2e67c7160cfd00fa5107acd1d263e413c9fb7ade6c39d09c5f0309773061861`
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
