# ContextBuilder PRD

## Document Control

- **Product:** ContextBuilder
- **Status:** Draft
- **Date:** 2026-03-22
- **Source Inputs:** user interview, [Architect Role](/Users/egor/Development/GitHub/0AL/ContextBuilder/SPECS/ROLES/Architect.md), local repository context, Hyperprompt repository contract

## 1. Product Intent

ContextBuilder is a local-first browser application for visualizing and editing branching LLM conversations as a graph on a canvas, then compiling a selected thought branch into a continuation-ready context artifact for an external LLM or agent.

The source of truth is a directory of JSON conversation files on disk. ContextBuilder reads those files, preserves lineage between conversations, allows the user to branch from checkpoints and create merge conversations, and then turns a chosen branch of the graph into a deterministic export pipeline:

1. extract selected graph nodes into Markdown files,
2. generate a Hyperprompt `.hc` file that references those Markdown files,
3. run the Hyperprompt compiler,
4. produce a final compiled `.md` context file that can be used to continue the conversation with an external agent.

ContextBuilder does not run LLMs, orchestrate agents, capture browser sessions, or parse raw HTML. It is a graph editor and context compiler over filesystem-backed conversation history.

## 2. Goals, Non-Goals, and Success Criteria

### 2.1 Goals

1. Represent related conversations as a navigable graph on a canvas rather than as unrelated flat files.
2. Allow the user to create new conversation files from checkpoints while preserving provenance.
3. Allow explicit merge conversations that reference multiple parent checkpoints without losing lineage.
4. Allow the user to select a specific branch or thought direction for continuation.
5. Compile the selected branch into a deterministic Hyperprompt project and final compiled Markdown context.
6. Keep the user oriented across refreshes and external file changes.
7. Allow imported historical conversations to participate in the same graph and compile pipeline.

### 2.2 Non-Goals

1. Running LLMs, agents, prompts, or tool execution inside ContextBuilder.
2. Building a semantic retrieval engine that infers links from unstructured corpora in v1.
3. Capturing browser tabs, scraping sites, or converting raw HTML into conversations.
4. Real-time collaboration, auth, permissions, or cloud sync.
5. Automatic semantic merging of message bodies across branches.
6. Automatic summarization or compression of the conversation graph in v1 unless explicitly added later.

### 2.3 Success Criteria

1. A user can visually identify where a conversation branched from and what related branches exist.
2. A user can create a new branch conversation from any checkpoint and the relationship remains intact after reload.
3. A user can select a branch of the graph and produce a compiled Markdown context without manual file assembly.
4. Re-running compilation for the same selected branch and unchanged inputs produces the same artifact structure and equivalent compiled output.
5. Imported conversations either enter the graph deterministically or fail with explicit validation errors.
6. `Cmd+R` restores the active graph context when the referenced nodes still exist.

## 3. Users and Jobs To Be Done

### 3.1 Primary Users

1. Individual LLM users exploring several lines of thought from one prompt.
2. Users of local or hosted AI agents who keep conversations in files and need to continue work from a chosen reasoning branch.
3. Researchers or operators who curate historical conversation trees and want deterministic continuation contexts.

### 3.2 Core Jobs

1. Understand how one conversation relates to other derived conversations.
2. Start a new branch from a precise checkpoint instead of duplicating entire transcripts manually.
3. Preserve provenance between related files so the graph remains trustworthy.
4. Select the exact line of reasoning that should continue with an external agent.
5. Export that reasoning path into a compiled context artifact without hand-building prompts.

## 4. Canonical Product Scope

### 4.1 Source of Truth

Conversation JSON files on disk are the product's source of truth. External agents or tools may append or modify conversations outside ContextBuilder. ContextBuilder must consume those files, validate them, write new branch or merge files when requested, and derive export artifacts from the current filesystem state.

### 4.2 Conversation Graph Model

The product model is a graph of conversation files and checkpoint links:

1. A **conversation** is a persisted JSON file.
2. A **message** is a node inside a conversation with a stable `message_id`.
3. A **checkpoint** is a message that can be used as a branch or merge reference.
4. A **branch link** connects a new conversation to one parent checkpoint.
5. A **merge link** connects a new conversation to two or more parent checkpoints.

