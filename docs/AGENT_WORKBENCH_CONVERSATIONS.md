# Agent Workbench Conversation Artifacts

SpecSpace Agent Workbench conversations are future writable SpecSpace artifacts.
They are not legacy ContextBuilder dialog JSON files and they are not SpecGraph
canonical specs or run artifacts.

## Boundary

SpecSpace owns the Agent Workbench artifact once a deployment enables a writable
workbench store. SpecGraph remains the producer of canonical graph artifacts:

- `specs/nodes/*.yaml`
- `runs/*.json`
- proposal lane/runtime/trace artifacts
- metrics artifacts

An Agent Workbench conversation may reference those artifacts, but it must not
mutate them directly. Proposal creation starts as a SpecSpace-owned output. A
separate promotion/materialization path can later hand that proposal to
SpecGraph.

Legacy ContextBuilder conversations remain a different contract. They use
top-level `conversation_id`, `messages`, and `lineage` fields and are served by
legacy routes such as `/api/conversation`. The Agent Workbench contract uses
`turns`, `context_sets`, and `outputs`; it must be served through future
`/api/v1/agent-workbench/*` endpoints.

## Storage

Recommended future storage layout:

```text
workbench/
  conversations/
    index.json
    awb-conv-0001.json
```

This store is SpecSpace-owned. It can live in local disk, a database, object
storage, or an account-scoped service, but it is distinct from mounted
SpecGraph `specs/` and `runs/`.

Static readonly deployments can expose the index and conversation artifacts if
they are prepublished, but cannot append turns or create proposal outputs.
Writable deployments must advertise that authority separately from the existing
readonly SpecGraph provider state.

## UI Framework Boundary

Agent UI frameworks are replaceable adapters around the SpecSpace-owned
conversation and context model. The FSD placement and adapter rules are
documented in
[`AGENT_UI_FRAMEWORK_BOUNDARY.md`](./AGENT_UI_FRAMEWORK_BOUNDARY.md).

## Conversation Artifact

