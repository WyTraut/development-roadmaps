export type StageSelection = "none" | "foundation" | "scale" | "full";
export type ExecutionMode = "parallel" | "sequential";
export type Confidence = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";
export type Accent = "emerald" | "blue" | "amber";

export interface NumericRange {
  low: number;
  high: number;
}

export interface CostBreakdown {
  loaded_labor: NumericRange;
  vendors: NumericRange;
  software_cloud: NumericRange;
  contingency: NumericRange;
}

export interface ImpactRatings {
  efficiency: number;
  risk_reduction: number;
  decision_visibility: number;
  scalability: number;
}

export interface KpiTarget {
  label: string;
  target: string;
  context: string;
}

export interface WorkPackage {
  id: string;
  name: string;
  description: string;
  shared: boolean;
  dependencies: string[];
  cost: CostBreakdown;
  duration_months: NumericRange;
  team_fte: NumericRange;
  person_months: NumericRange;
  confidence: Confidence;
  risk: RiskLevel;
  outcomes: string[];
}

export interface RoadmapStage {
  id: Exclude<StageSelection, "none">;
  label: string;
  name: string;
  summary: string;
  work_packages: string[];
  deliverables: string[];
  kpis: KpiTarget[];
  impact: ImpactRatings;
  risks: string[];
}

export interface Roadmap {
  id: string;
  name: string;
  short_name: string;
  summary: string;
  accent: Accent;
  icon: "network" | "reporting" | "audit";
  stages: RoadmapStage[];
}

export interface ImpactDimension {
  key: keyof ImpactRatings;
  label: string;
  description: string;
}

export interface MetricsSource {
  id: string;
  name: string;
  source_type: "github_issue";
  repository: string;
  issue_number: number;
  display_mode: "aggregate";
  requires_auth: boolean;
  minutes_saved_per_warehouse_query: number;
  purpose: string;
}

export interface PortfolioConfig {
  portfolio: {
    title: string;
    subtitle: string;
    program_label: string;
    currency: string;
    last_updated: string;
    illustrative: boolean;
    source_note: string;
  };
  defaults: {
    selections: Record<string, StageSelection>;
    execution_mode: ExecutionMode;
  };
  impact_dimensions: ImpactDimension[];
  work_packages: WorkPackage[];
  roadmaps: Roadmap[];
  metrics_sources?: MetricsSource[];
  assumptions: string[];
}

export interface DataStatus {
  stale: boolean;
  warning: string | null;
  loaded_at: string;
}

export interface PortfolioResponse {
  config: PortfolioConfig;
  data_status: DataStatus;
}

export interface MetricsDailyTotal {
  date: string;
  scrubs: number;
}

export interface MetricsSnapshot {
  id: string;
  name: string;
  source_url: string;
  purpose: string;
  last_aggregated: string;
  total_scrubs: number;
  warehouse_lookups: number;
  minutes_saved_per_warehouse_query?: number;
  estimated_minutes_saved: number;
  tracked_clients: number;
  daily_totals: MetricsDailyTotal[];
  privacy_note: string;
}

export interface MetricsEvidence {
  sources: MetricsSnapshot[];
}

export interface ScheduleItem {
  id: string;
  name: string;
  shared: boolean;
  roadmap_ids: string[];
  start_low: number;
  end_low: number;
  start_high: number;
  end_high: number;
  team_fte: NumericRange;
  confidence: Confidence;
  risk: RiskLevel;
}

export interface PathResult {
  roadmap_id: string;
  name: string;
  short_name: string;
  accent: Accent;
  selection: StageSelection;
  stage_name: string;
  standalone_investment: NumericRange;
  cost_breakdown: CostBreakdown;
  calendar_months: NumericRange;
  peak_fte: NumericRange;
  person_months: NumericRange;
  work_package_ids: string[];
  deliverables: string[];
  kpis: KpiTarget[];
  impact: ImpactRatings | null;
  risks: string[];
  confidence: Confidence | null;
  risk: RiskLevel | null;
}

export interface Callout {
  kind: "cost_driver" | "quickest_value" | "confidence" | "staffing" | "shared_savings" | "empty";
  title: string;
  body: string;
  tone: "neutral" | "positive" | "caution";
}

export interface ScenarioResult {
  config_version: string;
  execution_mode: ExecutionMode;
  selections: Record<string, StageSelection>;
  totals: {
    investment: NumericRange;
    cost_breakdown: CostBreakdown;
    calendar_months: NumericRange;
    peak_fte: NumericRange;
    person_months: NumericRange;
  };
  paths: PathResult[];
  schedule: {
    execution_mode: ExecutionMode;
    calendar_months: NumericRange;
    peak_fte: NumericRange;
    items: ScheduleItem[];
  };
  shared_savings: {
    investment: NumericRange;
    person_months: NumericRange;
    work_packages: string[];
  };
  callouts: Callout[];
  data_status: DataStatus;
}
