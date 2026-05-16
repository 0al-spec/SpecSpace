# Quickstart

This quickstart is for the legacy ContextBuilder conversation application
(`viewer/app`). For SpecSpace/GraphSpace deployment and local Docker smoke, use
[`SPECSPACE_DEPLOYMENT.md`](SPECSPACE_DEPLOYMENT.md) and
[`TIMEWEB_DEPLOYMENT.md`](TIMEWEB_DEPLOYMENT.md).

## Update Canonical JSONs & Run the Server

### 1. Canonicalize

```bash
cd /Users/egor/Development/GitHub/0AL/ContextBuilder
PATH="/opt/homebrew/bin:$PATH" make canonicalize \
  DIALOG_DIR=/Users/egor/Development/GitHub/ChatGPTDialogs/import_json \
  OUTPUT_DIR=/Users/egor/Development/GitHub/ChatGPTDialogs/canonical_json
```

### 2. Start / Restart servers

If servers are already running, kill the API first:

```bash
lsof -ti:8001 | xargs kill 2>/dev/null; true
```

Then start both:

**Option A — via Claude Code preview:**
- Start `Python API`
- Start `ContextBuilder Viewer`

**Option B — manually in terminal:**

```bash
cd /Users/egor/Development/GitHub/0AL/ContextBuilder

# API (background)
python3 viewer/server.py --port 8001 \
  --dialog-dir /Users/egor/Development/GitHub/ChatGPTDialogs/canonical_json &

# UI
PATH="/opt/homebrew/bin:$PATH" npm run dev --prefix viewer/app -- --host 127.0.0.1 --port 5173
```

### 3. Open the app

```
http://127.0.0.1:5173
```

---

**Tip:** If you only added new dialogs to `import_json`, just repeat step 1 — the canonicalizer overwrites the output dir. Then restart the API (step 2) and refresh the browser.
