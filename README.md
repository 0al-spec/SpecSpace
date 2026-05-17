# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `6cfcd0a934ba47cdfb067b6ba2d83cb2d543194f`
- Generated at: `2026-05-17T18:50:19Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c903be02f273b74e39c1592af050769cf29a2c069fc46099ce032e324be3da34`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:deda9d1957b5680dc9c94661f71e5a4039b4625fb9bfb6fd75a5bc1f94e21115`
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