Required top-level fields:

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_agent_conversation",
  "schema_version": 1,
  "conversation_id": "awb-conv-0001",
  "title": "Review SIB metric gaps",
  "status": "active",
  "created_at": "2026-05-17T16:00:00Z",
  "updated_at": "2026-05-17T16:05:00Z",
  "storage": {
    "owner": "specspace",
    "mutation_authority": "specspace_workbench_only"
  },
  "participants": [],
  "context_sets": [],
  "turns": [],
  "outputs": [],
  "parent_refs": []
}
```

`conversation_id` is a stable artifact id. It does not need to match legacy
ContextBuilder conversation ids.

Allowed `status` values:

- `active`
- `archived`
- `superseded`

Allowed participant roles:

- `operator`
- `agent`
- `system`
- `tool`

## Turns

Turns are append-only records. A turn can contain text, markdown, or references
to generated artifacts:

```json
{
  "turn_id": "turn-0001",
  "role": "operator",
  "created_at": "2026-05-17T16:01:00Z",
  "content": [
    {
      "kind": "markdown",
      "text": "Analyze why SIB is below threshold."
    }
  ],
  "context_set_ids": ["ctx-0001"]
}
```

Allowed content block kinds:

- `text`
- `markdown`
- `artifact_ref`

## Context Sets

A context set is a named bundle of graph-related references that a turn can use
as agent context. It is explicit and serializable so future agent calls can be
audited.

Required fields:

```json
{
  "context_set_id": "ctx-0001",
  "created_at": "2026-05-17T16:00:30Z",
  "label": "SIB graph context",
  "items": []
}
```

Allowed context item kinds:

- `spec_node`
- `spec_edge`
- `gap`
- `proposal`
- `metric`
- `specpm_package`
- `external_link`

Context item examples:

```json
[
  {
    "kind": "spec_node",
    "node_id": "SG-SPEC-0001",
    "title": "SpecGraph - The Executable Product Ontology"
  },
  {
    "kind": "spec_edge",
    "source_node_id": "SG-SPEC-0001",
    "target_node_id": "SG-SPEC-0021",
    "edge_kind": "relates_to"
  },
  {
    "kind": "gap",
    "node_id": "SG-SPEC-0021",
    "gap_id": "gap-metric-threshold-authority",
    "path": "specification.gaps[0]"
  },
  {
    "kind": "proposal",
    "proposal_key": "proposal::0042",
    "proposal_path": "docs/proposals/0042_agent_context.md"
  },
  {
    "kind": "metric",
    "metric_key": "metric_score::sib",
    "category": "metric_score",
    "item_id": "sib"
  },
  {
    "kind": "specpm_package",
    "package_id": "specnode.core",
    "version": "0.1.0"
  },
  {
    "kind": "external_link",
    "title": "SpecGraph - The Executable Product Ontology",
    "artifact_path": "SG-SPEC-0001.compiled.md",
    "source_kind": "hyperprompt_compile",
    "node_id": "SG-SPEC-0001",
    "scope": "node",
    "node_count": 1
  }
]
```

Runtime-only Agent Context entries must be normalized before they are written to
this artifact contract. For example, SpecSpace UI `spec_gap` context entries are
stored as artifact `gap` entries, and `spec_markdown` context entries are stored
as `external_link` entries that reference the generated Markdown/compile
artifact path. Raw Markdown bodies and compiled Markdown bodies are not part of
the conversation artifact context schema.

## Outputs And Proposal Origins

Agent output is recorded before any producer-side mutation. A proposal output
can later be materialized by a separate reviewed flow:

```json
{
  "output_id": "out-0001",
  "kind": "proposal_draft",
  "created_at": "2026-05-17T16:05:00Z",
  "origin_turn_id": "turn-0002",
  "context_set_ids": ["ctx-0001"],
  "proposal": {
    "proposal_key": "agent-proposal::awb-conv-0001::out-0001",
    "title": "Attach SIB threshold authority",
    "status": "draft",
    "target_spec_ids": ["SG-SPEC-0021"]
  }
}
```

Allowed output kinds:

- `analysis`
- `proposal_draft`
- `implementation_handoff`
- `metric_note`

Allowed proposal output statuses:

- `draft`
- `proposed`
- `materialized`
- `rejected`

Every proposal output must have an `origin_turn_id` that points to an existing
turn. This is the trace from conversation to proposal.

## Index Artifact

The index is the lightweight list surface for the future Workbench panel:

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_agent_conversation_index",
  "schema_version": 1,
  "generated_at": "2026-05-17T16:06:00Z",
  "entry_count": 1,
  "entries": [
    {
      "conversation_id": "awb-conv-0001",
      "title": "Review SIB metric gaps",
      "status": "active",
      "updated_at": "2026-05-17T16:05:00Z",
      "turn_count": 2,
      "context_item_count": 6,
      "output_count": 1,
      "proposal_output_count": 1
    }
  ]
}
```

## Future API Shape

Read endpoints:

- `GET /api/v1/agent-workbench/conversations`
- `GET /api/v1/agent-workbench/conversations/{conversation_id}`

Future writable endpoints must be capability-gated and must not be enabled by
the existing readonly SpecGraph provider:

- `POST /api/v1/agent-workbench/conversations`
- `POST /api/v1/agent-workbench/conversations/{conversation_id}/turns`
- `POST /api/v1/agent-workbench/conversations/{conversation_id}/outputs`

## Open Follow-ups

- `CTXB-P13-T8` should define the first graph-context selection flow that
  serializes selected nodes, edges, gaps, proposals, and metrics into a
  `context_set`.
- A later task should decide whether Workbench persistence starts as local files
  or a service-backed store.
- A later task should define the proposal materialization handshake from
  SpecSpace-owned `proposal_draft` output to SpecGraph-owned proposal artifacts.
