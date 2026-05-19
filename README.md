# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `649c8662f4d5103b1f1a6ed63de87912567c1d49`
- Generated at: `2026-05-19T05:37:09Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:0397e62221868f15b285a322408f9f9d52046ae709d9f103709a8668fa59ccbb`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:55af559f0f77d8f961bff1caa3e1ad7e5b3ac57db8dfef09a574e23f26a2189a`
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
