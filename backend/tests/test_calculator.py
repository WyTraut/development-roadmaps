from __future__ import annotations

from copy import deepcopy

import pytest
from pydantic import ValidationError

from backend.app.calculator import PortfolioCalculator
from backend.app.models import DataStatus, PortfolioConfig, ScenarioRequest


def request(config: PortfolioConfig, mode: str = "parallel", stage: str | None = None) -> ScenarioRequest:
    selections = dict(config.defaults.selections)
    if stage is not None:
        selections = {roadmap.id: stage for roadmap in config.roadmaps}
    return ScenarioRequest(selections=selections, execution_mode=mode)


def test_foundation_baseline_uses_worksheet_packages_without_costs(
    config: PortfolioConfig,
    data_status: DataStatus,
) -> None:
    result = PortfolioCalculator(config).calculate(request(config), data_status)

    expected_ids = {
        package_id
        for roadmap in config.roadmaps
        for stage in roadmap.stages
        if stage.id == "foundation"
        for package_id in stage.work_packages
    }

    assert {item.id for item in result.schedule.items} == expected_ids
    assert result.totals.investment.low == 0
    assert result.totals.investment.high == 0
    assert result.shared_savings.work_packages == []
    assert all(path.selection == "foundation" for path in result.paths)


def test_full_selection_is_cumulative_and_remains_lean(
    config: PortfolioConfig,
    data_status: DataStatus,
) -> None:
    result = PortfolioCalculator(config).calculate(request(config, stage="full"), data_status)

    expected_ids = {
        package_id
        for roadmap in config.roadmaps
        for stage in roadmap.stages
        for package_id in stage.work_packages
    }

    assert {item.id for item in result.schedule.items} == expected_ids
    assert result.totals.investment.high < 1_000_000
    network = next(path for path in result.paths if path.roadmap_id == "network_automation")
    assert "network_audits" in network.work_package_ids
    assert "workflow_replacement_tools" in network.work_package_ids
    assert "automated_circuit_delivery" in network.work_package_ids


def test_none_selection_returns_zero_totals(
    config: PortfolioConfig,
    data_status: DataStatus,
) -> None:
    result = PortfolioCalculator(config).calculate(request(config, stage="none"), data_status)

    assert result.totals.investment.low == 0
    assert result.totals.calendar_months.high == 0
    assert result.totals.peak_fte.high == 0
    assert result.totals.person_months.high == 0
    assert result.callouts[0].kind == "empty"


def test_execution_modes_keep_cost_and_effort_but_change_capacity(
    config: PortfolioConfig,
    data_status: DataStatus,
) -> None:
    calculator = PortfolioCalculator(config)
    parallel = calculator.calculate(request(config, mode="parallel", stage="full"), data_status)
    sequential = calculator.calculate(request(config, mode="sequential", stage="full"), data_status)

    assert parallel.totals.investment == sequential.totals.investment
    assert parallel.totals.person_months == sequential.totals.person_months
    assert parallel.totals.calendar_months.high < sequential.totals.calendar_months.high
    assert parallel.totals.peak_fte.high > sequential.totals.peak_fte.high


def test_total_matches_cost_components(
    config: PortfolioConfig,
    data_status: DataStatus,
) -> None:
    result = PortfolioCalculator(config).calculate(request(config, stage="full"), data_status)
    breakdown = result.totals.cost_breakdown

    assert result.totals.investment.low == sum(
        getattr(breakdown, field).low
        for field in ("loaded_labor", "vendors", "software_cloud", "contingency")
    )
    assert result.totals.investment.high == sum(
        getattr(breakdown, field).high
        for field in ("loaded_labor", "vendors", "software_cloud", "contingency")
    )


def test_invalid_selection_keys_are_rejected(
    config: PortfolioConfig,
    data_status: DataStatus,
) -> None:
    scenario = request(config)
    scenario.selections.pop("reporting")

    with pytest.raises(ValueError, match="selections must match roadmap IDs"):
        PortfolioCalculator(config).calculate(scenario, data_status)


def test_dependency_cycles_are_rejected(config: PortfolioConfig) -> None:
    raw = deepcopy(config.model_dump())
    raw["work_packages"][0]["dependencies"] = ["continuous_assurance"]

    with pytest.raises(ValidationError, match="dependency cycle"):
        PortfolioConfig.model_validate(raw)


def test_unknown_work_package_references_are_rejected(config: PortfolioConfig) -> None:
    raw = deepcopy(config.model_dump())
    raw["roadmaps"][0]["stages"][0]["work_packages"].append("missing_package")

    with pytest.raises(ValidationError, match="unknown work packages"):
        PortfolioConfig.model_validate(raw)
