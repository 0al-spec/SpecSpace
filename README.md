# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `39c49b2e2fe9f89a8abb361aba243288ad8e0979`
- Generated at: `2026-05-17T18:49:29Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:5000853346dcf128c19990723f4ac6efb24aabef1c16e859a43a2e5964cf4e8d`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:c648c3bfe25a474e1498abb661e59c597a56199afbe6539386bce59e84b53c36`
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
