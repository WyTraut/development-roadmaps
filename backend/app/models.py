from __future__ import annotations

from typing import Dict, List, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


StageSelection = Literal["none", "foundation", "scale", "full"]
ExecutionMode = Literal["parallel", "sequential"]
Confidence = Literal["low", "medium", "high"]
RiskLevel = Literal["low", "medium", "high"]
MetricsDisplayMode = Literal["aggregate"]
MetricsSourceType = Literal["github_issue"]


class NumericRange(BaseModel):
    low: float = Field(ge=0)
    high: float = Field(ge=0)

    @model_validator(mode="after")
    def check_order(self) -> "NumericRange":
        if self.low > self.high:
            raise ValueError("range low value cannot exceed high value")
        return self


class CostBreakdown(BaseModel):
    loaded_labor: NumericRange
    vendors: NumericRange
    software_cloud: NumericRange
    contingency: NumericRange


class PortfolioMetadata(BaseModel):
    title: str
    subtitle: str
    program_label: str
    currency: str = "USD"
    last_updated: str
    illustrative: bool = True
    source_note: str


class ImpactDimension(BaseModel):
    key: Literal["efficiency", "risk_reduction", "decision_visibility", "scalability"]
    label: str
    description: str


class ImpactRatings(BaseModel):
    efficiency: int = Field(ge=1, le=5)
    risk_reduction: int = Field(ge=1, le=5)
    decision_visibility: int = Field(ge=1, le=5)
    scalability: int = Field(ge=1, le=5)


class KpiTarget(BaseModel):
    label: str
    target: str
    context: str


