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

ContextBuilder expects one `.json` file per dialog with this minimum shape:

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

Each message may also include `turn_id`, `message_id`, and `source`.

The intended upstream producer is `ChatGPTDialogs`, but any directory with the same JSON contract is valid.

## Repository Layout

- `viewer/server.py`: local viewer API and static file server
- `viewer/index.html`: browser UI for browsing and editing dialogs
- `Makefile`: local server entrypoint

## Scope Boundary

- `ChatGPTDialogs`: extractor, fixtures, HTML-to-JSON contract docs
- `ContextBuilder`: viewer-web and viewer-api
- `capture-browser`: separate concern, intentionally not part of this repository
