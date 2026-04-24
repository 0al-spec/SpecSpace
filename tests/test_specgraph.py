"""Tests for viewer/specgraph.py — YAML spec ingestion, graph construction, and API endpoints."""

import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError
from urllib.request import urlopen

import yaml

from viewer import server, specgraph


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def write_yaml(directory: Path, name: str, data: dict) -> Path:
    path = directory / name
    path.write_text(yaml.dump(data, allow_unicode=True), encoding="utf-8")
    return path


MINIMAL_SPEC: dict = {
    "id": "SG-SPEC-0001",
    "title": "Test Spec",
    "kind": "spec",
    "status": "specified",
    "maturity": 0.5,
    "depends_on": [],
    "relates_to": [],
}


# ---------------------------------------------------------------------------
# load_spec_nodes
# ---------------------------------------------------------------------------


class LoadSpecNodesTests(unittest.TestCase):
    def test_loads_valid_yaml(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_yaml(d, "SG-SPEC-0001.yaml", MINIMAL_SPEC)

            nodes, errors = specgraph.load_spec_nodes(d)

        self.assertEqual(len(nodes), 1)
        self.assertEqual(len(errors), 0)
        self.assertEqual(nodes[0]["id"], "SG-SPEC-0001")

    def test_attaches_file_name(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_yaml(d, "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            nodes, _ = specgraph.load_spec_nodes(d)

        self.assertEqual(nodes[0]["_file_name"], "SG-SPEC-0001.yaml")

    def test_preserves_unknown_fields(self) -> None:
        spec = dict(MINIMAL_SPEC)
        spec["future_field"] = "some_value"
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_yaml(d, "SG-SPEC-0001.yaml", spec)
            nodes, _ = specgraph.load_spec_nodes(d)

        self.assertIn("future_field", nodes[0])
        self.assertEqual(nodes[0]["future_field"], "some_value")

    def test_reports_malformed_yaml(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "bad.yaml").write_text("key: [unclosed", encoding="utf-8")
            nodes, errors = specgraph.load_spec_nodes(d)

        self.assertEqual(len(nodes), 0)
        self.assertEqual(len(errors), 1)
        self.assertIn("bad.yaml", errors[0]["file_name"])

    def test_reports_non_mapping_yaml(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "list.yaml").write_text("- item1\n- item2\n", encoding="utf-8")
            nodes, errors = specgraph.load_spec_nodes(d)

        self.assertEqual(len(nodes), 0)
        self.assertEqual(len(errors), 1)

    def test_loads_multiple_files_sorted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_yaml(d, "SG-SPEC-0002.yaml", {**MINIMAL_SPEC, "id": "SG-SPEC-0002"})
            write_yaml(d, "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            nodes, _ = specgraph.load_spec_nodes(d)

        self.assertEqual(len(nodes), 2)
        # Files are returned in sorted order
        self.assertEqual(nodes[0]["id"], "SG-SPEC-0001")
        self.assertEqual(nodes[1]["id"], "SG-SPEC-0002")

    def test_ignores_non_yaml_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_yaml(d, "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            (d / "notes.txt").write_text("ignore me", encoding="utf-8")
            (d / "data.json").write_text('{"id": "ignored"}', encoding="utf-8")
            nodes, errors = specgraph.load_spec_nodes(d)

        self.assertEqual(len(nodes), 1)
        self.assertEqual(len(errors), 0)

    def test_empty_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            nodes, errors = specgraph.load_spec_nodes(Path(tmp))
        self.assertEqual(nodes, [])
        self.assertEqual(errors, [])


# ---------------------------------------------------------------------------
# build_spec_graph
# ---------------------------------------------------------------------------


class BuildSpecGraphTests(unittest.TestCase):
    def test_single_node_no_edges(self) -> None:
        nodes = [{**MINIMAL_SPEC, "_file_name": "SG-SPEC-0001.yaml"}]
        graph = specgraph.build_spec_graph(nodes)

        self.assertEqual(len(graph["nodes"]), 1)
        self.assertEqual(len(graph["edges"]), 0)
        self.assertEqual(graph["roots"], ["SG-SPEC-0001"])

    def test_depends_on_creates_edge(self) -> None:
        parent = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "depends_on": ["SG-SPEC-0002"], "_file_name": "a.yaml"}
        child = {**MINIMAL_SPEC, "id": "SG-SPEC-0002", "depends_on": [], "_file_name": "b.yaml"}
        graph = specgraph.build_spec_graph([parent, child])

        edge_ids = [e["edge_id"] for e in graph["edges"]]
        self.assertIn("SG-SPEC-0001__depends_on__SG-SPEC-0002", edge_ids)
        self.assertEqual(graph["edges"][0]["status"], "resolved")

    def test_refines_creates_edge(self) -> None:
        child = {**MINIMAL_SPEC, "id": "SG-SPEC-0002", "refines": ["SG-SPEC-0001"], "_file_name": "b.yaml"}
        parent = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "_file_name": "a.yaml"}
        graph = specgraph.build_spec_graph([child, parent])

        kinds = {e["edge_kind"] for e in graph["edges"]}
        self.assertIn("refines", kinds)

    def test_relates_to_creates_edge(self) -> None:
        spec = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "relates_to": ["SG-SPEC-0002"], "_file_name": "a.yaml"}
        other = {**MINIMAL_SPEC, "id": "SG-SPEC-0002", "_file_name": "b.yaml"}
        graph = specgraph.build_spec_graph([spec, other])

        kinds = {e["edge_kind"] for e in graph["edges"]}
        self.assertIn("relates_to", kinds)

    def test_missing_edge_target_is_broken(self) -> None:
        spec = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "depends_on": ["NONEXISTENT"], "_file_name": "a.yaml"}
        graph = specgraph.build_spec_graph([spec])

        broken = [e for e in graph["edges"] if e["status"] == "broken"]
        self.assertEqual(len(broken), 1)
        self.assertEqual(broken[0]["target_id"], "NONEXISTENT")

    def test_missing_edge_target_creates_diagnostic(self) -> None:
        spec = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "depends_on": ["GHOST"], "_file_name": "a.yaml"}
        graph = specgraph.build_spec_graph([spec])

        edge_diags = [d for d in graph["diagnostics"] if d.get("scope") == "edge"]
        self.assertEqual(len(edge_diags), 1)
        self.assertIn("GHOST", edge_diags[0]["message"])

    def test_roots_are_nodes_not_refined_by_others(self) -> None:
        # SG-SPEC-0001 is refined by 0002 → NOT a root
        # SG-SPEC-0002 refines 0001 → 0002 IS a root (nothing refines it)
        parent = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "_file_name": "a.yaml"}
        child = {**MINIMAL_SPEC, "id": "SG-SPEC-0002", "refines": ["SG-SPEC-0001"], "_file_name": "b.yaml"}
        graph = specgraph.build_spec_graph([parent, child])

        self.assertIn("SG-SPEC-0002", graph["roots"])
        self.assertNotIn("SG-SPEC-0001", graph["roots"])

    def test_node_missing_id_is_blocked(self) -> None:
        bad = {"title": "No ID", "kind": "spec", "_file_name": "bad.yaml"}
        graph = specgraph.build_spec_graph([bad])

        self.assertEqual(len(graph["nodes"]), 0)
        self.assertEqual(len(graph["blocked_files"]), 1)

    def test_duplicate_id_is_blocked(self) -> None:
        a = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "_file_name": "a.yaml"}
        b = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "_file_name": "b.yaml"}
        graph = specgraph.build_spec_graph([a, b])

        self.assertEqual(len(graph["nodes"]), 1)
        self.assertEqual(len(graph["blocked_files"]), 1)

    def test_load_errors_propagated_to_diagnostics(self) -> None:
        nodes: list = []
        load_errors = [{"file_name": "bad.yaml", "message": "YAML parse error"}]
        graph = specgraph.build_spec_graph(nodes, load_errors)

        file_diags = [d for d in graph["diagnostics"] if d.get("scope") == "file"]
        self.assertTrue(any("bad.yaml" in str(d) for d in file_diags))

    def test_summary_counts(self) -> None:
        a = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "depends_on": ["SG-SPEC-0002"], "_file_name": "a.yaml"}
        b = {**MINIMAL_SPEC, "id": "SG-SPEC-0002", "_file_name": "b.yaml"}
        graph = specgraph.build_spec_graph([a, b])
        s = graph["summary"]

        self.assertEqual(s["node_count"], 2)
        self.assertEqual(s["edge_count"], 1)
        self.assertEqual(s["broken_edge_count"], 0)

    def test_scalar_depends_on_is_coerced_to_list(self) -> None:
        spec = {**MINIMAL_SPEC, "id": "SG-SPEC-0001", "depends_on": "SG-SPEC-0002", "_file_name": "a.yaml"}
        other = {**MINIMAL_SPEC, "id": "SG-SPEC-0002", "_file_name": "b.yaml"}
        graph = specgraph.build_spec_graph([spec, other])

        self.assertEqual(len(graph["edges"]), 1)
        self.assertEqual(graph["edges"][0]["status"], "resolved")


