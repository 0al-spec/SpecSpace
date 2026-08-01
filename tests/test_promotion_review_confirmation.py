from __future__ import annotations

from datetime import timedelta
from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

from viewer import (
    operator_auth,
    promotion_review_confirmation,
    specspace_state_backend,
)


WORKSPACE_ID = "pantry-control"
REQUEST_FRAGMENT = "0123456789abcdef01234567"
INPUT_DIGESTS = {
    promotion_review_confirmation.PROMOTION_REQUEST_REF: "1" * 64,
    promotion_review_confirmation.APPROVAL_DECISION_REF: "2" * 64,
    promotion_review_confirmation.EXECUTION_PLAN_REF: "3" * 64,
}


def ready_binding() -> dict:
    return {
        "available": True,
        "status": "ready",
        "trusted": True,
        "workspace_id": WORKSPACE_ID,
        "binding_id": f"product-workspace-binding://{WORKSPACE_ID}",
        "binding_revision_sha256": "4" * 64,
        "source_ref": "runs/platform_product_workspace_initialization_execution_report.json",
        "source_sha256": "5" * 64,
        "identity": {
            "workspace_id": WORKSPACE_ID,
            "route": f"/{WORKSPACE_ID}",
            "repository_role": "product_spec_workspace",
        },
        "routing": {
            "specspace_state_namespace_ref": f"specspace-state://workspace/{WORKSPACE_ID}",
            "platform_default_run_dir_ref": f"runs/{WORKSPACE_ID}",
            "product_artifact_bundle_ref": f"workspaces/{WORKSPACE_ID}",
        },
        "repository": {
            "repository_role": "product_spec_workspace",
            "workspace_identity": WORKSPACE_ID,
            "worktree_identity": f"product-workspace/{WORKSPACE_ID}",
            "creates_worktree": False,
        },
        "authority_boundary": {
            "report_only": True,
            "workspace_binding_is_execution_authority": False,
            "may_execute_platform": False,
        },
    }


class CatalogProvider:
    def __init__(self, digests: dict[str, str] | None = None) -> None:
        self.digests = dict(digests or INPUT_DIGESTS)

    def read_artifact_catalog(self) -> tuple[HTTPStatus, dict]:
        return HTTPStatus.OK, {
            "artifacts": [
                {
                    "path": f"runs/{WORKSPACE_ID}/{logical_ref.removeprefix('runs/')}",
                    "sha256": sha256,
                }
                for logical_ref, sha256 in self.digests.items()
            ]
        }


def hosted_execution(
    *,
    status: str = "succeeded",
    input_digests: dict[str, str] | None = None,
) -> dict:
    inputs = INPUT_DIGESTS if input_digests is None else input_digests
    return {
        "operations": {
            promotion_review_confirmation.DRY_RUN_OPERATION_ID: {
                "request_id": (
                    f"managed-operation://{WORKSPACE_ID}/"
                    f"promotion_execute_dry_run/{REQUEST_FRAGMENT}"
                ),
                "operation_id": promotion_review_confirmation.DRY_RUN_OPERATION_ID,
                "workspace_id": WORKSPACE_ID,
                "status": status,
                "attempt": 1,
                "binding_id": f"product-workspace-binding://{WORKSPACE_ID}",
                "binding_revision_sha256": "4" * 64,
                "input_digests": [
                    {"logical_ref": ref, "sha256": sha256}
                    for ref, sha256 in inputs.items()
                ],
                "output_reports": [
                    {
                        "logical_ref": (
                            "runs/managed-promotion-dry-runs/"
                            f"{REQUEST_FRAGMENT}."
                            "product_candidate_promotion_execution_report.json"
                        ),
                        "sha256": "6" * 64,
                    },
                    {
                        "logical_ref": (
                            "runs/managed-promotion-dry-runs/"
                            f"{REQUEST_FRAGMENT}."
                            "git_service_promotion_execution_report.json"
                        ),
                        "sha256": "7" * 64,
                    },
                ],
            }
        }
    }


