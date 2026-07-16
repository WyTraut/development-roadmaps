from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Literal, Sequence

from .models import (
    Callout,
    Confidence,
    CostBreakdown,
    DataStatus,
    ExecutionMode,
    ImpactRatings,
    NumericRange,
    PathResult,
    PortfolioConfig,
    RiskLevel,
    ScenarioRequest,
    ScenarioResult,
    ScenarioTotals,
    ScheduleItem,
    ScheduleResult,
    SharedSavings,
    StageSelection,
    WorkPackage,
)


STAGE_ORDER: Sequence[StageSelection] = ("foundation", "scale", "full")
CONFIDENCE_RANK: Dict[Confidence, int] = {"high": 0, "medium": 1, "low": 2}
RISK_RANK: Dict[RiskLevel, int] = {"low": 0, "medium": 1, "high": 2}
COST_FIELDS = ("loaded_labor", "vendors", "software_cloud", "contingency")


def _zero_range() -> NumericRange:
    return NumericRange(low=0, high=0)


def _zero_cost() -> CostBreakdown:
    return CostBreakdown(**{field: _zero_range() for field in COST_FIELDS})


def _add_ranges(values: Iterable[NumericRange]) -> NumericRange:
    values = list(values)
    return NumericRange(
        low=round(sum(value.low for value in values), 2),
        high=round(sum(value.high for value in values), 2),
    )


def _subtract_ranges(left: NumericRange, right: NumericRange) -> NumericRange:
    return NumericRange(
        low=round(max(0, left.low - right.low), 2),
        high=round(max(0, left.high - right.high), 2),
    )


def _sum_cost(packages: Iterable[WorkPackage]) -> CostBreakdown:
    package_list = list(packages)
    return CostBreakdown(
        **{
            field: _add_ranges(getattr(package.cost, field) for package in package_list)
            for field in COST_FIELDS
        }
    )


def _total_cost(cost: CostBreakdown) -> NumericRange:
    return _add_ranges(getattr(cost, field) for field in COST_FIELDS)