# ---------------------------------------------------------------------------
# get_spec_node_detail
# ---------------------------------------------------------------------------


class GetSpecNodeDetailTests(unittest.TestCase):
    def test_returns_node_by_id(self) -> None:
        nodes = [{**MINIMAL_SPEC, "_file_name": "a.yaml"}]
        detail = specgraph.get_spec_node_detail(nodes, "SG-SPEC-0001")
        self.assertIsNotNone(detail)
        self.assertEqual(detail["id"], "SG-SPEC-0001")

    def test_strips_internal_file_name_key(self) -> None:
        nodes = [{**MINIMAL_SPEC, "_file_name": "a.yaml"}]
        detail = specgraph.get_spec_node_detail(nodes, "SG-SPEC-0001")
        self.assertNotIn("_file_name", detail)

    def test_returns_none_for_missing_id(self) -> None:
        nodes = [{**MINIMAL_SPEC, "_file_name": "a.yaml"}]
        result = specgraph.get_spec_node_detail(nodes, "NONEXISTENT")
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# collect_spec_graph_api (integration)
# ---------------------------------------------------------------------------


class CollectSpecGraphApiTests(unittest.TestCase):
    def test_integration_with_real_specs(self) -> None:
        """Smoke test: load the actual SpecGraph nodes from the sibling repo."""
        spec_dir = Path(__file__).resolve().parent.parent.parent / "SpecGraph" / "specs" / "nodes"
        if not spec_dir.exists():
            self.skipTest("SpecGraph sibling repo not present")

        result = specgraph.collect_spec_graph_api(spec_dir)

        self.assertIn("graph", result)
        self.assertIn("summary", result)
        graph = result["graph"]
        self.assertGreater(graph["summary"]["node_count"], 0)
        # All 3 known spec nodes should be loaded
        node_ids = {n["node_id"] for n in graph["nodes"]}
        self.assertIn("SG-SPEC-0001", node_ids)
        self.assertIn("SG-SPEC-0002", node_ids)
        self.assertIn("SG-SPEC-0003", node_ids)

    def test_empty_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = specgraph.collect_spec_graph_api(Path(tmp))

        self.assertEqual(result["graph"]["summary"]["node_count"], 0)
        self.assertEqual(result["graph"]["summary"]["edge_count"], 0)


