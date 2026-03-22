# ContextBuilder

ContextBuilder is the local viewer/editor repository for already extracted dialog JSON files.

It does not capture browser tabs and it does not parse raw HTML. Its job is narrower:

- serve a local HTTP API over a directory of dialog JSON files
- provide a browser UI for browsing and editing those files

## Quick Start

Point the viewer at a directory containing extracted dialog JSON files, for example `ChatGPTDialogs/import_json/`:

```bash
make serve DIALOG_DIR=/absolute/path/to/ChatGPTDialogs/import_json
```

Then open:

```text
http://localhost:8000/viewer/index.html
```

You can also run the server directly:

```bash
python3 viewer/server.py --port 8000 --dialog-dir /absolute/path/to/dialogs
```

## File Contract

ContextBuilder currently supports imported root conversations in the shape produced by `ChatGPTDialogs` and defines a stricter canonical shape for conversations created and normalized by ContextBuilder itself.

### Imported Root Format

Current imported examples under `real_examples/import_json/` use this shape:

```json
{
  "title": "Conversation Title",
  "source_file": "/absolute/path/to/file.html",
  "message_count": 42,
  "messages": [
    {
      "role": "user",
      "content": "..."
    },
    {
      "role": "assistant",
      "content": "..."
    }
  ]
}
```

In the current imported data:

- top-level files do not yet include `conversation_id`
- top-level files do not yet include lineage metadata
- messages include `message_id`
- messages may also include `turn_id` and `source`

Important: `message_id` and `turn_id` must not be assumed equivalent. Real imported examples show they may differ while both remain stable and meaningful.

Imported files are treated as compatible root conversations. They can be indexed and viewed immediately, but they require normalization before they become canonical branch or merge conversations in the graph.

### Canonical Conversation Format

Canonical conversations created or normalized by ContextBuilder must follow this shape:

```json
{
  "conversation_id": "conv-trust-social-root",
  "title": "Trust Social Root Conversation",
  "source_file": "/absolute/path/to/file.html",
  "messages": [
    {
      "message_id": "msg-root-1",
      "role": "user",
      "content": "Outline the concept.",
      "turn_id": "turn-root-1",
      "source": "conversation-turn-1"
    }
  ],
  "lineage": {
    "parents": []
  }
}
```

Canonical message semantics:

- `message_id` is the canonical message anchor for graph lineage and exported context artifacts
- `turn_id` is preserved imported provenance when available
- `source` is a stable imported source anchor when available

### Canonical Branch Format

Branch conversations are canonical conversations with exactly one parent reference:

```json
{
  "conversation_id": "conv-branding-branch",
  "title": "Branding Branch",
  "messages": [
    {
      "message_id": "msg-branch-1",
      "role": "user",
      "content": "Continue from the protocol naming checkpoint."
    }
  ],
  "lineage": {
    "parents": [
      {
        "conversation_id": "conv-trust-social-root",
        "message_id": "msg-root-2",
        "link_type": "branch"
      }
    ]
  }
}
```

### Canonical Merge Format

Merge conversations are canonical conversations with two or more parent references:

```json
{
  "conversation_id": "conv-contextbuilder-merge",
  "title": "Context Compiler Merge",
  "messages": [
    {
      "message_id": "msg-merge-1",
      "role": "user",
      "content": "Combine graph selection with Hyperprompt compilation."
    }
  ],
  "lineage": {
    "parents": [
      {
        "conversation_id": "conv-trust-social-root",
        "message_id": "msg-root-2",
        "link_type": "merge"
      },
      {
        "conversation_id": "conv-branding-branch",
        "message_id": "msg-branch-2",
        "link_type": "merge"
      }
    ]
  }
}
```

### Schema Notes

- Imported roots remain valid inputs even when `conversation_id` is missing.
- Canonical files created by ContextBuilder must include `conversation_id`.
- `lineage.parents` is mandatory for canonical files and empty only for canonical roots.
- Parent references always use `conversation_id`, `message_id`, and `link_type`.
- ContextBuilder preserves imported provenance such as `source_file`, `turn_id`, and `source` when exporting to downstream artifacts.

The intended upstream producer is `ChatGPTDialogs`, but any directory with the same JSON contract is valid.

## Repository Layout

- `viewer/server.py`: local viewer API and static file server
- `viewer/index.html`: browser UI for browsing and editing dialogs
- `Makefile`: local server entrypoint

## Scope Boundary

- `ChatGPTDialogs`: extractor, fixtures, HTML-to-JSON contract docs
- `ContextBuilder`: viewer-web and viewer-api
- `capture-browser`: separate concern, intentionally not part of this repository
