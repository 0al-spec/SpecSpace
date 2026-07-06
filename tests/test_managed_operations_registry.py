from viewer import managed_operations_registry, routes, specspace_v1_api


def test_managed_operations_have_unique_ids_and_endpoints() -> None:
    operations = managed_operations_registry.MANAGED_OPERATIONS

    operation_ids = [operation.operation_id for operation in operations]
    endpoints = [operation.endpoint for operation in operations]

    assert len(operation_ids) == len(set(operation_ids))
    assert len(endpoints) == len(set(endpoints))
    assert len(operations) >= 12


def test_managed_operations_routes_and_handlers_exist() -> None:
    for operation in managed_operations_registry.MANAGED_OPERATIONS:
        route = routes.route_for("POST", operation.endpoint)

        assert route is not None, operation.operation_id
        assert route.handler == operation.handler_name
        assert route.pass_parsed is True
        assert hasattr(specspace_v1_api, operation.handler_name)


def test_managed_operations_use_normalized_state_vocabulary() -> None:
    vocabulary = set(managed_operations_registry.MANAGED_OPERATION_STATES)

    assert vocabulary == {
        "unavailable",
        "request_needed",
        "gate_needed",
        "ready_to_execute",
        "execution_requested",
        "running_or_waiting",
        "failed",
        "stale",
        "completed",
        "blocked",
    }

    for operation in managed_operations_registry.MANAGED_OPERATIONS:
        assert operation.expected_ui_states
        assert set(operation.expected_ui_states).issubset(vocabulary)
        if "gate" in operation.operation_id or operation.category in {
            "repair",
            "approval",
            "promotion",
            "publication",
        }:
            assert "gate_needed" in operation.expected_ui_states


def test_managed_operations_safety_metadata_is_complete() -> None:
    required_flags = set(managed_operations_registry.SPECSPACE_WRITE_FLAGS_MUST_BE_FALSE)

    for operation in managed_operations_registry.MANAGED_OPERATIONS:
        assert operation.platform_command
        assert operation.platform_command[0] not in {"sh", "bash", "zsh"}
        assert "-c" not in operation.platform_command
        assert operation.input_refs
        assert operation.output_reports
        assert operation.idempotency_key
        assert operation.overwrite_policy
        assert operation.timeout_policy
        assert operation.replay_policy
        assert set(operation.write_capable_flags_must_be_false) == required_flags

        if operation.irreversible:
            assert operation.requires_explicit_confirmation


def test_managed_operations_cover_product_lifecycle_categories() -> None:
    categories = {
        operation.category
        for operation in managed_operations_registry.MANAGED_OPERATIONS
    }

    assert categories == {
        "workspace",
        "intake",
        "repair",
        "approval",
        "promotion",
        "publication",
    }


def test_managed_operation_records_are_serializable_contract_shape() -> None:
    records = managed_operations_registry.managed_operation_records()

    assert records
    assert {
        "operation_id",
        "endpoint",
        "handler_name",
        "platform_command",
        "input_refs",
        "output_reports",
        "expected_ui_states",
    }.issubset(records[0])
    assert all(isinstance(record["platform_command"], tuple) for record in records)
