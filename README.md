# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `05394cd8a48dfcbaca4ab142573e22e84cb8ba1d`
- Generated at: `2026-05-17T10:58:00Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:112ba91149d8e8611e5bb109608071a63e0c7ed15a1b38c93fe534eca29117a1`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:3cc5bf321c224f9f4898cc132a68444f58d1a1b22d79c78325f9d475c023211c`
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