class PortfolioCalculator:
    def __init__(self, config: PortfolioConfig):
        self.config = config
        self.packages = {package.id: package for package in config.work_packages}
        self.package_order = {package.id: index for index, package in enumerate(config.work_packages)}

    def calculate(
        self,
        request: ScenarioRequest,
        data_status: DataStatus,
    ) -> ScenarioResult:
        self._validate_request(request)
        path_package_ids = {
            roadmap.id: self._packages_for_selection(roadmap.id, request.selections[roadmap.id])
            for roadmap in self.config.roadmaps
        }
        selected_ids = self._ordered_union(path_package_ids.values())
        selected_packages = [self.packages[package_id] for package_id in selected_ids]

        schedule = self._schedule(selected_ids, request.execution_mode, path_package_ids)
        cost_breakdown = _sum_cost(selected_packages)
        person_months = _add_ranges(package.person_months for package in selected_packages)
        paths = [
            self._path_result(
                roadmap.id,
                request.selections[roadmap.id],
                path_package_ids[roadmap.id],
            )
            for roadmap in self.config.roadmaps
        ]

        gross_investment = _add_ranges(path.standalone_investment for path in paths)
        gross_effort = _add_ranges(path.person_months for path in paths)
        investment = _total_cost(cost_breakdown)
        shared_names = self._shared_package_names(path_package_ids)
        savings = SharedSavings(
            investment=_subtract_ranges(gross_investment, investment),
            person_months=_subtract_ranges(gross_effort, person_months),
            work_packages=shared_names,
        )

        totals = ScenarioTotals(
            investment=investment,
            cost_breakdown=cost_breakdown,
            calendar_months=schedule.calendar_months,
            peak_fte=schedule.peak_fte,
            person_months=person_months,
        )

        return ScenarioResult(
            config_version=self.config.portfolio.last_updated,
            execution_mode=request.execution_mode,
            selections=request.selections,
            totals=totals,
            paths=paths,
            schedule=schedule,
            shared_savings=savings,
            callouts=self._callouts(
                request,
                selected_packages,
                paths,
                schedule,
                savings,
                path_package_ids,
            ),
            data_status=data_status,
        )

    def _validate_request(self, request: ScenarioRequest) -> None:
        roadmap_ids = {roadmap.id for roadmap in self.config.roadmaps}
        if set(request.selections) != roadmap_ids:
            missing = sorted(roadmap_ids - set(request.selections))
            extra = sorted(set(request.selections) - roadmap_ids)
            raise ValueError(f"selections must match roadmap IDs; missing={missing}, extra={extra}")

    def _packages_for_selection(
        self,
        roadmap_id: str,
        selection: StageSelection,
    ) -> List[str]:
        if selection == "none":
            return []
        roadmap = next(item for item in self.config.roadmaps if item.id == roadmap_id)
        selected_stage_index = STAGE_ORDER.index(selection)
        seeds: List[str] = []
        for stage in roadmap.stages[: selected_stage_index + 1]:
            seeds.extend(stage.work_packages)
        return self._dependency_closure(seeds)

    def _dependency_closure(self, seeds: Iterable[str]) -> List[str]:
        included: set[str] = set()

        def include(package_id: str) -> None:
            if package_id in included:
                return
            for dependency_id in self.packages[package_id].dependencies:
                include(dependency_id)
            included.add(package_id)

        for seed in seeds:
            include(seed)
        return sorted(included, key=self.package_order.get)

    def _ordered_union(self, groups: Iterable[Iterable[str]]) -> List[str]:
        return sorted({item for group in groups for item in group}, key=self.package_order.get)

    def _path_result(
        self,
        roadmap_id: str,
        selection: StageSelection,
        package_ids: List[str],
    ) -> PathResult:
        roadmap = next(item for item in self.config.roadmaps if item.id == roadmap_id)
        packages = [self.packages[package_id] for package_id in package_ids]
        cost = _sum_cost(packages)
        schedule = self._schedule(package_ids, "parallel", {roadmap_id: package_ids})

        if selection == "none":
            return PathResult(
                roadmap_id=roadmap.id,
                name=roadmap.name,
                short_name=roadmap.short_name,
                accent=roadmap.accent,
                selection=selection,
                stage_name="No investment",
                standalone_investment=_zero_range(),
                cost_breakdown=_zero_cost(),
                calendar_months=_zero_range(),
                peak_fte=_zero_range(),
                person_months=_zero_range(),
                work_package_ids=[],
                deliverables=[],
                kpis=[],
                impact=None,
                risks=[],
                confidence=None,
                risk=None,
            )

        selected_stage_index = STAGE_ORDER.index(selection)
        included_stages = roadmap.stages[: selected_stage_index + 1]
        selected_stage = roadmap.stages[selected_stage_index]
        return PathResult(
            roadmap_id=roadmap.id,
            name=roadmap.name,
            short_name=roadmap.short_name,
            accent=roadmap.accent,
            selection=selection,
            stage_name=selected_stage.name,
            standalone_investment=_total_cost(cost),
            cost_breakdown=cost,
            calendar_months=schedule.calendar_months,
            peak_fte=schedule.peak_fte,
            person_months=_add_ranges(package.person_months for package in packages),
            work_package_ids=package_ids,
            deliverables=[item for stage in included_stages for item in stage.deliverables],
            kpis=[item for stage in included_stages for item in stage.kpis],
            impact=selected_stage.impact,
            risks=selected_stage.risks,
            confidence=self._lowest_confidence(packages),
            risk=self._highest_risk(packages),
        )

    def _schedule(
        self,
        package_ids: List[str],
        mode: ExecutionMode,
        path_package_ids: Dict[str, List[str]],
    ) -> ScheduleResult:
        if not package_ids:
            return ScheduleResult(
                execution_mode=mode,
                calendar_months=_zero_range(),
                peak_fte=_zero_range(),
                items=[],
            )

        low = self._schedule_bound(package_ids, mode, "low")
        high = self._schedule_bound(package_ids, mode, "high")
        memberships: dict[str, List[str]] = defaultdict(list)
        for roadmap_id, ids in path_package_ids.items():
            for package_id in ids:
                memberships[package_id].append(roadmap_id)

        items = [
            ScheduleItem(
                id=package_id,
                name=self.packages[package_id].name,
                shared=self.packages[package_id].shared,
                roadmap_ids=memberships.get(package_id, []),
                start_low=low["times"][package_id][0],
                end_low=low["times"][package_id][1],
                start_high=high["times"][package_id][0],
                end_high=high["times"][package_id][1],
                team_fte=self.packages[package_id].team_fte,
                confidence=self.packages[package_id].confidence,
                risk=self.packages[package_id].risk,
            )
            for package_id in package_ids
        ]
        return ScheduleResult(
            execution_mode=mode,
            calendar_months=NumericRange(low=low["duration"], high=high["duration"]),
            peak_fte=NumericRange(low=low["peak_fte"], high=high["peak_fte"]),
            items=items,
        )

    def _schedule_bound(
        self,
        package_ids: List[str],
        mode: ExecutionMode,
        bound: LiteralBound,
    ) -> dict:
        included = set(package_ids)
        ordered = self._topological_order(package_ids)
        times: dict[str, tuple[float, float]] = {}
        cursor = 0.0

        for package_id in ordered:
            package = self.packages[package_id]
            duration = float(getattr(package.duration_months, bound))
            if mode == "sequential":
                start = cursor
            else:
                dependency_ends = [
                    times[dependency_id][1]
                    for dependency_id in package.dependencies
                    if dependency_id in included
                ]
                start = max(dependency_ends, default=0.0)
            end = start + duration
            times[package_id] = (round(start, 2), round(end, 2))
            if mode == "sequential":
                cursor = end

        duration = max(end for _, end in times.values())
        if mode == "sequential":
            peak_fte = max(float(getattr(self.packages[item].team_fte, bound)) for item in ordered)
        else:
            event_times = sorted({start for start, _ in times.values()})
            peak_fte = max(
                sum(
                    float(getattr(self.packages[package_id].team_fte, bound))
                    for package_id, (start, end) in times.items()
                    if start <= event_time < end
                )
                for event_time in event_times
            )
        return {
            "times": times,
            "duration": round(duration, 2),
            "peak_fte": round(peak_fte, 2),
        }

    def _topological_order(self, package_ids: List[str]) -> List[str]:
        included = set(package_ids)
        visited: set[str] = set()
        ordered: List[str] = []

        def visit(package_id: str) -> None:
            if package_id in visited:
                return
            for dependency_id in self.packages[package_id].dependencies:
                if dependency_id in included:
                    visit(dependency_id)
            visited.add(package_id)
            ordered.append(package_id)

        for package_id in package_ids:
            visit(package_id)
        return ordered

    def _shared_package_names(self, path_package_ids: Dict[str, List[str]]) -> List[str]:
        memberships: dict[str, int] = defaultdict(int)
        for package_ids in path_package_ids.values():
            for package_id in set(package_ids):
                memberships[package_id] += 1
        return [
            self.packages[package_id].name
            for package_id in sorted(memberships, key=self.package_order.get)
            if memberships[package_id] > 1
        ]

    def _lowest_confidence(self, packages: List[WorkPackage]) -> Confidence | None:
        if not packages:
            return None
        return max((package.confidence for package in packages), key=CONFIDENCE_RANK.get)

    def _highest_risk(self, packages: List[WorkPackage]) -> RiskLevel | None:
        if not packages:
            return None
        return max((package.risk for package in packages), key=RISK_RANK.get)

    def _callouts(
        self,
        request: ScenarioRequest,
        packages: List[WorkPackage],
        paths: List[PathResult],
        schedule: ScheduleResult,
        savings: SharedSavings,
        path_package_ids: Dict[str, List[str]],
    ) -> List[Callout]:
        if not packages:
            return [
                Callout(
                    kind="empty",
                    title="No investment selected",
                    body="Choose a stage on at least one roadmap to model the portfolio.",
                    tone="neutral",
                )
            ]

        callouts: List[Callout] = []
        cost_driver = max(packages, key=lambda package: _total_cost(package.cost).high)
        driver_cost = _total_cost(cost_driver.cost)
        callouts.append(
            Callout(
                kind="cost_driver",
                title="Largest cost driver",
                body=f"{cost_driver.name} contributes ${driver_cost.low:,.0f}-${driver_cost.high:,.0f}.",
                tone="neutral",
            )
        )

        active_paths = [path for path in paths if path.selection != "none"]
        quickest_path = min(active_paths, key=lambda path: path.calendar_months.high)
        callouts.append(
            Callout(
                kind="quickest_value",
                title="Shortest selected path",
                body=(
                    f"{quickest_path.name} reaches {quickest_path.stage_name} in "
                    f"{quickest_path.calendar_months.low:g}-{quickest_path.calendar_months.high:g} months."
                ),
                tone="positive",
            )
        )

        lowest_confidence = max(packages, key=lambda package: CONFIDENCE_RANK[package.confidence])
        if lowest_confidence.confidence != "high":
            callouts.append(
                Callout(
                    kind="confidence",
                    title="Estimate confidence",
                    body=(
                        f"{lowest_confidence.name} carries {lowest_confidence.confidence} confidence "
                        f"and {lowest_confidence.risk} delivery risk."
                    ),
                    tone="caution",
                )
            )

        alternate_mode: ExecutionMode = (
            "sequential" if request.execution_mode == "parallel" else "parallel"
        )
        alternate = self._schedule(
            [package.id for package in packages],
            alternate_mode,
            path_package_ids,
        )
        if request.execution_mode == "parallel":
            difference_low = max(0, schedule.peak_fte.low - alternate.peak_fte.low)
            difference_high = max(0, schedule.peak_fte.high - alternate.peak_fte.high)
            body = (
                f"Parallel delivery uses {difference_low:g}-{difference_high:g} more peak FTE "
                f"than sequential delivery."
            )
        else:
            difference_low = max(0, alternate.peak_fte.low - schedule.peak_fte.low)
            difference_high = max(0, alternate.peak_fte.high - schedule.peak_fte.high)
            body = (
                f"Sequential delivery reduces peak demand by {difference_low:g}-{difference_high:g} FTE "
                f"but extends elapsed time."
            )
        callouts.append(
            Callout(kind="staffing", title="Delivery mode tradeoff", body=body, tone="neutral")
        )

        if savings.investment.high > 0:
            callouts.append(
                Callout(
                    kind="shared_savings",
                    title="Shared foundation value",
                    body=(
                        f"Reused capabilities avoid ${savings.investment.low:,.0f}-"
                        f"${savings.investment.high:,.0f} in duplicate investment."
                    ),
                    tone="positive",
                )
            )
        return callouts


LiteralBound = Literal["low", "high"]
