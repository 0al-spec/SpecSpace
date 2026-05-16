# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `c05f17df6bd3ae338f98a4694561d640bcfda6d1`
- Generated at: `2026-05-16T16:19:45Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e94acb38d11570452af723ce360b205e6f432b7a2864249dac3910ebb2221778`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:116121c5240cb660a703690a1eb50f3548695c51e47639898e5dadadd9e5f1ee`
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