### 4.3 Compilation Model

The compilation pipeline is a first-class product capability:

1. A **compile target** is a user-selected branch, path, or graph subset anchored at a conversation or checkpoint.
2. An **export node** is a generated Markdown file representing one selected conversation or message unit with provenance metadata.
3. A **Hyperprompt root file** is a generated `.hc` file that references the exported Markdown nodes in deterministic order and nesting.
4. A **compiled context artifact** is the final Markdown file emitted by the Hyperprompt compiler from the generated `.hc` file.

### 4.4 Minimum v1 Compile Semantics

To avoid ambiguity, v1 compile behavior must be deterministic and explicit:

1. Compiling a selected branch includes the ordered lineage path required to continue from the chosen point.
2. If a selected conversation has merge parents, the compiled context must preserve parent provenance explicitly instead of silently flattening their origin.
3. The system must not invent content, summarize content, or infer missing links during compilation.
4. The compiled artifact must be derived only from selected graph data and generated file references.

### 4.5 External Dependency

ContextBuilder depends on the Hyperprompt compiler as a local external tool. The compiler accepts a root `.hc` file and emits compiled Markdown. ContextBuilder must either invoke a configured `hyperprompt` executable or fail with an actionable local setup error.

## 5. Functional Requirements

| ID | Requirement | Rationale |
| --- | --- | --- |
| FR-1 | The system must index all valid conversation JSON files in the selected local directory and build an in-memory graph from `conversation_id`, `message_id`, and lineage references. | The graph and the compiler both depend on deterministic discovery of relationships. |
| FR-2 | The UI must render conversations and their lineage on a canvas that supports panning and selecting graph elements. | Visual orientation is the primary user problem. |
| FR-3 | Selecting a conversation on the canvas must reveal its messages, checkpoint metadata, parent links, and child links. | Users need both graph-level and transcript-level context. |
| FR-4 | The user must be able to create a new branch conversation from any checkpoint message. The new file must preserve the parent conversation and parent message identifiers. | Branching is a core authoring workflow. |
| FR-5 | The user must be able to create a merge-style conversation from multiple checkpoints. In v1, merge means multi-parent provenance, not transcript synthesis. | The graph must model convergence safely. |
| FR-6 | The user must be able to navigate from a conversation to its ancestor checkpoint, then to sibling or related branches derived from the same lineage. | Returning to the parent path is central to graph usability. |
| FR-7 | The system must accept externally prepared conversation files, classify them as valid roots or linked conversations, and surface validation errors for unsupported files. | Historical import is required. |
| FR-8 | Save operations must validate file names, required identifiers, parent references, and lineage metadata before persisting changes. Invalid data must not be written silently. | Broken lineage is the main data-loss risk. |
| FR-9 | Refreshing the page must restore the selected conversation, selected checkpoint when applicable, and canvas viewport when the referenced data still exists. | The user explicitly expects `Cmd+R` to be safe. |
| FR-10 | The product must allow the user to return to the file-backed state after external file changes by reloading or re-indexing without corrupting current data. | External tools are expected to modify files outside the app. |
| FR-11 | The user must be able to choose a compile target from the graph, at minimum the active branch or lineage path anchored at the current selection. | The final product value is choosing the direction of thought to continue. |
| FR-12 | The system must generate Markdown export nodes from the selected compile target, preserving source `conversation_id`, `message_id`, and message role alongside message content. | The Hyperprompt pipeline depends on file-based node materialization. |
| FR-13 | The system must generate a Hyperprompt `.hc` file that references the exported Markdown nodes in deterministic order and structure. | The Hyperprompt compiler requires a root file to compile. |
| FR-14 | The system must invoke the configured Hyperprompt compiler to produce a final compiled Markdown context artifact. | The compiled artifact is the user-facing continuation context. |
| FR-15 | The system must surface compile results, output paths, and actionable compiler failures to the user. | Users need to know whether the artifact is ready for agent continuation. |
| FR-16 | The compiled artifact must remain traceable to the originating graph selection and input files. | Provenance must not be lost during export. |

