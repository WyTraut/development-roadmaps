import type {
  ExecutionMode,
  PortfolioResponse,
  ScenarioResult,
  StageSelection
} from "./types";

interface StaticPortfolioBundle {
  portfolio: PortfolioResponse;
  scenarios: Record<string, ScenarioResult>;
}

const staticSite = import.meta.env.VITE_STATIC_SITE === "true";
let staticBundlePromise: Promise<StaticPortfolioBundle> | null = null;

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail ?? `Request failed with status ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return response.json() as Promise<T>;
}

function scenarioKey(
  selections: Record<string, StageSelection>,
  executionMode: ExecutionMode
): string {
  const selectionKey = Object.entries(selections)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([roadmapId, selection]) => `${roadmapId}=${selection}`)
    .join("|");
  return `${executionMode}|${selectionKey}`;
}

function loadStaticBundle(): Promise<StaticPortfolioBundle> {
  if (!staticBundlePromise) {
    const dataUrl = `${import.meta.env.BASE_URL}data/portfolio.json`;
    staticBundlePromise = fetch(dataUrl, { cache: "no-store" }).then(
      responseJson<StaticPortfolioBundle>
    );
  }
  return staticBundlePromise;
}

export async function fetchPortfolio(signal?: AbortSignal): Promise<PortfolioResponse> {
  if (staticSite) return (await loadStaticBundle()).portfolio;
  const response = await fetch("/api/portfolio", { signal });
  return responseJson<PortfolioResponse>(response);
}

export async function calculateScenario(
  selections: Record<string, StageSelection>,
  executionMode: ExecutionMode,
  signal?: AbortSignal
): Promise<ScenarioResult> {
  if (staticSite) {
    const bundle = await loadStaticBundle();
    const key = scenarioKey(selections, executionMode);
    const result = bundle.scenarios[key];
    if (!result) throw new Error(`Static scenario is unavailable: ${key}`);
    return result;
  }

  const response = await fetch("/api/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selections, execution_mode: executionMode }),
    signal
  });
  return responseJson<ScenarioResult>(response);
}
