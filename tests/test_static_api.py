import io
import json
import tempfile
from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from viewer import static_api


class FakeHandler:
    def __init__(self, repo_root: Path | None = None, body: bytes = b"") -> None:
        self.server = SimpleNamespace(repo_root=repo_root)
        self.headers = {"Content-Length": str(len(body))}
        self.rfile = io.BytesIO(body)
        self.wfile = io.BytesIO()
        self.status: int | None = None
        self.headers_sent: list[tuple[str, str]] = []
        self.error: tuple[int, str | None] | None = None

    def send_response(self, code: int, message: str | None = None) -> None:
        self.status = code

    def send_header(self, keyword: str, value: str) -> None:
        self.headers_sent.append((keyword, value))

    def end_headers(self) -> None:
        pass

    def send_error(self, code: int, message: str | None = None) -> None:
        self.error = (code, message)


def response_body(handler: FakeHandler) -> dict:
    return json.loads(handler.wfile.getvalue().decode("utf-8"))


def test_handle_static_rejects_sibling_dist_prefix_escape() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        repo_root = Path(tmp)
        dist_dir = repo_root / "viewer" / "app" / "dist"
        sibling_dir = repo_root / "viewer" / "app" / "dist2"
        dist_dir.mkdir(parents=True)
        sibling_dir.mkdir(parents=True)
        (dist_dir / "index.html").write_text("<!DOCTYPE html>", encoding="utf-8")
        (sibling_dir / "secret.txt").write_text("secret", encoding="utf-8")
        handler = FakeHandler(repo_root=repo_root)

        static_api.handle_static(handler, "/../dist2/secret.txt")

    assert handler.error == (HTTPStatus.NOT_FOUND, None)
    assert handler.wfile.getvalue() == b""


def test_handle_reveal_returns_not_implemented_without_macos_open() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "file.txt"
        target.write_text("ok", encoding="utf-8")
        body = json.dumps({"path": str(target)}).encode("utf-8")
        handler = FakeHandler(body=body)

        with patch("viewer.static_api.sys.platform", "linux"), patch("viewer.static_api.shutil.which", return_value=None):
            static_api.handle_reveal(handler)

    assert handler.status == HTTPStatus.NOT_IMPLEMENTED
    assert response_body(handler) == {"error": "Reveal is only available on macOS."}
