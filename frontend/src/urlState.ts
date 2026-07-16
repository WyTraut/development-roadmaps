import type {
  ExecutionMode,
  PortfolioConfig,
  StageSelection
} from "./types";

const VALID_STAGES = new Set<StageSelection>(["none", "foundation", "scale", "full"]);
const VALID_MODES = new Set<ExecutionMode>(["parallel", "sequential"]);

export interface UrlScenarioState {
  selections: Record<string, StageSelection>;
  executionMode: ExecutionMode;
}

export function readUrlState(config: PortfolioConfig, search: string): UrlScenarioState {
  const params = new URLSearchParams(search);
  const selections: Record<string, StageSelection> = {};

  for (const roadmap of config.roadmaps) {
    const candidate = params.get(roadmap.id) as StageSelection | null;
    selections[roadmap.id] = candidate && VALID_STAGES.has(candidate)
      ? candidate
      : config.defaults.selections[roadmap.id];
  }

  const modeCandidate = params.get("mode") as ExecutionMode | null;
  const executionMode = modeCandidate && VALID_MODES.has(modeCandidate)
    ? modeCandidate
    : config.defaults.execution_mode;

  return { selections, executionMode };
}

export function scenarioSearch(
  roadmapIds: string[],
  selections: Record<string, StageSelection>,
  executionMode: ExecutionMode
): string {
  const params = new URLSearchParams();
  roadmapIds.forEach((roadmapId) => params.set(roadmapId, selections[roadmapId]));
  params.set("mode", executionMode);
  return `?${params.toString()}`;
}

export function scenarioUrl(
  currentUrl: string,
  roadmapIds: string[],
  selections: Record<string, StageSelection>,
  executionMode: ExecutionMode
): string {
  const url = new URL(currentUrl);
  url.search = scenarioSearch(roadmapIds, selections, executionMode);
  return url.toString();
}