## 6. Data and Artifact Contract Requirements

### 6.1 Required Conversation-Level Fields

1. `conversation_id`: stable identifier for the conversation file.
2. `title`: human-readable conversation title.
3. `messages`: ordered list of message objects.
4. `lineage.parents`: zero or more parent references for root, branch, or merge conversations.

Common imported root conversations may also already contain:

1. `source_file`: original imported HTML or upstream source path

### 6.2 Required Message-Level Fields

1. `message_id`: stable identifier for the message.
2. `role`: at minimum `user`, `assistant`, `system`, or `tool`.
3. `content`: persisted message content.

Common imported messages may also already contain:

1. `turn_id`: upstream turn identifier that must be preserved if present
2. `source`: source anchor such as `conversation-turn-17`

If both `turn_id` and `message_id` exist, the system must not assume they are identical. Real imported examples show that they may diverge while both remain stable and meaningful.

### 6.3 Parent Reference Contract

Each parent reference must include:

1. `conversation_id`
2. `message_id`
3. `link_type` with value `branch` or `merge`

### 6.4 Exported Markdown Node Contract

Each generated Markdown node file must:

1. correspond deterministically to one exported graph unit,
2. preserve visible or machine-readable provenance for source conversation and message identity,
3. include the original message content without silent rewriting,
4. remain meaningful when opened as a standalone Markdown document.

When available in the source data, exported provenance should also preserve imported fields such as `source_file`, `turn_id`, and `source`.

### 6.5 Hyperprompt Root File Contract

The generated `.hc` file must:

1. use valid Hyperprompt syntax,
2. reference only generated `.md` or `.hc` files inside the chosen export root,
3. reflect the chosen branch structure in deterministic order,
4. avoid circular references by construction.

### 6.6 Compiled Artifact Contract

The compiled output must include:

1. one final Markdown file suitable as direct input context for a downstream LLM or agent,
2. clear provenance back to the selected graph branch or compile target,
3. deterministic structure for unchanged inputs and unchanged compiler version,
4. optional compiler manifest output when available and useful for diagnostics.

## 7. User Interaction Flows

### 7.1 Flow A: Open and Orient

1. User opens ContextBuilder against a local directory.
2. System indexes valid conversation files and builds the conversation graph.
3. User sees the canvas with root and derived conversations.
4. User selects a conversation node.
5. System shows transcript details, checkpoint metadata, and nearby lineage options.

### 7.2 Flow B: Branch From a Checkpoint

1. User opens an existing conversation.
2. User selects a message checkpoint.
3. User chooses `Create Branch`.
4. System asks for the new conversation file name and title.
5. System writes a new conversation file containing lineage metadata referencing the selected checkpoint.
6. System refreshes the graph and focuses the new branch.

### 7.3 Flow C: Merge Into a New Conversation

1. User selects two or more checkpoints from related conversations.
2. User chooses `Create Merge Conversation`.
3. System writes a new conversation file with multiple parent references.
4. System renders the new conversation as a node with multiple inbound edges.
5. System does not synthesize transcript content automatically.

### 7.4 Flow D: Compile Selected Branch Into Context

1. User selects the active conversation or checkpoint that represents the desired thought direction.
2. User chooses `Compile Context`.
3. System resolves the compile target into a deterministic ordered branch selection.
4. System generates Markdown node files under a local export directory.
5. System generates a root Hyperprompt `.hc` file that references those Markdown nodes.
6. System invokes the Hyperprompt compiler.
7. System produces a final compiled Markdown artifact and shows where it was written.
8. User uses the compiled file as the starting context for an external agent or LLM workflow.

### 7.5 Flow E: Refresh and Resume

1. User refreshes the browser tab with `Cmd+R`.
2. System reloads the graph from disk.
3. If the previously selected conversation and checkpoint still exist, the system restores the canvas position and selection.
4. If they no longer exist, the system restores the nearest valid state and explains what could not be restored.

