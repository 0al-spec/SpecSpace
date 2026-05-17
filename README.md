# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `878bdca6962782633bb2956fa6b54dcdc33da6d7`
- Generated at: `2026-05-17T12:18:03Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:222a93968ee4d6cc9f01770de2ab09d0b4dfc217f146a784343d1bfa2af6deea`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:7d81e84b00a47e3dd0a214afc9a94ec62cf44d59cf8bcc14f4874b765308627c`
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
