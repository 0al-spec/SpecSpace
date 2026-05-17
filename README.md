# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `f61b95e50b5457a31eebe9a868ff7e2f2a622312`
- Generated at: `2026-05-17T22:54:34Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:9d13cfde455a1190d6612ed701eacad368c7b840ec3a8f8ac41358ca23d500a3`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:8bb119316eb45b12ae54f0f5ae35afb6d974a62d057c20e2c6a861b7c2fe0547`
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