## 8. Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | The product must run locally with no required cloud dependency for core functionality. |
| NFR-2 | The supported browser baseline for v1 is the latest stable desktop Safari and the latest stable desktop Chrome. |
| NFR-3 | Initial indexing of a workspace with up to 500 valid conversation files must complete in under 3 seconds on a typical modern developer laptop. |
| NFR-4 | Branch or merge file creation must complete in under 300 ms after the save request, excluding filesystem stalls outside the process. |
| NFR-5 | No save operation may silently sever an existing valid lineage reference. Validation failure must be blocking and user-visible. |
| NFR-6 | The application must remain usable after a hard refresh without requiring manual repair steps in the common case where files still exist. |
| NFR-7 | Broken references, duplicate IDs, and unsupported files must surface as explicit integrity issues instead of being hidden. |
| NFR-8 | The product must tolerate external file additions, edits, or deletions by allowing an explicit re-index or refresh without requiring application restart. |
| NFR-9 | Given unchanged inputs and unchanged compiler version, exported Markdown nodes and generated `.hc` files must be deterministic. |
| NFR-10 | Once the Hyperprompt compiler is configured locally, compiling a selected branch of up to 200 exported message nodes should complete in under 2 seconds on a typical modern developer laptop. |
| NFR-11 | Missing compiler binaries, compiler exit failures, and invalid generated file references must be surfaced as actionable errors with enough detail for local debugging. |

## 9. Edge Cases and Failure Scenarios

1. **Missing parent conversation file:** show the child conversation, mark the inbound link as broken, and provide a diagnostic error.
2. **Missing parent message inside an existing parent conversation:** keep the conversation visible, mark the link invalid, and block creation of further derived links from that broken reference.
3. **Duplicate `conversation_id` values across files:** refuse ambiguous indexing and show which files conflict.
4. **Duplicate `message_id` values inside the same lineage context:** flag integrity error and prevent ambiguous navigation.
5. **Imported file without stable identifiers:** reject or require normalization before graph inclusion.
6. **User refreshes while selected node was deleted externally:** restore the closest valid ancestor or graph root and show a notice.
7. **User attempts merge with duplicate or contradictory parent references:** block or collapse duplicates deterministically.
8. **Filesystem write fails while creating a branch:** do not create partial in-memory state that suggests success.
9. **Hyperprompt compiler binary is missing or not executable:** fail compilation with a local setup error and do not claim success.
10. **Generated `.hc` references a missing Markdown node file:** treat as compile failure and surface the failing reference.
11. **Compile target includes a merge node with several parents:** preserve explicit parent provenance in the export instead of flattening unlabeled content.
12. **External files change between graph selection and compile execution:** compile from the current indexed snapshot or force a re-index; do not mix stale and fresh state silently.

## 10. Assumptions and External Dependencies

1. Upstream agents or tools remain responsible for producing message content.
2. JSON files remain the only required conversation persistence layer for v1.
3. UI-specific restoration state such as viewport and last selection may be stored locally in the browser.
4. Merge behavior in v1 means lineage convergence, not content synthesis or conflict resolution.
5. The Hyperprompt compiler is available locally, either through a configured binary path or a documented repository-local setup.
6. Older historical conversations may require one-time normalization if they do not already provide stable identifiers.

## 11. Deliverables

1. Local HTTP API that exposes validated conversation graph data and safe file mutation operations.
2. Browser UI that renders the conversation graph on a canvas and supports branch, merge, and lineage navigation workflows.
3. Deterministic conversation file contract for roots, branches, and merge conversations.
4. Compile-target selection workflow for exporting a chosen reasoning branch.
5. Export pipeline that materializes Markdown nodes, generates a Hyperprompt `.hc`, and invokes Hyperprompt to produce a compiled Markdown context artifact.
6. Validation and integrity reporting for malformed inputs and compiler failures.
7. Documentation describing the graph model, file contract, Hyperprompt dependency, and local compile workflow.

## 12. Implementation Breakdown

This breakdown is intentionally execution-ready and traceable to the requirements above. It is not implementation code; it is the minimum task map that a planner or coding agent can refine into a workplan.

### Phase 1: Canonical Graph Data Model

