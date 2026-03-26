# Canonicalizing Conversations

This guide explains how to canonicalize imported conversation JSON files so they become graph-ready with stable identifiers and explicit lineage metadata.

## What is Canonicalization?

Imported JSON files from [ChatGPTDialogs](https://github.com/0AL/ChatGPTDialogs) contain raw conversation data:
- No stable `conversation_id`
- No lineage metadata (`parents`, `branch_type`)
- Missing or inconsistent identifiers

**Canonicalization** transforms these into canonical conversations that ContextBuilder can index and graph:
- Assigns deterministic `conversation_id` values
- Injects lineage metadata (parent references, link types)
- Validates schema integrity
- Writes normalized files ready for graph indexing

## Prerequisites

- Python 3.11+
- Source directory with imported JSON files
- (Optional) `lineage.json` manifest defining parent-child relationships

## Quick Start

### Without a Lineage Manifest

If your conversations are independent roots (no parent-child relationships), canonicalize them as roots:

```bash
python3 viewer/canonicalize.py /path/to/import_json /path/to/output_canonical
```

This:
1. Reads all `.json` files from `/path/to/import_json`
2. Assigns deterministic `conversation_id` values based on file metadata
3. Adds `lineage: { parents: [] }` to each
4. Writes canonical JSON to `/path/to/output_canonical`
5. Validates schema on each file

### With a Lineage Manifest

If conversations have parent-child relationships, create a `lineage.json` manifest in the source directory:

```bash
python3 viewer/canonicalize.py /path/to/import_json /path/to/output_canonical
```

The script reads `lineage.json` and injects parent metadata into each conversation.

## Lineage Manifest Format

Create a `lineage.json` file in your import directory with this structure:

```json
{
  "generated_by": "detect_lineage.py",
  "file_count": 3,
  "root_count": 1,
  "branch_count": 2,
  "conversations": [
    {
      "conversation_id": "root-conversation",
      "file": "root_conversation.json",
      "message_count": 50
    },
    {
      "conversation_id": "branch-1",
      "file": "branch_1.json",
      "message_count": 20,
      "lineage": {
        "parents": [
          {
            "conversation_id": "root-conversation",
            "message_id": "msg-123",
            "link_type": "branch"
          }
        ]
      }
    },
    {
      "conversation_id": "merge-1",
      "file": "merge_1.json",
      "message_count": 15,
      "lineage": {
        "parents": [
          {
            "conversation_id": "root-conversation",
            "message_id": "msg-123",
            "link_type": "merge"
          },
          {
            "conversation_id": "branch-1",
            "message_id": "msg-456",
            "link_type": "merge"
          }
        ]
      }
    }
  ]
}
```

### Manifest Fields

| Field | Required | Description |
|-------|----------|-------------|
| `conversation_id` | yes | Stable identifier for the conversation (must be unique) |
| `file` | yes | Filename in the import directory |
| `message_count` | yes | Total number of messages (for validation) |
| `lineage` | no | Parent references; omit for root conversations |

### Parent Reference Fields

| Field | Description |
|-------|-------------|
| `conversation_id` | Parent conversation ID (must exist in manifest) |
| `message_id` | Exact `message_id` of the parent checkpoint |
| `link_type` | `branch` (single parent) or `merge` (multiple parents) |

## Example: SpecGraph Conversations

The SpecGraph project has a `lineage.json` already configured:

```bash
python3 viewer/canonicalize.py \
  /Users/egor/Development/GitHub/ChatGPTDialogs/import_json \
  /tmp/specgraph_canonical
```

This produces 29 canonical conversations with 14 roots and 15 connected branches.

## Output

Canonicalization produces:
- **Canonical JSON files** in `output_canonical/` with stable `conversation_id` and `lineage` metadata
- **Console output** showing success/error counts:
  ```
  Canonicalize complete: 29 written, 0 errors
  ```

## Schema Validation

Each canonicalized file is validated against ContextBuilder's schema:
- `conversation_id` must be non-empty string
- `messages` array with each message having stable `message_id`
- `lineage.parents` list with valid parent references
- Single-parent conversations use `link_type: "branch"`
- Multi-parent conversations use `link_type: "merge"`

If validation fails, the file is skipped and an error is printed:
```
ERROR filename.json: [duplicate_conversation_id] Conversation ID already exists
```

## Next Steps

After canonicalization, point ContextBuilder to the canonical directory:

```bash
make serve DIALOG_DIR=/tmp/specgraph_canonical
# or
python3 viewer/server.py --port 8000 --dialog-dir /tmp/specgraph_canonical
```

The viewer will:
1. Index all conversations and build a lineage graph
2. Resolve parent-child edges
3. Render the graph on the canvas with connected nodes and branches

## Troubleshooting

### Missing `lineage.json`

If you don't have a `lineage.json`, conversations are canonicalized as independent roots:
```bash
python3 viewer/canonicalize.py /path/to/import /path/to/output
```

### Parent not found

If a parent `conversation_id` in the manifest doesn't exist, you'll see an error like:
```
ERROR branch.json: [missing_parent] Parent conversation not found
```

Check that the parent is listed in the manifest under `conversations`.

### Message ID mismatch

Parent references must point to exact `message_id` values in the parent conversation. If the message doesn't exist, the parent edge will be marked as broken (visible in the graph as a warning).

### Deterministic IDs

If you're creating your own `conversation_id` values, ensure they're:
- Unique across all conversations in the manifest
- Stable (same ID each time you canonicalize)
- Human-readable if possible (helps debugging)

Good examples: `specgraph-openspec-tasks`, `trust-social-bluesky`, `agent-system-metrics`

## Advanced: Creating a Lineage Manifest

If you don't have a `lineage.json`, you can create one manually by examining your conversations:

1. Open each JSON file and note the `title` and first/last `message_id`
2. Identify which conversations are roots (no parents) and which are branches
3. For each branch, find the exact `message_id` it branches from in its parent
4. Structure the manifest as shown above
5. Run canonicalization to validate

Or, if ChatGPTDialogs has a `detect_lineage.py` script, use that to auto-generate the manifest.
