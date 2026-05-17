# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `3ca257c50f983c4b2ebce6bf1fed4cf80d3b3901`
- Generated at: `2026-05-17T08:01:03Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e80086a7da38179ecfab7448a168c72a50e2b1f7f91cb7d1fc7c4a2cb112f61b`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:dbe4f6c219b12c8feca9c4c994daa0fdd22f7413fc9d8d1f2e223244036c7e08`
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