| ID | Task | Priority | Effort | Dependencies | Parallelizable | Tools / Surfaces | Outputs / Artifacts | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-T1 | Define canonical conversation and lineage schema for roots, branches, and merges. | High | M | none | no | `README.md`, server contract, JSON fixtures | schema rules, example files, validation checklist | Sample files for root, branch, and merge validate against documented contract. |
| P1-T2 | Normalize imported conversations into explicit roots or linked conversations based on stable identifiers. | High | M | P1-T1 | yes | server import logic, fixtures | normalization rules and diagnostics | Imported files become roots or fail explicitly; no ambiguous lineage is accepted. |
| P1-T3 | Add integrity validation for duplicate IDs, missing parents, invalid filenames, and malformed lineage payloads. | High | M | P1-T1 | yes | [viewer/server.py](/Users/egor/Development/GitHub/0AL/ContextBuilder/viewer/server.py), tests | validation path and diagnostics | Invalid fixtures fail with actionable errors; valid fixtures remain unaffected. |
| P1-T4 | Build a deterministic graph index that resolves conversations, checkpoints, edges, and broken-link diagnostics. | High | M | P1-T2, P1-T3 | no | [viewer/server.py](/Users/egor/Development/GitHub/0AL/ContextBuilder/viewer/server.py) | graph indexing logic and graph payload model | Mixed fixtures produce correct roots, edges, merges, and integrity warnings. |
| P1-T5 | Expose graph-aware API contracts for the UI and compile pipeline. | High | M | P1-T4 | no | server API, tests | graph read endpoints or payload extensions | The client can fetch graph data, node metadata, checkpoint metadata, and blocking issues through the API. |

### Phase 2: Graph Navigation and Selection UX

| ID | Task | Priority | Effort | Dependencies | Parallelizable | Tools / Surfaces | Outputs / Artifacts | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-T1 | Replace the flat file list mental model with a canvas graph view that renders conversations and lineage edges. | High | L | P1-T5 | no | [viewer/index.html](/Users/egor/Development/GitHub/0AL/ContextBuilder/viewer/index.html) | graph canvas UI | Users can visually distinguish roots, branches, merges, and broken links. |
| P2-T2 | Add conversation detail and checkpoint inspection panels tied to graph selection state. | High | M | P2-T1 | no | viewer UI | detail panel and transcript inspection UI | Selecting a node reveals messages, parent info, child links, and checkpoint actions. |
| P2-T3 | Implement ancestor and sibling lineage navigation actions. | High | S | P2-T2 | yes | viewer UI | lineage navigation controls | User can jump to parent checkpoints and navigate to sibling branches without manual file lookup. |
| P2-T4 | Preserve graph context across hard refresh. | Medium | S | P2-T1, P2-T2 | yes | viewer UI, browser storage | restoration behavior | `Cmd+R` returns the user to the same graph context when data still exists. |
| P2-T5 | Surface integrity issues and compile-blocking conditions directly in the graph UI. | Medium | S | P1-T3, P2-T1 | yes | viewer UI | graph-level diagnostics UI | Broken lineage and invalid inputs are visible and actionable from the canvas. |

### Phase 3: Authoring and Compile Target Selection

| ID | Task | Priority | Effort | Dependencies | Parallelizable | Tools / Surfaces | Outputs / Artifacts | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P3-T1 | Implement branch creation from a checkpoint with safe filename handling and parent metadata persistence. | High | M | P1-T5, P2-T2 | no | API write path, viewer UI | branch creation workflow | New file appears in graph with correct single-parent lineage after save and reload. |
| P3-T2 | Implement merge conversation creation from multiple checkpoints using explicit multi-parent metadata. | High | M | P1-T5, P2-T2 | no | API write path, viewer UI | merge creation workflow | New merge node renders with multiple inbound edges and preserved provenance. |
| P3-T3 | Define the compile-target selection model and export workspace layout. | High | M | P1-T5, P2-T2 | no | server contract, viewer UI | compile-target model, deterministic export directory contract | The system can represent a chosen branch selection and where its artifacts will be written. |
| P3-T4 | Let the user choose the active branch or lineage path as a compile target from the UI. | High | M | P3-T3 | no | viewer UI | compile selection actions and selection state | User can mark a concrete thought direction for compilation without manual file assembly. |
| P3-T5 | Support re-indexing and refresh after external file additions, edits, or deletions. | Medium | M | P1-T4, P2-T1 | yes | API and UI refresh flows | refresh/re-index controls | External file changes appear after refresh without restarting the application. |

