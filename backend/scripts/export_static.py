from __future__ import annotations

import argparse
import json
import os
import sys
from itertools import product
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.calculator import PortfolioCalculator  # noqa: E402
from backend.app.models import (  # noqa: E402
    DataStatus,
    PortfolioConfig,
    PortfolioResponse,
    ScenarioRequest,
)
from backend.app.metrics import (  # noqa: E402
    IssueBodyLoader,
    build_metrics_evidence,
    fetch_github_issue_body,
)
from backend.app.reporting_suite import (  # noqa: E402
    ReportingIssueBodyLoader,
    RepositoryFileLoader,
    build_reporting_suite_snapshot,
    fetch_github_repository_file,
    load_reporting_suite_snapshot,
)


STAGE_SELECTIONS = ("none", "foundation", "scale", "full")
EXECUTION_MODES = ("parallel", "sequential")


def scenario_key(selections: dict[str, str], execution_mode: str) -> str:
    selection_key = "|".join(
        f"{roadmap_id}={selection}"
        for roadmap_id, selection in sorted(selections.items())
    )
    return f"{execution_mode}|{selection_key}"


def build_static_bundle(
    data_path: Path,
    github_token: str | None = None,
    issue_body_loader: IssueBodyLoader = fetch_github_issue_body,
    reporting_issue_body_loader: ReportingIssueBodyLoader = fetch_github_issue_body,
    repository_file_loader: RepositoryFileLoader = fetch_github_repository_file,
) -> dict[str, Any]:
    raw = yaml.safe_load(data_path.read_text(encoding="utf-8"))
    config = PortfolioConfig.model_validate(raw)
    status = DataStatus(
        stale=False,
        warning=None,
        loaded_at=f"{config.portfolio.last_updated}T00:00:00+00:00",
    )
    metrics = build_metrics_evidence(
        config.metrics_sources,
        github_token=github_token,
        issue_body_loader=issue_body_loader,
    )
    reporting_suite_source = config.reporting_suite_source
    fallback_snapshot = None
    if (
        reporting_suite_source is not None
        and reporting_suite_source.fallback_snapshot_path is not None
    ):
        fallback_snapshot = load_reporting_suite_snapshot(
            data_path.parent / reporting_suite_source.fallback_snapshot_path
        )
    metrics.reporting_suite = build_reporting_suite_snapshot(
        reporting_suite_source,
        github_token=github_token,
        repository_file_loader=repository_file_loader,
        issue_body_loader=reporting_issue_body_loader,
        fallback_snapshot=fallback_snapshot,
    )
    calculator = PortfolioCalculator(config)
    roadmap_ids = [roadmap.id for roadmap in config.roadmaps]
    scenarios: dict[str, Any] = {}

    for execution_mode in EXECUTION_MODES:
        for selected_stages in product(STAGE_SELECTIONS, repeat=len(roadmap_ids)):
            selections = dict(zip(roadmap_ids, selected_stages, strict=True))
            request = ScenarioRequest(
                selections=selections,
                execution_mode=execution_mode,
            )
            result = calculator.calculate(request, status)
            scenarios[scenario_key(selections, execution_mode)] = result.model_dump(mode="json")

    portfolio = PortfolioResponse(config=config, data_status=status)
    return {
        "portfolio": portfolio.model_dump(mode="json"),
        "scenarios": scenarios,
        "metrics": metrics.model_dump(mode="json"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export all roadmap scenarios for a serverless static build."
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=ROOT / "data" / "roadmaps.yaml",
        help="Roadmap YAML source.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "frontend" / "public" / "data" / "portfolio.json",
        help="Generated static bundle path.",
    )
    args = parser.parse_args()

    bundle = build_static_bundle(
        args.data,
        github_token=os.environ.get("METRICS_GITHUB_TOKEN"),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(bundle, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        f"Exported {len(bundle['scenarios'])} scenarios and "
        f"{len(bundle['metrics']['sources'])} live metrics source(s) plus "
        f"{'1' if bundle['metrics']['reporting_suite'] else '0'} code snapshot(s) "
        f"to {args.output}"
    )


if __name__ == "__main__":
    main()
