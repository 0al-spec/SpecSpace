import json
import tempfile
from pathlib import Path

import pytest

from viewer import workspace_io


REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURES = REPO_ROOT / "real_examples" / "canonical_json"


def load_canonical(name: str) -> dict:
    return json.loads((CANONICAL_FIXTURES / name).read_text(encoding="utf-8"))


def test_dialog_path_for_name_rejects_escape() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        dialog_dir = Path(tmp).resolve()

        with pytest.raises(ValueError):
            workspace_io.dialog_path_for_name(dialog_dir, "../escape.json")


def test_load_json_file_rejects_non_object_json() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "payload.json"
        path.write_text("[]", encoding="utf-8")

        payload, errors = workspace_io.load_json_file(path)

    assert payload is None
    assert [error.code for error in errors] == ["invalid_payload"]


def test_build_workspace_listing_uses_injected_loader() -> None:
    calls: list[str] = []
    payload = load_canonical("root_conversation.json")

    def load_json_file(path: Path):
        calls.append(path.name)
        return payload, ()

    with tempfile.TemporaryDirectory() as tmp:
        dialog_dir = Path(tmp)
        (dialog_dir / "conversation.json").write_text("{}", encoding="utf-8")

        listing = workspace_io.build_workspace_listing(dialog_dir, load_json_file=load_json_file)

    assert calls == ["conversation.json"]
    assert listing["files"][0]["name"] == "conversation.json"
    assert listing["files"][0]["validation"]["ok"] is True


def test_validate_write_request_uses_existing_workspace_payloads() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        dialog_dir = Path(tmp)
        root_payload = load_canonical("root_conversation.json")
        branch_payload = load_canonical("branch_conversation.json")
        (dialog_dir / "existing.json").write_text(json.dumps(root_payload), encoding="utf-8")

        normalized, errors = workspace_io.validate_write_request(
            dialog_dir,
            "new.json",
            branch_payload,
            overwrite=False,
        )

    assert errors == ()
    assert normalized is not None
    assert normalized["conversation_id"] == "conv-trust-social-branding-branch"