### Phase 4: Hyperprompt Export and Compilation

| ID | Task | Priority | Effort | Dependencies | Parallelizable | Tools / Surfaces | Outputs / Artifacts | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P4-T1 | Export selected graph nodes into deterministic Markdown files with provenance metadata. | High | M | P3-T3, P3-T4 | no | export layer, filesystem | generated `.md` node files | Repeated export of unchanged inputs yields identical Markdown node files. |
| P4-T2 | Generate a valid Hyperprompt root `.hc` file that references the exported Markdown nodes in deterministic order. | High | M | P4-T1 | no | export layer, filesystem | generated `.hc` file | The root file conforms to Hyperprompt syntax and references only generated export files. |
| P4-T3 | Integrate Hyperprompt compiler invocation through a configured local executable or documented local setup. | High | M | P4-T2 | no | compiler integration, subprocess execution | compiled context `.md`, optional manifest, compile diagnostics | Successful compile produces a final Markdown artifact; compiler failures surface actionable diagnostics. |
| P4-T4 | Expose compile results, artifact locations, and failure states in the UI and API. | High | S | P4-T3 | yes | viewer UI, API | compile result screen or panel | User can locate the generated `.hc` and final compiled `.md` without inspecting the filesystem manually. |
| P4-T5 | Preserve provenance from compiled artifact back to the selected graph branch. | Medium | S | P4-T1, P4-T3 | yes | export metadata, artifact structure | traceability metadata | A user can determine which graph selection produced a given compiled context artifact. |

### Phase 5: Hardening, Tests, and Documentation

| ID | Task | Priority | Effort | Dependencies | Parallelizable | Tools / Surfaces | Outputs / Artifacts | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P5-T1 | Add automated tests for schema validation, graph indexing, and integrity failures. | High | M | P1-T5 | yes | [tests/test_smoke.py](/Users/egor/Development/GitHub/0AL/ContextBuilder/tests/test_smoke.py) and new tests | graph validation coverage | Duplicate IDs, missing parents, and malformed lineage are covered by automated tests. |
| P5-T2 | Add automated tests for branch, merge, and compile-target selection workflows. | High | M | P3-T4 | yes | tests, fixtures | authoring and selection coverage | Critical authoring flows fail fast when lineage behavior regresses. |
| P5-T3 | Add automated tests for Markdown export, `.hc` generation, and Hyperprompt compile integration. | High | M | P4-T4 | yes | tests, Hyperprompt-backed fixtures | export and compile coverage | The pipeline catches broken references, invalid compiler setup, and incorrect artifact generation. |
| P5-T4 | Update documentation to describe the graph model, file contract, Hyperprompt dependency, and compile workflow. | Medium | S | P4-T4 | yes | [README.md](/Users/egor/Development/GitHub/0AL/ContextBuilder/README.md) and supporting docs | updated product docs | A contributor can understand how ContextBuilder turns graph selections into compiled context artifacts. |
| P5-T5 | Add end-to-end verification guidance for preparing a compiled context artifact and handing it to an external agent. | Medium | S | P5-T3, P5-T4 | yes | docs, manual verification notes | operator guidance | A user can follow the documented local workflow from JSON conversations to final compiled context output. |

## 13. Acceptance Summary

The PRD is satisfied when:

1. ContextBuilder can load a local directory of conversation files and represent them as a lineage graph on a canvas.
2. Branch and merge conversations can be created from existing checkpoints without losing provenance.
3. A user can select a concrete reasoning branch and compile it into a Hyperprompt-backed Markdown context artifact.
4. The compile pipeline materializes Markdown nodes, generates a valid `.hc`, runs Hyperprompt, and produces a final compiled `.md`.
5. Refresh and external file changes do not normally disorient the user or silently corrupt lineage.
6. Invalid writes, ambiguous graph states, and compiler failures are surfaced explicitly and block false-success flows.
