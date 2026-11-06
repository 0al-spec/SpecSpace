# Full motivation fixture

`motivation-full.fixture.json` is the unchanged `ontologyviz --format json`
output for `Examples/package-visualization/motivation-full.profile.json` from
Ontology commit 7da2e7ceb7ba862d57dd662eb34af89e516849e4. That compiler/profile
source is unchanged at the vendored Viewer pin 613b0ac. The fixture was exported
with source-built CLI products in the ONT-068 isolated-source walkthrough.

It loads motivation-core and events-core, retaining the emitted source identity,
logical pointers and byte digests. This is a declaration projection, not an
accepted ontology, executed policy or proof of source truth. Source paths,
private model data and local runtime tokens are not included.

## Repository membership fixture

`membership.fixture.json` was generated from `Examples/repository-membership/package.yaml`
as present in Ontology commit `096f7f34cb5051e8d62722c4ce2c41b55f374c89`.
A newly built `ontologyviz` from that exact worktree produced identical bytes.
The exported file SHA-256 is
`c867b672a0e1efe709b30b1b509e0994808c33006db64143ad904d8d0235549a`.
The fixture is public declaration data, not execution evidence.

## SpecGraph core fixture

`specgraph-core.fixture.json` is the `data` object from the public
`https://specgraph.space/api/v1/public-specgraph-ontology-graph` response
on 2026-11-07. It is JSON re-serialized for test use, not the original bytes.
Its SHA-256 is `ff9cec8ef7393f6ce0cbf0e6a7f7d3aef3f3dfca1d34d17a4f3721a3bef52854`.
