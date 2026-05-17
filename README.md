# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `da6b05773aa32d6b9cb36f99381c66af4294f21e`
- Generated at: `2026-05-17T07:01:03Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:a96af4fc49ee32480d1544847af27b3fbca56621ea06535f5996d0114fd374bf`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:13b002c850adb1cb21a95b18e93eab60d802add3b6f8d374e2bbdb9971eadc56`
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