# ---------------------------------------------------------------------------
# API endpoint tests (HTTP layer)
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent


def start_spec_test_server(
    dialog_dir: Path,
    spec_dir: Optional[Path] = None,
    compile_available: bool = False,
) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = ""
    httpd.compile_available = compile_available
    httpd.spec_dir = spec_dir
    httpd.spec_watcher = server.SpecWatcher(spec_dir) if spec_dir else None
    httpd.specgraph_dir = None
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, thread, f"http://127.0.0.1:{httpd.server_port}"


def stop_test_server(httpd: ThreadingHTTPServer, thread: threading.Thread) -> None:
    httpd.shutdown()
    thread.join()
    httpd.server_close()


class CapabilitiesEndpointTests(unittest.TestCase):
    def test_spec_graph_false_when_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_spec_test_server(Path(tmp), spec_dir=None)
            try:
                body = json.loads(urlopen(f"{base}/api/capabilities").read())
            finally:
                stop_test_server(httpd, thread)

        self.assertFalse(body["spec_graph"])

    def test_spec_graph_true_when_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                body = json.loads(urlopen(f"{base}/api/capabilities").read())
            finally:
                stop_test_server(httpd, thread)

        self.assertTrue(body["spec_graph"])

    def test_compile_false_when_binary_unavailable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_spec_test_server(Path(tmp), compile_available=False)
            try:
                body = json.loads(urlopen(f"{base}/api/capabilities").read())
            finally:
                stop_test_server(httpd, thread)

        self.assertIn("compile", body)
        self.assertFalse(body["compile"])

    def test_compile_true_when_binary_available(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_spec_test_server(Path(tmp), compile_available=True)
            try:
                body = json.loads(urlopen(f"{base}/api/capabilities").read())
            finally:
                stop_test_server(httpd, thread)

        self.assertIn("compile", body)
        self.assertTrue(body["compile"])


class SpecGraphEndpointTests(unittest.TestCase):
    def test_returns_404_when_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_spec_test_server(Path(tmp), spec_dir=None)
            try:
                with self.assertRaises(HTTPError) as ctx:
                    urlopen(f"{base}/api/spec-graph")
            finally:
                stop_test_server(httpd, thread)

        self.assertEqual(ctx.exception.code, 404)

    def test_returns_graph_when_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                body = json.loads(urlopen(f"{base}/api/spec-graph").read())
            finally:
                stop_test_server(httpd, thread)

        self.assertIn("graph", body)
        self.assertEqual(body["graph"]["summary"]["node_count"], 1)

    def test_response_shape_matches_conversation_graph(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                body = json.loads(urlopen(f"{base}/api/spec-graph").read())
            finally:
                stop_test_server(httpd, thread)

        graph = body["graph"]
        self.assertIn("nodes", graph)
        self.assertIn("edges", graph)
        self.assertIn("roots", graph)
        self.assertIn("summary", graph)


class SpecNodeEndpointTests(unittest.TestCase):
    def test_returns_404_when_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_spec_test_server(Path(tmp), spec_dir=None)
            try:
                with self.assertRaises(HTTPError) as ctx:
                    urlopen(f"{base}/api/spec-node?id=SG-SPEC-0001")
            finally:
                stop_test_server(httpd, thread)

        self.assertEqual(ctx.exception.code, 404)

    def test_returns_node_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                body = json.loads(urlopen(f"{base}/api/spec-node?id=SG-SPEC-0001").read())
            finally:
                stop_test_server(httpd, thread)

        self.assertEqual(body["node_id"], "SG-SPEC-0001")
        self.assertIn("data", body)
        self.assertEqual(body["data"]["title"], MINIMAL_SPEC["title"])

    def test_returns_404_for_unknown_node(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                with self.assertRaises(HTTPError) as ctx:
                    urlopen(f"{base}/api/spec-node?id=NONEXISTENT")
            finally:
                stop_test_server(httpd, thread)

        self.assertEqual(ctx.exception.code, 404)

    def test_returns_400_for_missing_id_param(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                with self.assertRaises(HTTPError) as ctx:
                    urlopen(f"{base}/api/spec-node")
            finally:
                stop_test_server(httpd, thread)

        self.assertEqual(ctx.exception.code, 400)


class SpecWatcherUnitTests(unittest.TestCase):
    """Unit tests for SpecWatcher — no HTTP server needed."""

    def test_subscribe_starts_poll_thread(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            watcher = server.SpecWatcher(Path(tmp))
            self.assertIsNone(watcher._thread)
            watcher.subscribe()
            try:
                self.assertIsNotNone(watcher._thread)
                self.assertTrue(watcher._thread.is_alive())
            finally:
                watcher.unsubscribe()

    def test_subscribe_returns_current_seq(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            watcher = server.SpecWatcher(Path(tmp))
            seq = watcher.subscribe()
            try:
                self.assertIsInstance(seq, int)
                self.assertEqual(seq, 0)
            finally:
                watcher.unsubscribe()

    def test_multiple_subscribes_increment_client_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            watcher = server.SpecWatcher(Path(tmp))
            watcher.subscribe()
            watcher.subscribe()
            try:
                self.assertEqual(watcher._client_count, 2)
            finally:
                watcher.unsubscribe()
                watcher.unsubscribe()

    def test_unsubscribe_decrements_client_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            watcher = server.SpecWatcher(Path(tmp))
            watcher.subscribe()
            watcher.subscribe()
            watcher.unsubscribe()
            self.assertEqual(watcher._client_count, 1)
            watcher.unsubscribe()
            self.assertEqual(watcher._client_count, 0)

    def test_unsubscribe_never_goes_negative(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            watcher = server.SpecWatcher(Path(tmp))
            watcher.unsubscribe()  # without subscribe
            self.assertEqual(watcher._client_count, 0)

    def test_wait_for_change_detects_new_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            watcher = server.SpecWatcher(tmp_path)
            last_seq = watcher.subscribe()
            try:
                # Write a YAML file after a short delay in a background thread
                def write_after_delay() -> None:
                    import time as _time
                    _time.sleep(watcher.POLL_INTERVAL * 1.5)
                    (tmp_path / "spec.yaml").write_text("id: test\n")

                writer = threading.Thread(target=write_after_delay, daemon=True)
                writer.start()

                changed, new_seq = watcher.wait_for_change(last_seq)
                writer.join(timeout=5)

                self.assertTrue(changed, "Expected change to be detected")
                self.assertGreater(new_seq, last_seq)
            finally:
                watcher.unsubscribe()

    def test_wait_for_change_returns_false_on_timeout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            watcher = server.SpecWatcher(Path(tmp))
            # Use a very short timeout so the test doesn't block
            watcher.KEEPALIVE_TIMEOUT = 0.1  # type: ignore[assignment]
            last_seq = watcher.subscribe()
            try:
                changed, new_seq = watcher.wait_for_change(last_seq)
                self.assertFalse(changed, "No files changed — should return False")
                self.assertEqual(new_seq, last_seq)
            finally:
                watcher.unsubscribe()

    def test_change_notifies_multiple_waiters(self) -> None:
        """All subscribed clients should see the same change event."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            watcher = server.SpecWatcher(tmp_path)
            seq_a = watcher.subscribe()
            seq_b = watcher.subscribe()

            results: list[tuple[bool, int]] = []
            barrier = threading.Barrier(3)  # 2 waiters + main

            def waiter(last_seq: int) -> None:
                barrier.wait()
                results.append(watcher.wait_for_change(last_seq))

            t1 = threading.Thread(target=waiter, args=(seq_a,), daemon=True)
            t2 = threading.Thread(target=waiter, args=(seq_b,), daemon=True)
            t1.start()
            t2.start()
            barrier.wait()  # all waiters are blocking

            import time as _time
            _time.sleep(watcher.POLL_INTERVAL * 1.5)
            (tmp_path / "spec.yaml").write_text("id: x\n")

            t1.join(timeout=5)
            t2.join(timeout=5)
            watcher.unsubscribe()
            watcher.unsubscribe()

            self.assertEqual(len(results), 2)
            self.assertTrue(results[0][0], "Waiter A should see change")
            self.assertTrue(results[1][0], "Waiter B should see change")
            self.assertEqual(results[0][1], results[1][1], "Both see same seq")


class SpecWatchEndpointTests(unittest.TestCase):
    """Integration tests for GET /api/spec-watch SSE endpoint."""

    def test_returns_404_when_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_spec_test_server(Path(tmp), spec_dir=None)
            try:
                with self.assertRaises(HTTPError) as ctx:
                    urlopen(f"{base}/api/spec-watch")
            finally:
                stop_test_server(httpd, thread)
        self.assertEqual(ctx.exception.code, 404)

    def test_sends_connected_comment_on_open(self) -> None:
        import socket
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                port = httpd.server_port
                sock = socket.create_connection(("127.0.0.1", port), timeout=3)
                try:
                    sock.sendall(
                        b"GET /api/spec-watch HTTP/1.1\r\n"
                        b"Host: localhost\r\n"
                        b"Accept: text/event-stream\r\n"
                        b"Connection: close\r\n\r\n"
                    )
                    # Read until we see the connected comment
                    buf = b""
                    sock.settimeout(3)
                    while b": connected" not in buf:
                        chunk = sock.recv(256)
                        if not chunk:
                            break
                        buf += chunk
                    self.assertIn(b": connected", buf)
                finally:
                    sock.close()
            finally:
                stop_test_server(httpd, thread)

    def test_client_registered_and_unregistered(self) -> None:
        """Subscribing via /api/spec-watch increments and then decrements client count.

        The handler unsubscribes only when it next tries to write (keepalive or
        change event) and gets a BrokenPipeError.  We use a very short keepalive
        timeout on the watcher so the test does not have to wait 14 seconds.
        """
        import socket, time as _time
        with tempfile.TemporaryDirectory() as tmp_dialog, tempfile.TemporaryDirectory() as tmp_spec:
            write_yaml(Path(tmp_spec), "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = start_spec_test_server(Path(tmp_dialog), spec_dir=Path(tmp_spec))
            try:
                watcher: server.SpecWatcher = httpd.spec_watcher  # type: ignore[attr-defined]
                # Short keepalive so the handler wakes up and detects disconnect quickly
                watcher.KEEPALIVE_TIMEOUT = 0.3  # type: ignore[assignment]
                port = httpd.server_port
                sock = socket.create_connection(("127.0.0.1", port), timeout=3)
                try:
                    sock.sendall(
                        b"GET /api/spec-watch HTTP/1.1\r\n"
                        b"Host: localhost\r\n"
                        b"Accept: text/event-stream\r\n"
                        b"Connection: close\r\n\r\n"
                    )
                    # Wait for the connected comment so we know subscribe() ran
                    buf = b""
                    sock.settimeout(3)
                    while b": connected" not in buf:
                        chunk = sock.recv(256)
                        if not chunk:
                            break
                        buf += chunk
                    _time.sleep(0.05)
                    self.assertEqual(watcher._client_count, 1)
                finally:
                    sock.close()

                # Handler detects disconnect when keepalive fires (≤ 0.3 s + write latency)
                deadline = _time.monotonic() + 3.0
                while watcher._client_count > 0 and _time.monotonic() < deadline:
                    _time.sleep(0.05)
                self.assertEqual(watcher._client_count, 0)
            finally:
                stop_test_server(httpd, thread)


if __name__ == "__main__":
    unittest.main()
