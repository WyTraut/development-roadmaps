from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

from backend.app.metrics import MetricsExportError, parse_metrics_issue
from backend.app.models import PortfolioConfig
from backend.app.reporting_suite import parse_reporting_suite_source
from backend.scripts.export_static import build_static_bundle, scenario_key


ROOT = Path(__file__).resolve().parents[2]
ISSUE_FIXTURE = ROOT / "backend" / "tests" / "fixtures" / "l2l_metrics_issue.md"
REPORTING_SUITE_FIXTURES = (
    ROOT / "backend" / "tests" / "fixtures" / "reporting_suite"
)


def issue_body_loader(*_: object) -> str:
    return ISSUE_FIXTURE.read_text(encoding="utf-8")


def repository_file_loader(_: object, path: str, __: object) -> str:
    fixture_name = {
        "shared/page_registry.json": "page_registry.json",
        "server.py": "server.py",
        "shared/db.py": "db.py",
    }[path]
    return (REPORTING_SUITE_FIXTURES / fixture_name).read_text(encoding="utf-8")


def unavailable_repository_file_loader(*_: object) -> str:
    raise MetricsExportError("repository unavailable")


def test_static_export_contains_every_scenario() -> None:
    bundle = build_static_bundle(
        ROOT / "data" / "roadmaps.yaml",
        github_token="test-token",
        issue_body_loader=issue_body_loader,
        repository_file_loader=repository_file_loader,
    )

    assert len(bundle["scenarios"]) == 128
    assert bundle["portfolio"]["data_status"]["stale"] is False
    assert bundle["portfolio"]["config"]["defaults"]["selections"] == {
        "network_automation": "none",
        "reporting": "none",
        "audit_automation": "none",
    }

    selections = {
        "network_automation": "foundation",
        "reporting": "foundation",
        "audit_automation": "foundation",
    }
    baseline = bundle["scenarios"][scenario_key(selections, "parallel")]

    assert baseline["selections"] == selections
    assert baseline["execution_mode"] == "parallel"
    assert len(baseline["paths"]) == 3
    assert bundle["metrics"]["sources"][0]["id"] == "l2l_scrubber"
    assert bundle["metrics"]["reporting_suite"]["id"] == "reporting_suite"
    assert bundle["metrics"]["reporting_suite"]["active_views"] == 3
    assert "redacted" not in json.dumps(bundle["metrics"])
    assert "Client Totals" not in json.dumps(bundle["metrics"])


def test_metrics_issue_parser_normalizes_aggregate_sections() -> None:
    raw = yaml.safe_load((ROOT / "data" / "roadmaps.yaml").read_text(encoding="utf-8"))
    source = PortfolioConfig.model_validate(raw).metrics_sources[0]

    snapshot = parse_metrics_issue(source, issue_body_loader())

    assert snapshot.total_scrubs == 163
    assert snapshot.warehouse_lookups == 49
    assert snapshot.minutes_saved_per_warehouse_query == 2
    assert snapshot.estimated_minutes_saved == 3356
    assert snapshot.tracked_clients == 8
    assert snapshot.last_aggregated == "2026-07-20T15:21:28Z"
    assert snapshot.daily_totals[0].date == "2026-07-17"
    assert snapshot.daily_totals[-1].scrubs == 10
    assert "task IDs" in snapshot.privacy_note


def test_reporting_suite_parser_derives_capabilities_from_source() -> None:
    raw = yaml.safe_load((ROOT / "data" / "roadmaps.yaml").read_text(encoding="utf-8"))
    source = PortfolioConfig.model_validate(raw).reporting_suite_source
    assert source is not None

    snapshot = parse_reporting_suite_source(
        source,
        page_registry_text=repository_file_loader(
            source, source.page_registry_path, "test-token"
        ),
        server_text=repository_file_loader(source, source.server_path, "test-token"),
        database_text=repository_file_loader(
            source, source.database_path, "test-token"
        ),
    )

    assert snapshot.registered_views == 4
    assert snapshot.active_views == 3
    assert snapshot.api_capabilities == 2
    assert snapshot.data_tables == 2
    assert snapshot.automation_steps == 3
    assert snapshot.scheduled_workflows == 2
    assert [
        (workspace.name, workspace.active_views)
        for workspace in snapshot.workspaces
    ] == [("Operations", 2), ("FIT", 1)]


def test_static_export_uses_code_snapshot_when_private_repo_is_unavailable() -> None:
    with pytest.warns(RuntimeWarning, match="checked-in code-derived snapshot"):
        bundle = build_static_bundle(
            ROOT / "data" / "roadmaps.yaml",
            github_token="test-token",
            issue_body_loader=issue_body_loader,
            repository_file_loader=unavailable_repository_file_loader,
        )

    reporting_suite = bundle["metrics"]["reporting_suite"]
    assert reporting_suite["active_views"] == 47
    assert reporting_suite["api_capabilities"] == 156
    assert reporting_suite["source_ref"] == "7ebd7db"


def test_static_export_requires_token_for_private_metrics_source() -> None:
    with pytest.raises(MetricsExportError, match="METRICS_GITHUB_TOKEN is required"):
        build_static_bundle(
            ROOT / "data" / "roadmaps.yaml",
            issue_body_loader=issue_body_loader,
            repository_file_loader=repository_file_loader,
        )


def test_scenario_key_is_independent_of_mapping_order() -> None:
    first = {"reporting": "scale", "network_automation": "full"}
    second = {"network_automation": "full", "reporting": "scale"}

    assert scenario_key(first, "sequential") == scenario_key(second, "sequential")
