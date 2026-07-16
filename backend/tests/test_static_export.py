from __future__ import annotations

from pathlib import Path

from backend.scripts.export_static import build_static_bundle, scenario_key


ROOT = Path(__file__).resolve().parents[2]


def test_static_export_contains_every_scenario() -> None:
    bundle = build_static_bundle(ROOT / "data" / "roadmaps.yaml")

    assert len(bundle["scenarios"]) == 128
    assert bundle["portfolio"]["data_status"]["stale"] is False

    selections = {
        "network_automation": "foundation",
        "reporting": "foundation",
        "audit_automation": "foundation",
    }
    baseline = bundle["scenarios"][scenario_key(selections, "parallel")]

    assert baseline["selections"] == selections
    assert baseline["execution_mode"] == "parallel"
    assert len(baseline["paths"]) == 3


def test_scenario_key_is_independent_of_mapping_order() -> None:
    first = {"reporting": "scale", "network_automation": "full"}
    second = {"network_automation": "full", "reporting": "scale"}

    assert scenario_key(first, "sequential") == scenario_key(second, "sequential")
