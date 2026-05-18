# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `cb966e046b24a547acb2efd5729f372876bf8a46`
- Generated at: `2026-05-18T19:09:25Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:809c5ab3cc2f5ef3ffea9c0f23cf1affa3b31a7ab09d31ddd0fb926c8c2fd96b`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:f7dd6fa7e7342a826bdf4b05323515e3c7773e46d90ed4c605ceaa6f731bfb24`
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
