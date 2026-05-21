# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `b4f95c6b31ee7bde7de228730ee57e9dfafd0e51`
- Generated at: `2026-05-21T06:50:02Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:38c43ea457bde935d61691d4016a7de329ab68530c0f1c47eceaaf8b12c4cafb`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:668df07f4f06220dc319e429893806e3acdaef148077f06c9ce694a5654d60d2`
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
