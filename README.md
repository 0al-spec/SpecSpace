# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `2c0010bf6bf314a43d825e8505399c1fa439723f`
- Generated at: `2026-05-18T22:04:59Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:d01b9abcee460cce72da71d5e30ccb914ab78c5dd445fb9ed982680bf7b1318f`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:1b4e14b1c10757d24daf960e2467c547b5769f1027533df013995f4e76948ebb`
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