class WorkPackage(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str
    description: str
    shared: bool = False
    dependencies: List[str] = Field(default_factory=list)
    cost: CostBreakdown
    duration_months: NumericRange
    team_fte: NumericRange
    person_months: NumericRange
    confidence: Confidence
    risk: RiskLevel
    outcomes: List[str] = Field(min_length=1)


class RoadmapStage(BaseModel):
    id: Literal["foundation", "scale", "full"]
    label: str
    name: str
    summary: str
    work_packages: List[str] = Field(min_length=1)
    deliverables: List[str] = Field(min_length=1)
    kpis: List[KpiTarget] = Field(min_length=1)
    impact: ImpactRatings
    risks: List[str] = Field(min_length=1)


class Roadmap(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str
    short_name: str
    summary: str
    accent: Literal["emerald", "blue", "amber"]
    icon: Literal["network", "reporting", "audit"]
    stages: List[RoadmapStage]

    @model_validator(mode="after")
    def check_stage_order(self) -> "Roadmap":
        expected = ["foundation", "scale", "full"]
        if [stage.id for stage in self.stages] != expected:
            raise ValueError(f"roadmap stages must be ordered as {expected}")
        return self


class PortfolioDefaults(BaseModel):
    selections: Dict[str, StageSelection]
    execution_mode: ExecutionMode = "parallel"


class MetricsSource(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str
    source_type: MetricsSourceType = "github_issue"
    repository: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    issue_number: int = Field(ge=1)
    display_mode: MetricsDisplayMode = "aggregate"
    requires_auth: bool = True
    minutes_saved_per_warehouse_query: int = Field(default=0, ge=0)
    purpose: str


class ReportingSuiteSource(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    name: str
    repository: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    ref: str = Field(default="main", pattern=r"^[A-Za-z0-9_./-]+$")
    requires_auth: bool = True
    page_registry_path: str = "shared/page_registry.json"
    server_path: str = "server.py"
    database_path: str = "shared/db.py"
    fallback_snapshot_path: str | None = None
    metrics_issue: "ReportingSuiteMetricsSource | None" = None
    purpose: str


class ReportingSuiteMetricsSource(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$")
    repository: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    issue_number: int = Field(ge=1)
    requires_auth: bool = False


class PortfolioConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    portfolio: PortfolioMetadata
    defaults: PortfolioDefaults
    impact_dimensions: List[ImpactDimension]
    work_packages: List[WorkPackage]
    roadmaps: List[Roadmap]
    metrics_sources: List[MetricsSource] = Field(default_factory=list)
    reporting_suite_source: ReportingSuiteSource | None = None
    assumptions: List[str] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_references(self) -> "PortfolioConfig":
        package_ids = [package.id for package in self.work_packages]
        roadmap_ids = [roadmap.id for roadmap in self.roadmaps]

        if len(package_ids) != len(set(package_ids)):
            raise ValueError("work package IDs must be unique")
        if len(roadmap_ids) != len(set(roadmap_ids)):
            raise ValueError("roadmap IDs must be unique")
        metrics_source_ids = [source.id for source in self.metrics_sources]
        if len(metrics_source_ids) != len(set(metrics_source_ids)):
            raise ValueError("metrics source IDs must be unique")
        if len(self.roadmaps) != 3:
            raise ValueError("the portfolio must contain exactly three roadmaps")

        known_packages = set(package_ids)
        for package in self.work_packages:
            missing = set(package.dependencies) - known_packages
            if missing:
                raise ValueError(
                    f"work package '{package.id}' has unknown dependencies: {sorted(missing)}"
                )
            if package.id in package.dependencies:
                raise ValueError(f"work package '{package.id}' cannot depend on itself")

        for roadmap in self.roadmaps:
            for stage in roadmap.stages:
                missing = set(stage.work_packages) - known_packages
                if missing:
                    raise ValueError(
                        f"roadmap '{roadmap.id}' stage '{stage.id}' references unknown "
                        f"work packages: {sorted(missing)}"
                    )

        if set(self.defaults.selections) != set(roadmap_ids):
            raise ValueError("default selections must include every roadmap exactly once")

        self._validate_acyclic_dependencies()
        return self

    def _validate_acyclic_dependencies(self) -> None:
        dependencies = {package.id: package.dependencies for package in self.work_packages}
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(package_id: str) -> None:
            if package_id in visiting:
                raise ValueError(f"dependency cycle detected at '{package_id}'")
            if package_id in visited:
                return
            visiting.add(package_id)
            for dependency_id in dependencies[package_id]:
                visit(dependency_id)
            visiting.remove(package_id)
            visited.add(package_id)

        for package_id in dependencies:
            visit(package_id)


class ScenarioRequest(BaseModel):
    selections: Dict[str, StageSelection]
    execution_mode: ExecutionMode


class DataStatus(BaseModel):
    stale: bool
    warning: str | None = None
    loaded_at: str


class MetricsDailyTotal(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    scrubs: int = Field(ge=0)


class MetricsSnapshot(BaseModel):
    id: str
    name: str
    source_url: str
    purpose: str
    last_aggregated: str
    total_scrubs: int = Field(ge=0)
    warehouse_lookups: int = Field(ge=0)
    minutes_saved_per_warehouse_query: int = Field(ge=0)
    estimated_minutes_saved: int = Field(ge=0)
    tracked_clients: int = Field(ge=0)
    daily_totals: List[MetricsDailyTotal]
    privacy_note: str


class ReportingSuiteWorkspaceMetric(BaseModel):
    name: str
    active_views: int = Field(ge=0)


class ReportingSuiteMonthlyView(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    views: int = Field(ge=0)

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: str) -> str:
        if not 1 <= int(value[-2:]) <= 12:
            raise ValueError("month must use YYYY-MM with a valid month")
        return value


class ReportingSuiteMetricsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1]
    code_ref: str = Field(min_length=1)
    report_views: int = Field(ge=0)
    total_views: int | None = Field(default=None, ge=0)
    data_points: int | None = Field(default=None, ge=0)
    unique_viewers: int | None = Field(default=None, ge=0)
    source_systems: List[str] = Field(min_length=1)
    tracking_started: str | None = None
    last_aggregated: str | None = None
    monthly_views: List[ReportingSuiteMonthlyView] = Field(default_factory=list)
    privacy_note: str = Field(min_length=1)


class ReportingSuiteSnapshot(BaseModel):
    id: str
    name: str
    source_url: str
    source_ref: str
    purpose: str
    registered_views: int = Field(ge=0)
    active_views: int = Field(ge=0)
    api_capabilities: int = Field(ge=0)
    data_tables: int = Field(ge=0)
    automation_steps: int = Field(ge=0)
    scheduled_workflows: int = Field(ge=0)
    workspaces: List[ReportingSuiteWorkspaceMetric]
    source_note: str
    report_views: int = Field(default=0, ge=0)
    total_views: int | None = Field(default=None, ge=0)
    data_points: int | None = Field(default=None, ge=0)
    unique_viewers: int | None = Field(default=None, ge=0)
    source_systems: List[str] = Field(default_factory=list)
    tracking_started: str | None = None
    last_aggregated: str | None = None
    monthly_views: List[ReportingSuiteMonthlyView] = Field(default_factory=list)
    privacy_note: str = ""


class MetricsEvidence(BaseModel):
    sources: List[MetricsSnapshot] = Field(default_factory=list)
    reporting_suite: ReportingSuiteSnapshot | None = None


class PortfolioResponse(BaseModel):
    config: PortfolioConfig
    data_status: DataStatus


class ScheduleItem(BaseModel):
    id: str
    name: str
    shared: bool
    roadmap_ids: List[str]
    start_low: float
    end_low: float
    start_high: float
    end_high: float
    team_fte: NumericRange
    confidence: Confidence
    risk: RiskLevel


class ScheduleResult(BaseModel):
    execution_mode: ExecutionMode
    calendar_months: NumericRange
    peak_fte: NumericRange
    items: List[ScheduleItem]


class PathResult(BaseModel):
    roadmap_id: str
    name: str
    short_name: str
    accent: str
    selection: StageSelection
    stage_name: str
    standalone_investment: NumericRange
    cost_breakdown: CostBreakdown
    calendar_months: NumericRange
    peak_fte: NumericRange
    person_months: NumericRange
    work_package_ids: List[str]
    deliverables: List[str]
    kpis: List[KpiTarget]
    impact: ImpactRatings | None
    risks: List[str]
    confidence: Confidence | None
    risk: RiskLevel | None


class ScenarioTotals(BaseModel):
    investment: NumericRange
    cost_breakdown: CostBreakdown
    calendar_months: NumericRange
    peak_fte: NumericRange
    person_months: NumericRange


class SharedSavings(BaseModel):
    investment: NumericRange
    person_months: NumericRange
    work_packages: List[str]


class Callout(BaseModel):
    kind: Literal[
        "cost_driver",
        "quickest_value",
        "confidence",
        "staffing",
        "shared_savings",
        "empty",
    ]
    title: str
    body: str
    tone: Literal["neutral", "positive", "caution"]


class ScenarioResult(BaseModel):
    config_version: str
    execution_mode: ExecutionMode
    selections: Dict[str, StageSelection]
    totals: ScenarioTotals
    paths: List[PathResult]
    schedule: ScheduleResult
    shared_savings: SharedSavings
    callouts: List[Callout]
    data_status: DataStatus
