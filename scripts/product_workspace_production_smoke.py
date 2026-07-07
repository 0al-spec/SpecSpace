#!/usr/bin/env python3
"""Read-only production smoke for SpecSpace product workspaces."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Union


JsonObject = dict[str, Any]
Fetcher = Callable[[str, bool], tuple[int, Union[JsonObject, str]]]


WRITE_AUTHORITY_KEYS = {
    "may_accept_ontology_terms",
    "may_apply_answers",
    "may_apply_decisions",
    "may_apply_state",
    "may_create_branch_or_commit",
    "may_execute_git_service",
    "may_execute_git_service_operation",
    "may_execute_platform",
    "may_execute_specgraph",
    "may_import_into_specgraph",
    "may_merge_review",
    "may_mutate_candidate_artifacts",
    "may_mutate_candidate_source_artifacts",
    "may_mutate_canonical_specs",
    "may_open_pull_request",
    "may_publish_read_model",
    "may_run_make_target_from_request",
    "may_write_ontology_lockfile",
    "may_write_ontology_package",
}

LEGACY_SHELL_MARKERS = (
    "<title>ContextBuilder</title>",
    "ContextBuilder Viewer",
    "ContextBuilder conversation",
    "legacy ContextBuilder",
)


@dataclass(frozen=True)
class SmokeConfig:
    base_url: str
    workspace: str
    artifact_base: str | None
    expect_managed_mode: str
    timeout_seconds: float
    require_deployment_metadata: bool = True
    require_demo_view: bool = True


def _join_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _workspace_api_path(workspace: str) -> str:
    return "/api/v1/idea-to-spec-workspace?" + urllib.parse.urlencode(
        {"workspace": workspace}
    )


def _default_fetch(timeout_seconds: float) -> Fetcher:
    def fetch(url: str, expect_json: bool) -> tuple[int, JsonObject | str]:
        with urllib.request.urlopen(url, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8", errors="replace")
            if expect_json:
                parsed = json.loads(body)
                if not isinstance(parsed, dict):
                    raise ValueError(f"{url} returned non-object JSON")
                return response.status, parsed
            return response.status, body

    return fetch


def _wait_fetch(
    fetch: Fetcher,
    url: str,
    *,
    expect_json: bool,
    timeout_seconds: float,
) -> tuple[int, JsonObject | str]:
    deadline = time.time() + timeout_seconds
    last_error: BaseException | None = None
    while time.time() < deadline:
        try:
            return fetch(url, expect_json)
        except (
            ConnectionError,
            TimeoutError,
            ValueError,
            urllib.error.URLError,
            json.JSONDecodeError,
        ) as exc:
            last_error = exc
            time.sleep(1)
    raise RuntimeError(f"timed out reading {url}: {last_error}")


def _as_dict(value: Any) -> JsonObject:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _add_error(errors: list[JsonObject], check: str, message: str) -> None:
    errors.append({"check": check, "message": message})


def _false_authority_errors(value: Any, prefix: str = "") -> list[JsonObject]:
    errors: list[JsonObject] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            if (key in WRITE_AUTHORITY_KEYS or key.startswith("may_")) and child is not False:
                _add_error(
                    errors,
                    "authority_boundary",
                    f"{child_prefix} must be literally false",
                )
            errors.extend(_false_authority_errors(child, child_prefix))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            child_prefix = f"{prefix}[{index}]" if prefix else f"[{index}]"
            errors.extend(_false_authority_errors(child, child_prefix))
    return errors


def validate_smoke_payloads(
    config: SmokeConfig,
    *,
    health: JsonObject,
    workspace_payload: JsonObject,
    shell_html: str,
    demo_view_html: str | None = None,
) -> JsonObject:
    errors: list[JsonObject] = []
    warnings: list[JsonObject] = []

    if health.get("api_version") != "v1":
        _add_error(errors, "health", "/api/v1/health must report api_version v1")
    deployment = _as_dict(health.get("deployment"))
    if config.require_deployment_metadata:
        if not deployment.get("commit") and not deployment.get("version"):
            _add_error(
                errors,
                "health",
                "deployment.commit or deployment.version is required",
            )

    if "<html" not in shell_html.lower():
        _add_error(errors, "app_shell", "workspace route did not return an HTML shell")
    for marker in LEGACY_SHELL_MARKERS:
        if marker in shell_html:
            _add_error(
                errors,
                "app_shell",
                f"workspace route contains legacy marker {marker!r}",
            )
    if config.require_demo_view:
        if not isinstance(demo_view_html, str):
            _add_error(errors, "demo_view", "demo view route was not fetched")
        else:
            if "<html" not in demo_view_html.lower():
                _add_error(
                    errors,
                    "demo_view",
                    "demo view route did not return an HTML shell",
                )
            for marker in LEGACY_SHELL_MARKERS:
                if marker in demo_view_html:
                    _add_error(
                        errors,
                        "demo_view",
                        f"demo view route contains legacy marker {marker!r}",
                    )

    selected_workspace = workspace_payload.get("selected_workspace_id")
    workspace = _as_dict(workspace_payload.get("workspace"))
    workspace_id = workspace.get("id")
    if workspace_id != config.workspace:
        _add_error(
            errors,
            "workspace",
            f"artifact workspace.id must be {config.workspace!r}",
        )
    if selected_workspace is not None and selected_workspace != config.workspace:
        _add_error(
            errors,
            "workspace",
            f"selected_workspace_id must be {config.workspace!r}",
        )

    source = _as_dict(workspace_payload.get("source"))
    provider = source.get("provider")
    if provider != "http-product-workspace":
        _add_error(
            errors,
            "product_provider",
            "product workspace must use http-product-workspace provider",
        )
    artifact_base_url = source.get("artifact_base_url")
    if config.artifact_base is not None and artifact_base_url != config.artifact_base:
        _add_error(
            errors,
            "product_provider",
            f"artifact_base_url must be {config.artifact_base!r}",
        )
    if isinstance(artifact_base_url, str) and artifact_base_url.rstrip("/") == config.base_url.rstrip("/"):
        _add_error(
            errors,
            "product_provider",
            "product artifact base must not point at the SpecSpace app root",
        )

    readiness = _as_dict(workspace_payload.get("managed_mode_readiness"))
    if readiness.get("status") != config.expect_managed_mode:
        _add_error(
            errors,
            "managed_mode_readiness",
            f"managed mode must be {config.expect_managed_mode!r}",
        )
    if readiness.get("mode") != config.expect_managed_mode:
        _add_error(
            errors,
            "managed_mode_readiness",
            f"managed mode field must be {config.expect_managed_mode!r}",
        )
    executor = _as_dict(readiness.get("executor"))
    if config.expect_managed_mode == "read_only":
        if executor.get("enabled") is not False:
            _add_error(errors, "managed_mode_readiness", "executor.enabled must be false")
        if executor.get("configured") is not False:
            _add_error(
                errors,
                "managed_mode_readiness",
                "executor.configured must be false",
            )
        operation_counts = _as_dict(
            readiness.get("operation_counts") or readiness.get("operations")
        )
        enabled_count = operation_counts.get("enabled")
        if enabled_count is None:
            enabled_count = operation_counts.get("enabled_count")
        if enabled_count != 0:
            _add_error(
                errors,
                "managed_mode_readiness",
                "read-only production must not enable managed operations",
            )

    observability = _as_dict(
        workspace_payload.get("managed_operations_observability")
    )
    operation_rows = _as_list(observability.get("operations"))
    if not operation_rows:
        _add_error(
            errors,
            "managed_operations",
            "managed operations observability must list operations",
        )

    errors.extend(_false_authority_errors(readiness, "managed_mode_readiness"))
    errors.extend(
        _false_authority_errors(observability, "managed_operations_observability")
    )

    return {
        "artifact_kind": "specspace_product_workspace_production_smoke_report",
        "schema_version": 1,
        "ok": not errors,
        "summary": {
            "status": "passed" if not errors else "failed",
            "workspace": config.workspace,
            "managed_mode": readiness.get("status"),
            "provider": provider,
            "artifact_base_url": artifact_base_url,
            "operation_count": len(operation_rows),
            "error_count": len(errors),
            "warning_count": len(warnings),
        },
        "checks": {
            "health": {
                "api_version": health.get("api_version"),
                "deployment": {
                    "version_present": bool(deployment.get("version")),
                    "commit_present": bool(deployment.get("commit")),
                },
            },
            "workspace": {
                "selected_workspace_id": selected_workspace,
                "workspace_id": workspace.get("id"),
            },
            "managed_mode_readiness": {
                "status": readiness.get("status"),
                "mode": readiness.get("mode"),
                "executor_enabled": executor.get("enabled"),
                "executor_configured": executor.get("configured"),
            },
            "managed_operations": {
                "operation_count": len(operation_rows),
            },
            "demo_view": {
                "checked": config.require_demo_view,
                "html_shell": isinstance(demo_view_html, str)
                and "<html" in demo_view_html.lower(),
            },
        },
        "errors": errors,
        "warnings": warnings,
    }


def run_smoke(config: SmokeConfig, fetch: Fetcher | None = None) -> JsonObject:
    fetcher = fetch or _default_fetch(config.timeout_seconds)
    health_status, health_payload = _wait_fetch(
        fetcher,
        _join_url(config.base_url, "/api/v1/health"),
        expect_json=True,
        timeout_seconds=config.timeout_seconds,
    )
    workspace_status, workspace_payload = _wait_fetch(
        fetcher,
        _join_url(config.base_url, _workspace_api_path(config.workspace)),
        expect_json=True,
        timeout_seconds=config.timeout_seconds,
    )
    shell_status, shell_payload = _wait_fetch(
        fetcher,
        _join_url(config.base_url, f"/{config.workspace}"),
        expect_json=False,
        timeout_seconds=config.timeout_seconds,
    )
    demo_view_payload: JsonObject | str | None = None
    demo_view_status = 200
    if config.require_demo_view:
        demo_view_status, demo_view_payload = _wait_fetch(
            fetcher,
            _join_url(config.base_url, f"/{config.workspace}?view=demo"),
            expect_json=False,
            timeout_seconds=config.timeout_seconds,
        )

    if health_status != 200:
        raise RuntimeError(f"health endpoint returned HTTP {health_status}")
    if workspace_status != 200:
        raise RuntimeError(
            f"product workspace endpoint returned HTTP {workspace_status}"
        )
    if shell_status != 200:
        raise RuntimeError(f"workspace route returned HTTP {shell_status}")
    if not isinstance(health_payload, dict):
        raise RuntimeError("health endpoint returned non-object JSON")
    if not isinstance(workspace_payload, dict):
        raise RuntimeError("product workspace endpoint returned non-object JSON")
    if not isinstance(shell_payload, str):
        raise RuntimeError("workspace route returned non-text payload")
    if config.require_demo_view:
        if demo_view_status != 200:
            raise RuntimeError(f"demo view route returned HTTP {demo_view_status}")
        if not isinstance(demo_view_payload, str):
            raise RuntimeError("demo view route returned non-text payload")

    return validate_smoke_payloads(
        config,
        health=health_payload,
        workspace_payload=workspace_payload,
        shell_html=shell_payload,
        demo_view_html=demo_view_payload if isinstance(demo_view_payload, str) else None,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run read-only production smoke checks for a SpecSpace product workspace.",
    )
    parser.add_argument("--base-url", required=True, help="SpecSpace base URL.")
    parser.add_argument(
        "--workspace",
        default="team-decision-log",
        help="Product workspace id. Defaults to team-decision-log.",
    )
    parser.add_argument(
        "--artifact-base",
        default=None,
        help="Expected product workspace artifact base URL.",
    )
    parser.add_argument(
        "--expect-managed-mode",
        default="read_only",
        help="Expected managed_mode_readiness.status.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=60.0,
        help="Total wait timeout per endpoint in seconds.",
    )
    parser.add_argument(
        "--no-require-deployment-metadata",
        action="store_true",
        help="Do not require deployment.version and deployment.commit.",
    )
    parser.add_argument(
        "--no-require-demo-view",
        action="store_true",
        help="Do not require the product workspace ?view=demo route to return the SpecSpace shell.",
    )
    parser.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Output format.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = SmokeConfig(
        base_url=args.base_url,
        workspace=args.workspace,
        artifact_base=args.artifact_base,
        expect_managed_mode=args.expect_managed_mode,
        timeout_seconds=args.timeout,
        require_deployment_metadata=not args.no_require_deployment_metadata,
        require_demo_view=not args.no_require_demo_view,
    )
    try:
        report = run_smoke(config)
    except Exception as exc:  # pragma: no cover - exercised by CLI users.
        report = {
            "artifact_kind": "specspace_product_workspace_production_smoke_report",
            "schema_version": 1,
            "ok": False,
            "summary": {
                "status": "failed",
                "workspace": config.workspace,
                "error_count": 1,
            },
            "errors": [{"check": "transport", "message": str(exc)}],
            "warnings": [],
        }

    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        summary = _as_dict(report.get("summary"))
        print(
            "SpecSpace product workspace production smoke: "
            f"{summary.get('status')} "
            f"workspace={summary.get('workspace')} "
            f"managed_mode={summary.get('managed_mode')} "
            f"provider={summary.get('provider')}"
        )
        for error in _as_list(report.get("errors")):
            if isinstance(error, dict):
                print(f"ERROR [{error.get('check')}]: {error.get('message')}", file=sys.stderr)
        for warning in _as_list(report.get("warnings")):
            if isinstance(warning, dict):
                print(
                    f"WARN [{warning.get('check')}]: {warning.get('message')}",
                    file=sys.stderr,
                )
    return 0 if report.get("ok") is True else 1


if __name__ == "__main__":
    raise SystemExit(main())
