# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `f21a0431bd216fed53a85402efc4f1faf412be1a`
- Generated at: `2026-05-22T19:54:23Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:d3bda6f2d2b195595553bd7c406ff61249f8ea6cc7072025b67db7bf9a2d3880`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:44b21e85a0ca7cdb87db88fad5a281e304dc37d18500381d2f87dba8c9642cad`
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