class PromotionReviewConfirmationTests(unittest.TestCase):
    def runtime(self, root: Path, *, authenticated: bool = True) -> SimpleNamespace:
        return SimpleNamespace(
            repo_root=root,
            specspace_state_dir=root / "state",
            operator_auth_enabled=authenticated,
            operator_auth_username="operator" if authenticated else None,
            operator_auth_password_digest=(
                operator_auth.password_digest("secret") if authenticated else None
            ),
        )

    def test_authors_exact_short_lived_platform_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            status, response = promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={"workspace_id": WORKSPACE_ID, "confirmed": True},
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )
            pointer = specspace_state_backend.read_state_record(
                runtime,
                (
                    f"confirmations/{WORKSPACE_ID}/"
                    "promotion_review_execute/latest.json"
                ),
                workspace_id=WORKSPACE_ID,
            )
            confirmation_ref = pointer["content"]["confirmation_ref"]
            confirmation_record = specspace_state_backend.read_state_record(
                runtime,
                confirmation_ref.removeprefix("specspace-state://"),
                workspace_id=WORKSPACE_ID,
            )
            confirmation = confirmation_record["content"]

        self.assertEqual(status, HTTPStatus.CREATED)
        self.assertTrue(response["ok"])
        self.assertEqual(response["status"], "ready")
        self.assertEqual(
            set(confirmation),
            promotion_review_confirmation.CONFIRMATION_FIELDS,
        )
        self.assertEqual(
            confirmation["artifact_kind"],
            promotion_review_confirmation.CONFIRMATION_KIND,
        )
        self.assertEqual(
            confirmation["contract_ref"],
            promotion_review_confirmation.CONFIRMATION_CONTRACT_REF,
        )
        self.assertEqual(confirmation["inputs"]["promotion_request"], {
            "logical_ref": promotion_review_confirmation.PROMOTION_REQUEST_REF,
            "sha256": "1" * 64,
        })
        self.assertEqual(
            confirmation["predecessor_dry_run"]["request_id"],
            (
                f"managed-operation://{WORKSPACE_ID}/"
                f"promotion_execute_dry_run/{REQUEST_FRAGMENT}"
            ),
        )
        self.assertEqual(
            confirmation["authority_boundary"],
            promotion_review_confirmation.AUTHORITY_BOUNDARY,
        )
        issued_at = promotion_review_confirmation._parse_time(
            confirmation["issued_at"]
        )
        expires_at = promotion_review_confirmation._parse_time(
            confirmation["expires_at"]
        )
        self.assertEqual((expires_at - issued_at).total_seconds(), 600)

    def test_reuses_current_ready_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            arguments = {
                "workspace_id": WORKSPACE_ID,
                "payload": {"workspace_id": WORKSPACE_ID, "confirmed": True},
                "provider": CatalogProvider(),
                "binding": ready_binding(),
                "hosted_execution": hosted_execution(),
            }
            first_status, first = promotion_review_confirmation.author_confirmation(
                runtime,
                **arguments,
            )
            second_status, second = promotion_review_confirmation.author_confirmation(
                runtime,
                **arguments,
            )

        self.assertEqual(first_status, HTTPStatus.CREATED)
        self.assertTrue(first["created"])
        self.assertEqual(second_status, HTTPStatus.OK)
        self.assertFalse(second["created"])
        self.assertEqual(
            second["confirmation"]["confirmation_id"],
            first["confirmation"]["confirmation_id"],
        )

    def test_rejects_browser_supplied_identity_or_authority_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            status, response = promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={
                    "workspace_id": WORKSPACE_ID,
                    "confirmed": True,
                    "operator_ref": "operator://spoofed",
                    "may_open_pull_request": True,
                },
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )

        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            response["reason"],
            "promotion_review_confirmation_payload_invalid",
        )

    def test_rejects_non_object_browser_payload(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            status, response = promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload=[],
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )

        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertEqual(
            response["reason"],
            "promotion_review_confirmation_payload_invalid",
        )

    def test_requires_authenticated_operator_profile(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir), authenticated=False)
            status, response = promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={"workspace_id": WORKSPACE_ID, "confirmed": True},
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )

        self.assertEqual(status, HTTPStatus.CONFLICT)
        self.assertIn("authenticated_operator_profile_required", response["blockers"])

    def test_requires_dry_run_digests_for_current_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            status, response = promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={"workspace_id": WORKSPACE_ID, "confirmed": True},
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(input_digests={}),
            )

        self.assertEqual(status, HTTPStatus.CONFLICT)
        self.assertIn(
            "promotion_dry_run_input_digests_missing_or_stale",
            response["blockers"],
        )

    def test_expired_confirmation_is_not_ready_for_enqueue(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={"workspace_id": WORKSPACE_ID, "confirmed": True},
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )
            projection = promotion_review_confirmation.workspace_projection(
                runtime,
                workspace_id=WORKSPACE_ID,
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
                now=promotion_review_confirmation.utc_now()
                + timedelta(minutes=11),
            )

        self.assertEqual(projection["status"], "expired")
        self.assertTrue(projection["can_author"])

    def test_consumed_confirmation_is_terminal_and_not_reused(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={"workspace_id": WORKSPACE_ID, "confirmed": True},
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )
            original_read = specspace_state_backend.read_state_record

            def consumed_read(server, record_key, *, workspace_id):
                record = original_read(
                    server,
                    record_key,
                    workspace_id=workspace_id,
                )
                if record is not None and not record_key.endswith("latest.json"):
                    record = {**record, "lifecycle_state": "consumed"}
                return record

            with patch.object(
                specspace_state_backend,
                "read_state_record",
                side_effect=consumed_read,
            ):
                ready, projection = (
                    promotion_review_confirmation.ready_confirmation(
                        runtime,
                        workspace_id=WORKSPACE_ID,
                        provider=CatalogProvider(),
                        binding=ready_binding(),
                        hosted_execution=hosted_execution(),
                    )
                )

        self.assertIsNone(ready)
        self.assertEqual(projection["status"], "consumed")
        self.assertFalse(projection["can_author"])

    def test_future_dated_confirmation_is_not_ready_for_enqueue(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={"workspace_id": WORKSPACE_ID, "confirmed": True},
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )
            current_time = promotion_review_confirmation.utc_now()
            projection = promotion_review_confirmation.workspace_projection(
                runtime,
                workspace_id=WORKSPACE_ID,
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
                now=current_time - timedelta(minutes=1),
            )

        self.assertEqual(projection["status"], "stale")
        self.assertIn(
            "promotion_review_confirmation_not_yet_valid",
            projection["blockers"],
        )

    def test_ready_confirmation_returns_server_authored_ref_and_operator(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runtime = self.runtime(Path(temp_dir))
            promotion_review_confirmation.author_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                payload={"workspace_id": WORKSPACE_ID, "confirmed": True},
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )
            ready, projection = promotion_review_confirmation.ready_confirmation(
                runtime,
                workspace_id=WORKSPACE_ID,
                provider=CatalogProvider(),
                binding=ready_binding(),
                hosted_execution=hosted_execution(),
            )

        self.assertEqual(projection["status"], "ready")
        self.assertTrue(ready["confirmation_ref"].startswith("specspace-state://"))
        self.assertTrue(ready["operator_ref"].startswith("operator://specspace-basic-"))


if __name__ == "__main__":
    unittest.main()
