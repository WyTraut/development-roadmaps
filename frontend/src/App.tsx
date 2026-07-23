import {
  ArrowLeft,
  BarChart3,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  Gauge,
  GitCompareArrows,
  Info,
  Layers3,
  Link2,
  ListChecks,
  Minus,
  Network,
  Plus,
  Printer,
  RotateCcw,
  Route,
  Share2,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { flushSync } from "react-dom";

import { calculateScenario, fetchMetrics, fetchPortfolio } from "./api";
import { formatNumberRange, sentenceCase } from "./format";
import MetricsPage, { type MetricsView } from "./MetricsPage";
import { readUrlState, scenarioSearch, scenarioUrl } from "./urlState";
import type {
  Accent,
  Callout,
  ExecutionMode,
  ImpactDimension,
  ImpactRatings,
  MetricsEvidence,
  NumericRange,
  PathResult,
  PortfolioConfig,
  Roadmap,
  RoadmapStage,
  ScenarioResult,
  StageSelection,
  WorkPackage
} from "./types";

type ViewName = "comparison" | "delivery" | "assumptions";
type AppScreen = "chooser" | "editor" | "portfolio" | "metrics";

const METRICS_ROUTE_HASH = "#metrics";
const REPORTING_SUITE_ROUTE_HASH = "#metrics/reporting-suite";

function metricsViewFromHash(hash: string): MetricsView | null {
  const normalized = hash.toLowerCase();
  if (normalized === REPORTING_SUITE_ROUTE_HASH) return "reporting-suite";
  if (normalized === METRICS_ROUTE_HASH) return "activations";
  return null;
}

interface DrawerState {
  roadmap: Roadmap;
  stage: RoadmapStage;
}

const VIEW_OPTIONS: Array<{ id: ViewName; label: string; icon: LucideIcon }> = [
  { id: "comparison", label: "Comparison", icon: GitCompareArrows },
  { id: "delivery", label: "Delivery", icon: CalendarRange },
  { id: "assumptions", label: "Assumptions", icon: ListChecks }
];

const ICONS: Record<Roadmap["icon"], LucideIcon> = {
  network: Network,
  reporting: BarChart3,
  audit: ShieldCheck
};

const CALLOUT_ICONS: Record<Callout["kind"], LucideIcon> = {
  cost_driver: Layers3,
  quickest_value: Clock3,
  confidence: TriangleAlert,
  staffing: UsersRound,
  shared_savings: Layers3,
  empty: CircleAlert
};

const ROADMAP_ZOOM_DURATION_MS = 680;
const ROADMAP_MORPH_DURATION_MS = 1380;
const OPENING_ANIMATION_MS = 1200;
const CHOOSER_ROUTE_PATHS = [
  { endX: 240, path: "M720 14C720 34 240 24 240 58" },
  { endX: 720, path: "M720 14V58" },
  { endX: 1200, path: "M720 14C720 34 1200 24 1200 58" }
];

interface RoadmapViewTransition {
  finished: Promise<void>;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => RoadmapViewTransition;
};

function App() {
  const [openingComplete, setOpeningComplete] = useState(
    () => typeof window.matchMedia !== "function"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [config, setConfig] = useState<PortfolioConfig | null>(null);
  const [selections, setSelections] = useState<Record<string, StageSelection> | null>(null);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("parallel");
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [metrics, setMetrics] = useState<MetricsEvidence>({ sources: [] });
  const [metricsView, setMetricsView] = useState<MetricsView>(
    () => metricsViewFromHash(window.location.hash) ?? "activations"
  );
  const [screen, setScreen] = useState<AppScreen>(
    () => metricsViewFromHash(window.location.hash) ? "metrics" : "chooser"
  );
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [zoomingRoadmapId, setZoomingRoadmapId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewName>("comparison");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zoomTimerRef = useRef<number | null>(null);
  const transitionInProgressRef = useRef(false);

  useEffect(() => {
    if (openingComplete || !config || !selections) return;
    const timeout = window.setTimeout(() => setOpeningComplete(true), OPENING_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [config, openingComplete, selections]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchPortfolio(controller.signal), fetchMetrics()])
      .then(([response, metricsEvidence]) => {
        const urlState = readUrlState(response.config, window.location.search);
        setConfig(response.config);
        setMetrics(metricsEvidence);
        setSelections(urlState.selections);
        setExecutionMode(urlState.executionMode);
        setError(null);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!config || !selections) return;
    const controller = new AbortController();
    const roadmapIds = config.roadmaps.map((roadmap) => roadmap.id);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${scenarioSearch(roadmapIds, selections, executionMode)}${window.location.hash}`
    );
    setCalculating(true);
    calculateScenario(selections, executionMode, controller.signal)
      .then((scenario) => {
        setResult(scenario);
        setError(null);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => setCalculating(false));
    return () => controller.abort();
  }, [config, selections, executionMode]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => () => {
    if (zoomTimerRef.current !== null) window.clearTimeout(zoomTimerRef.current);
  }, []);

  useEffect(() => {
    const syncMetricsRoute = () => {
      const routeView = metricsViewFromHash(window.location.hash);
      if (!routeView) return;
      setMetricsView(routeView);
      setScreen("metrics");
    };
    window.addEventListener("hashchange", syncMetricsRoute);
    window.addEventListener("popstate", syncMetricsRoute);
    return () => {
      window.removeEventListener("hashchange", syncMetricsRoute);
      window.removeEventListener("popstate", syncMetricsRoute);
    };
  }, []);

  const pathResults = useMemo(
    () => new Map(result?.paths.map((path) => [path.roadmap_id, path]) ?? []),
    [result]
  );

  const packageMap = useMemo(
    () => new Map(config?.work_packages.map((item) => [item.id, item]) ?? []),
    [config]
  );

  if (loading) return <LoadingScreen />;

  if (!config || !selections) {
    return (
      <main className="fatal-state">
        <CircleAlert aria-hidden="true" size={34} />
        <h1>Roadmap data is unavailable</h1>
        <p>{error ?? "The portfolio could not be loaded."}</p>
        <button className="command-button" onClick={() => window.location.reload()}>
          <RotateCcw aria-hidden="true" size={20} />
          Retry
        </button>
      </main>
    );
  }

  const currentStatus = result?.data_status;
  const roadmapIds = config.roadmaps.map((roadmap) => roadmap.id);

  function updateSelection(roadmapId: string, selection: StageSelection) {
    setSelections((current) => current ? { ...current, [roadmapId]: selection } : current);
  }

  function resetScenario() {
    setSelections({ ...config!.defaults.selections });
    setExecutionMode(config!.defaults.execution_mode);
    setActiveRoadmapId(null);
    setScreen("chooser");
    setToast("Scenario reset to Stop 0");
  }

  function openRoadmap(roadmapId: string) {
    if (zoomTimerRef.current !== null) window.clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = null;
    setZoomingRoadmapId(null);
    setActiveRoadmapId(roadmapId);
    setScreen("editor");
    document.documentElement.scrollTop = 0;
  }

  function toggleRoadmap(roadmapId: string) {
    if (activeRoadmapId === roadmapId) {
      setActiveRoadmapId(null);
      return;
    }
    openRoadmap(roadmapId);
  }

  function startRoadmapViewTransition(update: () => void) {
    if (transitionInProgressRef.current) return true;
    const reduceMotion = typeof window.matchMedia !== "function"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as ViewTransitionDocument;
    if (reduceMotion || typeof transitionDocument.startViewTransition !== "function") return false;

    transitionInProgressRef.current = true;
    const transition = transitionDocument.startViewTransition(() => flushSync(update));
    void transition.finished
      .catch(() => undefined)
      .finally(() => {
        transitionInProgressRef.current = false;
      });
    return true;
  }

  function animateRoadmapMorph(roadmapId: string) {
    const chooser = document.querySelector<HTMLElement>(".path-chooser");
    const selectedRoadmap = config!.roadmaps.find((roadmap) => roadmap.id === roadmapId);
    const sourceCards = config!.roadmaps.map((roadmap) =>
      document.querySelector<HTMLElement>(`[data-testid="choose-${roadmap.id}"]`)
    );
    if (!chooser || !selectedRoadmap || sourceCards.some((card) => !card)) return false;
    const sources = sourceCards.map((sourceCard) => ({
      source: sourceCard!,
      rect: sourceCard!.getBoundingClientRect()
    }));
    if (sources.some(({ rect }) => rect.width < 1 || rect.height < 1)) return false;

    const layer = document.createElement("div");
    layer.className = "roadmap-morph-layer";
    layer.setAttribute("aria-hidden", "true");

    const backdrop = chooser.cloneNode(true) as HTMLElement;
    backdrop.className = "roadmap-morph-backdrop";
    backdrop.querySelector(".path-choice-grid")?.remove();
    layer.append(backdrop);

    const clones = sources.map(({ source, rect }, index) => {
      const clone = source.cloneNode(true) as HTMLElement;
      clone.classList.remove("is-zoom-target", "is-zoom-away");
      clone.classList.add(
        "roadmap-morph-card",
        config!.roadmaps[index]?.id === roadmapId ? "is-selected" : "is-away"
      );
      clone.removeAttribute("data-testid");
      clone.removeAttribute("disabled");
      clone.querySelectorAll("[data-testid]").forEach((node) => node.removeAttribute("data-testid"));
      Object.assign(clone.style, {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
      clone.style.setProperty("view-transition-name", "none");
      layer.append(clone);
      return { clone, rect };
    });

    document.body.append(layer);
    document.body.classList.add("roadmap-morphing");
    transitionInProgressRef.current = true;
    flushSync(() => openRoadmap(roadmapId));

    const workspace = document.querySelector<HTMLElement>(".roadmap-workspace");
    const targetRoad = document.querySelector<HTMLElement>(
      `[data-testid="commitment-road-${roadmapId}"] .road-line`
    );
    const selectedIndex = config!.roadmaps.findIndex((roadmap) => roadmap.id === roadmapId);
    const selectedClone = clones[selectedIndex]?.clone;
    const selectedRect = sources[selectedIndex]?.rect;

    if (!workspace || !targetRoad || !selectedClone || !selectedRect) {
      layer.remove();
      document.body.classList.remove("roadmap-morphing");
      transitionInProgressRef.current = false;
      return true;
    }

    const roadRect = targetRoad.getBoundingClientRect();
    if (roadRect.width < 1 || roadRect.height < 1) {
      layer.remove();
      document.body.classList.remove("roadmap-morphing");
      transitionInProgressRef.current = false;
      return true;
    }

    const dockScale = Math.max(0.16, Math.min(
      0.32,
      78 / selectedRect.height,
      112 / selectedRect.width,
      Math.max(40, roadRect.left - 12) / selectedRect.height
    ));
    const sourceCenterX = selectedRect.left + selectedRect.width / 2;
    const sourceCenterY = selectedRect.top + selectedRect.height / 2;
    const targetCenterX = roadRect.left - (selectedRect.height * dockScale) / 2;
    const targetCenterY = roadRect.top + roadRect.height / 2 + (selectedRect.width * dockScale) / 2;

    selectedClone.style.setProperty("--morph-x", `${targetCenterX - sourceCenterX}px`);
    selectedClone.style.setProperty("--morph-y", `${targetCenterY - sourceCenterY}px`);
    selectedClone.style.setProperty("--morph-scale", String(dockScale));

    const currentSelection = selections![roadmapId];
    const selectedStop = currentSelection === "none"
      ? 0
      : selectedRoadmap.stages.findIndex((stage) => stage.id === currentSelection) + 1;
    const targetProgress = targetRoad.querySelector<HTMLElement>(".road-progress");
    const originalProgressWidth = targetProgress?.style.width ?? "";
    targetRoad.style.setProperty("--road-width", `${roadRect.width}px`);
    targetRoad.style.setProperty("right", "auto");
    targetRoad.style.setProperty("width", "0px");
    if (targetProgress) {
      targetProgress.style.width = `${(selectedStop / 3) * roadRect.width}px`;
    }

    const hinge = document.createElement("span");
    hinge.className = `roadmap-morph-hinge accent-${selectedRoadmap.accent}`;
    Object.assign(hinge.style, {
      top: `${roadRect.top + roadRect.height / 2}px`,
      left: `${roadRect.left}px`
    });
    layer.append(hinge);

    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      layer.classList.add("is-running");
      workspace.classList.add("is-roadmap-arriving");
    }));

    window.setTimeout(() => {
      targetRoad.style.width = `${roadRect.width}px`;
      if (targetProgress) targetProgress.style.width = originalProgressWidth;
      workspace.classList.remove("is-roadmap-arriving");
      targetRoad.style.removeProperty("--road-width");
      targetRoad.style.removeProperty("right");
      targetRoad.style.removeProperty("width");
      layer.remove();
      document.body.classList.remove("roadmap-morphing");
      transitionInProgressRef.current = false;
    }, ROADMAP_MORPH_DURATION_MS + 100);
    return true;
  }

  function zoomIntoRoadmap(roadmapId: string) {
    if (zoomingRoadmapId || transitionInProgressRef.current) return;

    const reduceMotion = typeof window.matchMedia !== "function"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      openRoadmap(roadmapId);
      return;
    }
    if (animateRoadmapMorph(roadmapId)) return;

    setZoomingRoadmapId(roadmapId);
    zoomTimerRef.current = window.setTimeout(
      () => openRoadmap(roadmapId),
      ROADMAP_ZOOM_DURATION_MS
    );
  }

  function showChooser() {
    const update = () => {
      setActiveRoadmapId(null);
      setScreen("chooser");
      updateScreenRoute("");
      document.documentElement.scrollTop = 0;
    };
    if (screen === "editor" && startRoadmapViewTransition(update)) return;
    update();
  }

  function showPortfolio() {
    setScreen("portfolio");
    updateScreenRoute("");
    document.documentElement.scrollTop = 0;
  }

  function showMetrics() {
    setScreen("metrics");
    updateScreenRoute(
      metricsView === "reporting-suite"
        ? REPORTING_SUITE_ROUTE_HASH
        : METRICS_ROUTE_HASH
    );
    document.documentElement.scrollTop = 0;
  }

  function showMetricsView(view: MetricsView) {
    setMetricsView(view);
    setScreen("metrics");
    updateScreenRoute(
      view === "reporting-suite"
        ? REPORTING_SUITE_ROUTE_HASH
        : METRICS_ROUTE_HASH
    );
    document.documentElement.scrollTop = 0;
  }

  function updateScreenRoute(hash: string) {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${hash}`
    );
  }

  async function shareScenario() {
    const url = scenarioUrl(window.location.href, roadmapIds, selections!, executionMode);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      const copied = await Promise.race([
        navigator.clipboard.writeText(url).then(() => true, () => false),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 600))
      ]);
      if (copied) setToast("Scenario link copied");
      else setShareFallbackUrl(url);
    } catch {
      setShareFallbackUrl(url);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader
        screen={screen}
        onShowChooser={showChooser}
        onShowPortfolio={showPortfolio}
        onShowMetrics={showMetrics}
      />

      {(currentStatus?.stale || error) && (
        <div className="data-warning" role="alert">
          <TriangleAlert aria-hidden="true" size={21} />
          <span>{currentStatus?.warning ?? error}</span>
        </div>
      )}

      <main className={`app-main screen-${screen}`}>
        <section className="path-chooser-screen" hidden={screen !== "chooser"}>
          <PathChooser
            config={config}
            isOpening={!openingComplete}
            zoomingRoadmapId={zoomingRoadmapId}
            onChoose={zoomIntoRoadmap}
          />
        </section>

        <section className="path-editor-screen" hidden={screen !== "editor"}>
          <RoadmapWorkspace
            roadmaps={config.roadmaps}
            activeRoadmapId={activeRoadmapId}
            selections={selections}
            pathResults={pathResults}
            calculating={calculating}
            onActivate={toggleRoadmap}
            onSelect={updateSelection}
            onDetails={(roadmap, stage) => setDrawer({ roadmap, stage })}
            onShowChooser={showChooser}
            onShowPortfolio={showPortfolio}
          />
        </section>

        <section className="portfolio-screen" hidden={screen !== "portfolio"}>
          <div className="portfolio-action-row">
            <button type="button" className="back-button" onClick={showChooser}>
              <ArrowLeft aria-hidden="true" size={20} />
              All roadmaps
            </button>
            <div className="portfolio-action-group" aria-label="Scenario actions">
              <span className="data-date">Data {config.portfolio.last_updated}</span>
              <button className="command-button" onClick={shareScenario} data-testid="share-scenario">
                <Share2 aria-hidden="true" size={20} />
                Share
              </button>
              <button className="command-button" onClick={() => window.print()}>
                <Printer aria-hidden="true" size={20} />
                Print
              </button>
              <button className="icon-button" onClick={resetScenario} aria-label="Reset scenario" title="Reset scenario">
                <RotateCcw aria-hidden="true" size={21} />
              </button>
            </div>
          </div>

          <section className="summary-band" aria-label="Selected portfolio summary" aria-busy={calculating}>
            <SummaryMetric
              icon={Route}
              label="Roadmaps included"
              value={`${Object.values(selections).filter((selection) => selection !== "none").length} of ${config.roadmaps.length}`}
              detail="Selected commitment paths"
            />
            <SummaryMetric
              icon={CalendarRange}
              label="Calendar duration"
              value={formatNumberRange(result?.totals.calendar_months, "months")}
              detail={executionMode === "parallel" ? "Concurrent delivery" : "One package at a time"}
            />
            <SummaryMetric
              icon={UsersRound}
              label="Peak team"
              value={formatNumberRange(result?.totals.peak_fte, "FTE")}
              detail="Concurrent staffing"
            />
            <SummaryMetric
              icon={Gauge}
              label="Engineering effort"
              value={formatNumberRange(result?.totals.person_months, "person-months")}
              detail="Total delivery effort"
            />
            <SummaryMetric
              icon={Layers3}
              label="Shared capabilities"
              value={String(result?.shared_savings.work_packages.length ?? 0)}
              detail={`${formatNumberRange(result?.shared_savings.person_months, "person-months")} avoided`}
              positive
            />
            <ModeToggle value={executionMode} onChange={setExecutionMode} />
            {calculating && <span className="updating-status" role="status">Updating totals</span>}
          </section>

          <section className="portfolio-mix">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Selected portfolio</span>
                <h2>Current commitment mix</h2>
              </div>
              {config.portfolio.illustrative && <span className="illustrative-badge">Illustrative planning data</span>}
            </div>
            <div className="portfolio-path-grid">
              {config.roadmaps.map((roadmap) => {
                const pathResult = pathResults.get(roadmap.id);
                return (
                  <PortfolioPathCard
                    key={roadmap.id}
                    roadmap={roadmap}
                    selection={selections[roadmap.id]}
                    result={pathResult?.selection === selections[roadmap.id] ? pathResult : undefined}
                    onEdit={() => openRoadmap(roadmap.id)}
                  />
                );
              })}
            </div>
          </section>

          <nav className="view-tabs" role="tablist" aria-label="Portfolio views">
            {VIEW_OPTIONS.map(({ id, label, icon: Icon }, index) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                type="button"
                aria-selected={activeView === id}
                aria-controls={`panel-${id}`}
                tabIndex={activeView === id ? 0 : -1}
                className={activeView === id ? "active" : ""}
                onClick={() => setActiveView(id)}
                onKeyDown={(event) => handleTabKey(event, index, setActiveView)}
              >
                <Icon aria-hidden="true" size={20} />
                {label}
              </button>
            ))}
          </nav>

          <section
            id="panel-comparison"
            className="view-panel"
            role="tabpanel"
            aria-labelledby="tab-comparison"
            hidden={activeView !== "comparison"}
          >
            {result && <ComparisonView config={config} result={result} />}
          </section>

          <section
            id="panel-delivery"
            className="view-panel"
            role="tabpanel"
            aria-labelledby="tab-delivery"
            hidden={activeView !== "delivery"}
          >
            {result && <DeliveryView config={config} result={result} />}
          </section>

          <section
            id="panel-assumptions"
            className="view-panel"
            role="tabpanel"
            aria-labelledby="tab-assumptions"
            hidden={activeView !== "assumptions"}
          >
            <AssumptionsView config={config} />
          </section>
        </section>

        <section className="metrics-screen" hidden={screen !== "metrics"}>
          <MetricsPage
            evidence={metrics}
            activeView={metricsView}
            onViewChange={showMetricsView}
          />
        </section>
      </main>

      {drawer && (
        <StageDrawer
          drawer={drawer}
          packageMap={packageMap}
          onClose={() => setDrawer(null)}
        />
      )}

      {shareFallbackUrl && (
        <ShareDialog
          url={shareFallbackUrl}
          onClose={() => setShareFallbackUrl(null)}
          onCopied={() => {
            setShareFallbackUrl(null);
            setToast("Scenario link copied");
          }}
        />
      )}

      {toast && <div className="toast" role="status"><Check aria-hidden="true" size={20} />{toast}</div>}
    </div>
  );
}

function AppHeader({
  screen,
  onShowChooser,
  onShowPortfolio,
  onShowMetrics
}: {
  screen: AppScreen;
  onShowChooser: () => void;
  onShowPortfolio: () => void;
  onShowMetrics: () => void;
}) {
  const pathsAreCurrent = screen === "chooser" || screen === "editor";

  return (
    <header className="global-nav" aria-label="Global navigation">
      <div className="global-nav-inner">
        <button type="button" className="global-nav-brand" onClick={onShowChooser}>
          <Route aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>Roadmaps</span>
        </button>
        <nav className="global-nav-links" aria-label="Primary navigation">
          <button
            type="button"
            className={pathsAreCurrent ? "is-current" : ""}
            aria-current={pathsAreCurrent ? "page" : undefined}
            onClick={onShowChooser}
          >
            Paths
          </button>
          <button
            type="button"
            className={screen === "portfolio" ? "is-current" : ""}
            aria-current={screen === "portfolio" ? "page" : undefined}
            onClick={onShowPortfolio}
          >
            Portfolio
          </button>
          <button
            type="button"
            className={screen === "metrics" ? "is-current" : ""}
            aria-current={screen === "metrics" ? "page" : undefined}
            onClick={onShowMetrics}
          >
            Metrics
          </button>
        </nav>
      </div>
    </header>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <span className="brand-mark" aria-hidden="true"><Route size={28} /></span>
      <div className="loading-line" />
      <p>Loading portfolio roadmaps</p>
    </main>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail,
  positive = false
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className={`summary-metric${positive ? " positive" : ""}`}>
      <div className="summary-label"><Icon aria-hidden="true" size={19} />{label}</div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function ModeToggle({ value, onChange }: { value: ExecutionMode; onChange: (mode: ExecutionMode) => void }) {
  return (
    <div className="mode-control">
      <span className="summary-label"><GitCompareArrows aria-hidden="true" size={19} />Delivery mode</span>
      <div className="segmented-control" role="group" aria-label="Delivery mode">
        {(["parallel", "sequential"] as ExecutionMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={value === mode ? "selected" : ""}
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
            data-testid={`mode-${mode}`}
          >
            {sentenceCase(mode)}
          </button>
        ))}
      </div>
    </div>
  );
}

function PathChooser({
  config,
  isOpening,
  zoomingRoadmapId,
  onChoose
}: {
  config: PortfolioConfig;
  isOpening: boolean;
  zoomingRoadmapId: string | null;
  onChoose: (roadmapId: string) => void;
}) {
  const isZooming = zoomingRoadmapId !== null;
  return (
    <div className={`path-chooser${isOpening ? " is-opening" : ""}${isZooming ? " is-zooming" : ""}`}>
      <div className="chooser-intro">
        <h2>Development Path</h2>
      </div>

      <div className="chooser-trident" data-testid="chooser-trident" aria-hidden="true">
        <svg viewBox="0 0 1440 58" preserveAspectRatio="none">
          <path className="chooser-stem" pathLength="1" d="M720 0V14" />
          {config.roadmaps.map((roadmap, index) => {
            const route = CHOOSER_ROUTE_PATHS[index];
            if (!route) return null;
            return (
              <g key={roadmap.id} className={`chooser-route-${roadmap.accent}`}>
                <path
                  className="chooser-branch"
                  pathLength="1"
                  d={route.path}
                  vectorEffect="non-scaling-stroke"
                />
                <circle className="chooser-endpoint" cx={route.endX} cy="55" r="3" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="path-choice-grid" aria-label="Available roadmaps" aria-busy={isZooming || isOpening}>
        {config.roadmaps.map((roadmap) => {
          const Icon = ICONS[roadmap.icon];
          return (
            <button
              key={roadmap.id}
              type="button"
              className={`path-choice accent-${roadmap.accent}${
                zoomingRoadmapId === roadmap.id
                  ? " is-zoom-target"
                  : isZooming
                    ? " is-zoom-away"
                    : ""
              }`}
              onClick={() => onChoose(roadmap.id)}
              disabled={isZooming}
              data-testid={`choose-${roadmap.id}`}
              style={{ viewTransitionName: `roadmap-${roadmap.id}` } as CSSProperties}
            >
              <span className="choice-visual" aria-hidden="true">
                <Icon className="choice-visual-icon" size={64} strokeWidth={1.45} />
                <span className="choice-milestones">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
              <span className="choice-copy">
                <strong>{roadmap.name}</strong>
              </span>
              <span className="choice-action" aria-hidden="true">
                <ChevronRight size={22} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoadmapWorkspace({
  roadmaps,
  activeRoadmapId,
  selections,
  pathResults,
  calculating,
  onActivate,
  onSelect,
  onDetails,
  onShowChooser,
  onShowPortfolio
}: {
  roadmaps: Roadmap[];
  activeRoadmapId: string | null;
  selections: Record<string, StageSelection>;
  pathResults: Map<string, PathResult>;
  calculating: boolean;
  onActivate: (roadmapId: string) => void;
  onSelect: (roadmapId: string, selection: StageSelection) => void;
  onDetails: (roadmap: Roadmap, stage: RoadmapStage) => void;
  onShowChooser: () => void;
  onShowPortfolio: () => void;
}) {
  const activeIndex = roadmaps.findIndex((roadmap) => roadmap.id === activeRoadmapId);
  const hasActiveRoadmap = activeIndex >= 0;

  return (
    <div className="roadmap-workspace">
      <div className={`roadmap-screen-stack${hasActiveRoadmap ? "" : " is-collapsed"}`} role="group" aria-label="Roadmap workspace">
        {roadmaps.map((roadmap, index) => {
          const Icon = ICONS[roadmap.icon];
          const selection = selections[roadmap.id];
          const currentResult = pathResults.get(roadmap.id);
          const result = currentResult?.selection === selection ? currentResult : undefined;
          const isActive = roadmap.id === activeRoadmapId;
          const isAbove = hasActiveRoadmap && index < activeIndex;
          const panelId = `${roadmap.id}-workspace-panel`;

          return (
            <section
              key={roadmap.id}
              className={`roadmap-screen accent-${roadmap.accent}${isActive ? " is-active" : !hasActiveRoadmap ? " is-collapsed" : isAbove ? " is-above" : " is-below"}`}
              data-testid={`roadmap-screen-${roadmap.id}`}
              style={{ viewTransitionName: `roadmap-${roadmap.id}` } as CSSProperties}
            >
              <button
                type="button"
                className="roadmap-screen-header"
                aria-expanded={isActive}
                aria-controls={panelId}
                onClick={() => onActivate(roadmap.id)}
                data-testid={`roadmap-screen-header-${roadmap.id}`}
              >
                <span className="roadmap-screen-identity">
                  <span className="roadmap-icon" aria-hidden="true"><Icon size={23} /></span>
                  <strong>{roadmap.name}</strong>
                </span>
                <span className="roadmap-screen-direction">
                  {isActive ? (
                    <><Minus aria-hidden="true" size={22} /><span className="sr-only">Minimize roadmap</span></>
                  ) : !hasActiveRoadmap ? (
                    <><Plus aria-hidden="true" size={22} /><span className="sr-only">Expand roadmap</span></>
                  ) : isAbove ? (
                    <><ChevronDown aria-hidden="true" size={22} /><span className="sr-only">Expand downward</span></>
                  ) : (
                    <><ChevronUp aria-hidden="true" size={22} /><span className="sr-only">Expand upward</span></>
                  )}
                </span>
              </button>

              {isActive && (
                <RoadmapScreenContent
                  panelId={panelId}
                  roadmap={roadmap}
                  selection={selection}
                  result={result}
                  calculating={calculating}
                  onSelect={(nextSelection) => onSelect(roadmap.id, nextSelection)}
                  onDetails={(stage) => onDetails(roadmap, stage)}
                  onShowChooser={onShowChooser}
                  onShowPortfolio={onShowPortfolio}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RoadmapScreenContent({
  panelId,
  roadmap,
  selection,
  result,
  calculating,
  onSelect,
  onDetails,
  onShowChooser,
  onShowPortfolio
}: {
  panelId: string;
  roadmap: Roadmap;
  selection: StageSelection;
  result?: PathResult;
  calculating: boolean;
  onSelect: (selection: StageSelection) => void;
  onDetails: (stage: RoadmapStage) => void;
  onShowChooser: () => void;
  onShowPortfolio: () => void;
}) {
  const [revealedSelection, setRevealedSelection] = useState<StageSelection | null>(null);
  const selectedStage = selection === "none"
    ? undefined
    : roadmap.stages.find((stage) => stage.id === selection);
  const selectedStop = selection === "none"
    ? 0
    : roadmap.stages.findIndex((stage) => stage.id === selection) + 1;
  const commitmentStops: Array<{
    selection: StageSelection;
    label: string;
  }> = [
    {
      selection: "none",
      label: "None"
    },
    ...roadmap.stages.map((stage) => ({
      selection: stage.id,
      label: stage.label
    }))
  ];

  function chooseStop(nextSelection: StageSelection) {
    setRevealedSelection(nextSelection);
    onSelect(nextSelection);
  }

  return (
    <div
      id={panelId}
      className="roadmap-screen-body"
      role="region"
      aria-label={`${roadmap.name} commitment editor`}
    >
      <nav className="roadmap-screen-navigation" aria-label="Roadmap navigation">
        <button type="button" className="back-button" onClick={onShowChooser}>
          <ArrowLeft aria-hidden="true" size={20} />
          All roadmaps
        </button>
        <button type="button" className="command-button" onClick={onShowPortfolio}>
          <GitCompareArrows aria-hidden="true" size={19} />
          Review portfolio
        </button>
      </nav>

      <section className="commitment-journey">
        <div className="commitment-road" data-testid={`commitment-road-${roadmap.id}`}>
          <div className="road-line" aria-hidden="true">
            <span className="road-progress" style={{ width: `${(selectedStop / 3) * 100}%` }} />
          </div>
          <div className="road-stop-grid" role="group" aria-label={`${roadmap.name} commitment stops`}>
            {commitmentStops.map((stop, index) => {
              const isSelected = selection === stop.selection;
              const isRevealed = revealedSelection === stop.selection;
              return (
                <button
                  key={stop.selection}
                  type="button"
                  className={`commitment-stop${isSelected ? " selected" : ""}${isRevealed ? " is-revealed" : ""}`}
                  aria-pressed={isSelected}
                  aria-label={`Stop ${index}: ${stop.label}`}
                  onClick={() => chooseStop(stop.selection)}
                  data-testid={`${roadmap.id}-${stop.selection}`}
                >
                  <span className="stop-marker" aria-hidden="true">
                    <span>{index}</span>
                    {isRevealed && <Check size={18} strokeWidth={2.6} />}
                  </span>
                  <span className="stop-copy">
                    <strong>{stop.label}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {revealedSelection !== null && (
        <section className="commitment-selection" aria-live="polite" aria-busy={calculating}>
          <div className="commitment-outcome">
            <span className="section-kicker">Stop {selectedStop}</span>
            <h3>{selectedStage?.name ?? "Not selected"}</h3>
            <p>{selectedStage?.summary ?? "This path remains outside the portfolio."}</p>
          </div>

          <dl className="commitment-metrics">
            <div>
              <dt>Commitment level</dt>
              <dd>{selectedStage?.label ?? "None"}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{calculating && !result ? "Updating" : formatNumberRange(result?.calendar_months, "months")}</dd>
            </div>
            <div>
              <dt>Effort</dt>
              <dd>{calculating && !result ? "Updating" : formatNumberRange(result?.person_months, "person-months")}</dd>
            </div>
          </dl>

          {selectedStage && (
            <button type="button" className="command-button commitment-details" onClick={() => onDetails(selectedStage)}>
              <Info aria-hidden="true" size={19} />
              Full details
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function PortfolioPathCard({
  roadmap,
  selection,
  result,
  onEdit
}: {
  roadmap: Roadmap;
  selection: StageSelection;
  result?: PathResult;
  onEdit: () => void;
}) {
  const Icon = ICONS[roadmap.icon];
  const selectedStage = selection === "none"
    ? undefined
    : roadmap.stages.find((stage) => stage.id === selection);

  return (
    <article className={`portfolio-path-card accent-${roadmap.accent}`}>
      <header>
        <span className="roadmap-icon" aria-hidden="true"><Icon size={23} /></span>
        <div>
          <h3>{roadmap.name}</h3>
          <span>{selection === "none" ? "Not funded" : selectedStage?.label}</span>
        </div>
      </header>
      <div className="portfolio-path-choice">
        <strong>{selectedStage?.name ?? "Path excluded"}</strong>
      </div>
      <div className="portfolio-path-meta">
        <span>{formatNumberRange(result?.calendar_months, "months")}</span>
        <span>{formatNumberRange(result?.person_months, "person-months")}</span>
      </div>
      <button type="button" className="details-button" onClick={onEdit} aria-label={`Edit ${roadmap.name}`}>
        Edit path
        <ChevronRight aria-hidden="true" size={19} />
      </button>
    </article>
  );
}

function PathStat({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function ComparisonView({ config, result }: { config: PortfolioConfig; result: ScenarioResult }) {
  const visibleCallouts = result.callouts.filter(
    (callout) => callout.kind !== "cost_driver" && callout.kind !== "shared_savings"
  );

  return (
    <div className="comparison-view">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Decision signals</span>
          <h2>Scenario comparison</h2>
        </div>
        <span className="mode-badge">{sentenceCase(result.execution_mode)} delivery</span>
      </div>

      {visibleCallouts.length > 0 && <div className="callout-grid">
        {visibleCallouts.map((callout) => {
          const Icon = CALLOUT_ICONS[callout.kind];
          return (
            <article key={callout.kind} className={`callout callout-${callout.tone}`}>
              <Icon aria-hidden="true" size={21} />
              <div><strong>{callout.title}</strong><p>{callout.body}</p></div>
            </article>
          );
        })}
      </div>}

      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <caption className="sr-only">Side-by-side roadmap comparison</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              {result.paths.map((path) => <th scope="col" key={path.roadmap_id}>{path.name}</th>)}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow label="Selected depth" paths={result.paths} render={(path) => (
              <><strong>{path.stage_name}</strong><span>{sentenceCase(path.selection)}</span></>
            )} />
            <ComparisonRow label="Calendar duration" paths={result.paths} render={(path) => (
              <strong>{formatNumberRange(path.calendar_months, "months")}</strong>
            )} />
            <ComparisonRow label="Peak team" paths={result.paths} render={(path) => (
              <strong>{formatNumberRange(path.peak_fte, "FTE")}</strong>
            )} />
            <ComparisonRow label="Engineering effort" paths={result.paths} render={(path) => (
              <strong>{formatNumberRange(path.person_months, "person-months")}</strong>
            )} />
            <ComparisonRow label="Estimate posture" paths={result.paths} render={(path) => (
              path.confidence && path.risk
                ? <StatusPair confidence={path.confidence} risk={path.risk} />
                : <span className="muted">Not selected</span>
            )} />
            <ComparisonRow label="Impact profile" paths={result.paths} render={(path) => (
              path.impact
                ? <ImpactProfile impact={path.impact} dimensions={config.impact_dimensions} />
                : <span className="muted">Not selected</span>
            )} />
            <ComparisonRow label="Outcome targets" paths={result.paths} render={(path) => (
              path.kpis.length ? <KpiList items={path.kpis} /> : <span className="muted">Not selected</span>
            )} />
            <ComparisonRow label="Key risks" paths={result.paths} render={(path) => (
              path.risks.length ? <BulletList items={path.risks} /> : <span className="muted">Not selected</span>
            )} />
          </tbody>
        </table>
      </div>

      <div className="comparison-mobile">
        {result.paths.map((path) => (
          <article key={path.roadmap_id} className={`mobile-path accent-${path.accent}`}>
            <h3>{path.name}</h3>
            <strong className="mobile-stage">{path.stage_name}</strong>
            <dl>
              <div><dt>Calendar duration</dt><dd>{formatNumberRange(path.calendar_months, "months")}</dd></div>
              <div><dt>Peak team</dt><dd>{formatNumberRange(path.peak_fte, "FTE")}</dd></div>
              <div><dt>Engineering effort</dt><dd>{formatNumberRange(path.person_months, "person-months")}</dd></div>
            </dl>
            {path.impact && <ImpactProfile impact={path.impact} dimensions={config.impact_dimensions} />}
            {path.kpis.length > 0 && <><h4>Outcome targets</h4><KpiList items={path.kpis} /></>}
            {path.risks.length > 0 && <><h4>Key risks</h4><BulletList items={path.risks} /></>}
          </article>
        ))}
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  paths,
  render
}: {
  label: string;
  paths: PathResult[];
  render: (path: PathResult) => ReactNode;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {paths.map((path) => <td key={path.roadmap_id}>{render(path)}</td>)}
    </tr>
  );
}

function ImpactProfile({ impact, dimensions }: { impact: ImpactRatings; dimensions: ImpactDimension[] }) {
  return (
    <div className="impact-profile">
      {dimensions.map((dimension) => {
        const rating = impact[dimension.key];
        return (
          <div key={dimension.key} className="impact-row">
            <span>{dimension.label}</span>
            <div className="impact-bar" aria-hidden="true">
              <span style={{ width: `${rating * 20}%` }} />
            </div>
            <strong aria-label={`${dimension.label}: ${rating} out of 5`}>{rating}/5</strong>
          </div>
        );
      })}
    </div>
  );
}

function KpiList({ items }: { items: PathResult["kpis"] }) {
  return (
    <ul className="kpi-list">
      {items.map((kpi, index) => (
        <li key={`${kpi.label}-${index}`}>
          <div><strong>{kpi.target}</strong><span>{kpi.label}</span></div>
          <p>{kpi.context}</p>
        </li>
      ))}
    </ul>
  );
}

function BulletList({ items }: { items: string[] }) {
  return <ul className="bullet-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function StatusPair({ confidence, risk }: { confidence: string; risk: string }) {
  return (
    <div className="status-pair">
      <span className={`status status-${confidence}`}>{sentenceCase(confidence)} confidence</span>
      <span className={`status risk-${risk}`}>{sentenceCase(risk)} risk</span>
    </div>
  );
}

function DeliveryView({ config, result }: { config: PortfolioConfig; result: ScenarioResult }) {
  const maxMonths = Math.max(result.schedule.calendar_months.high, 1);
  const accentByRoadmap = new Map(config.roadmaps.map((roadmap) => [roadmap.id, roadmap.accent]));

  return (
    <div className="delivery-view">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Execution profile</span>
          <h2>Delivery and capacity plan</h2>
        </div>
        <span className="mode-badge">{sentenceCase(result.execution_mode)} delivery</span>
      </div>

      <section className="timeline-section">
        <div className="subsection-heading">
          <div><h3>Work-package timeline</h3><p>Bars use the high estimate; total duration is shown as a low-high range.</p></div>
          <strong>{formatNumberRange(result.schedule.calendar_months, "months")}</strong>
        </div>
        {result.schedule.items.length ? (
          <div className="timeline-scroll">
            <div className="timeline" style={{ minWidth: "900px" }}>
              <div className="timeline-axis">
                <span />
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                  <span key={fraction}>{Math.round(maxMonths * fraction)} mo</span>
                ))}
              </div>
              {result.schedule.items.map((item) => {
                const left = (item.start_high / maxMonths) * 100;
                const width = Math.max(1.5, ((item.end_high - item.start_high) / maxMonths) * 100);
                const itemAccent: Accent | "shared" = item.shared
                  ? "shared"
                  : (accentByRoadmap.get(item.roadmap_ids[0]) ?? "blue");
                const style = { "--bar-left": `${left}%`, "--bar-width": `${width}%` } as CSSProperties;
                return (
                  <div className="timeline-row" key={item.id}>
                    <div className="timeline-label">
                      <strong>{item.name}</strong>
                      <span>{item.shared ? "Shared capability" : item.roadmap_ids.map((id) => config.roadmaps.find((roadmap) => roadmap.id === id)?.short_name).filter(Boolean).join(", ")}</span>
                    </div>
                    <div className="timeline-track">
                      <span className="timeline-gridline quarter-1" />
                      <span className="timeline-gridline quarter-2" />
                      <span className="timeline-gridline quarter-3" />
                      <span
                        className={`timeline-bar bar-${itemAccent}`}
                        style={style}
                        aria-label={`${item.name}: month ${compactNumber(item.start_high)} to ${compactNumber(item.end_high)}`}
                      >
                        <span>{compactNumber(item.end_high - item.start_high)} mo</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <p className="empty-state">No work packages are selected.</p>}
      </section>

      <section className="shared-section">
        <div className="subsection-heading">
          <div><h3>Shared foundation</h3><p>Capabilities used by more than one selected roadmap.</p></div>
          <strong>{formatNumberRange(result.shared_savings.person_months, "person-months")} avoided</strong>
        </div>
        {result.shared_savings.work_packages.length ? (
          <div className="shared-list">
            {result.shared_savings.work_packages.map((item) => <span key={item}><Database aria-hidden="true" size={18} />{item}</span>)}
          </div>
        ) : <p className="empty-state">The current selection does not reuse work across paths.</p>}
      </section>
    </div>
  );
}

function AssumptionsView({ config }: { config: PortfolioConfig }) {
  return (
    <div className="assumptions-view">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Estimate basis</span>
          <h2>Assumptions and interpretation</h2>
        </div>
        <span className="mode-badge">Updated {config.portfolio.last_updated}</span>
      </div>
      <div className="source-note"><Info aria-hidden="true" size={22} /><p>{config.portfolio.source_note}</p></div>
      <div className="assumption-layout">
        <section>
          <h3>Planning assumptions</h3>
          <ol className="assumption-list">
            {config.assumptions.map((assumption, index) => (
              <li key={assumption}><span>{index + 1}</span><p>{assumption}</p></li>
            ))}
          </ol>
        </section>
        <section>
          <h3>Impact scale</h3>
          <div className="dimension-list">
            {config.impact_dimensions.map((dimension) => (
              <div key={dimension.key}>
                <strong>{dimension.label}</strong>
                <p>{dimension.description}</p>
              </div>
            ))}
          </div>
          <div className="range-key">
            <strong>Range convention</strong>
            <p>Low and high values are calculated independently. They are not confidence intervals or best/base/worst cases.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function StageDrawer({
  drawer,
  packageMap,
  onClose
}: {
  drawer: DrawerState;
  packageMap: Map<string, WorkPackage>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const packages = drawer.stage.work_packages.map((id) => packageMap.get(id)).filter(Boolean) as WorkPackage[];
  const stageEffort = sumRanges(packages.map((item) => item.person_months));
  const Icon = ICONS[drawer.roadmap.icon];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" aria-hidden="true" onClick={onClose} />
      <aside
        className={`stage-drawer accent-${drawer.roadmap.accent}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        data-testid="stage-drawer"
      >
        <header className="drawer-header">
          <span className="roadmap-icon" aria-hidden="true"><Icon size={25} /></span>
          <div>
            <span>{drawer.roadmap.name} / {drawer.stage.label}</span>
            <h2 id="drawer-title">{drawer.stage.name}</h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close stage details">
            <X aria-hidden="true" size={23} />
          </button>
        </header>
        <div className="drawer-content">
          <p className="drawer-summary">{drawer.stage.summary}</p>
          <div className="drawer-metrics">
            <PathStat label="Incremental effort" value={formatNumberRange(stageEffort, "person-months")} />
            <PathStat label="Work packages" value={String(packages.length)} />
          </div>

          <section>
            <h3>Stage Deliverables</h3>
            <BulletList items={drawer.stage.deliverables} />
          </section>

          <section>
            <h3>Outcome targets</h3>
            <KpiList items={drawer.stage.kpis} />
          </section>

          <section>
            <h3>Work packages added</h3>
            <div className="package-list">
              {packages.map((item) => (
                <article key={item.id}>
                  <div className="package-heading">
                    <div><strong>{item.name}</strong>{item.shared && <span className="shared-tag">Shared</span>}</div>
                    <StatusPair confidence={item.confidence} risk={item.risk} />
                  </div>
                  <p>{item.description}</p>
                  <dl>
                    <div><dt>Duration</dt><dd>{formatNumberRange(item.duration_months, "months")}</dd></div>
                    <div><dt>Team</dt><dd>{formatNumberRange(item.team_fte, "FTE")}</dd></div>
                  </dl>
                  {item.dependencies.length > 0 && (
                    <p className="dependency-line"><Link2 aria-hidden="true" size={17} />Depends on {item.dependencies.map((id) => packageMap.get(id)?.name ?? id).join(", ")}</p>
                  )}
                  <BulletList items={item.outcomes} />
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3>Key risks</h3>
            <BulletList items={drawer.stage.risks} />
          </section>
        </div>
      </aside>
    </div>
  );
}

function ShareDialog({ url, onClose, onCopied }: { url: string; onClose: () => void; onCopied: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.select(), []);

  function copyFallback() {
    inputRef.current?.select();
    try {
      if (document.execCommand("copy")) onCopied();
    } catch {
      inputRef.current?.select();
    }
  }

  return (
    <div className="dialog-layer" role="presentation">
      <div className="drawer-backdrop" aria-hidden="true" onClick={onClose} />
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="dialog-heading">
          <div><span className="section-kicker">Share scenario</span><h2 id="share-title">Scenario link</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close share dialog"><X aria-hidden="true" size={22} /></button>
        </div>
        <p>Use this link to reopen the same roadmap depths and delivery mode.</p>
        <label htmlFor="share-url">Link</label>
        <input ref={inputRef} id="share-url" readOnly value={url} />
        <button className="primary-button" onClick={copyFallback}><Copy aria-hidden="true" size={20} />Copy link</button>
      </section>
    </div>
  );
}

function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number, setView: (view: ViewName) => void) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const nextIndex = (currentIndex + direction + VIEW_OPTIONS.length) % VIEW_OPTIONS.length;
  setView(VIEW_OPTIONS[nextIndex].id);
  document.getElementById(`tab-${VIEW_OPTIONS[nextIndex].id}`)?.focus();
}

function sumRanges(ranges: NumericRange[]): NumericRange {
  return ranges.reduce(
    (total, current) => ({ low: total.low + current.low, high: total.high + current.high }),
    { low: 0, high: 0 }
  );
}

function compactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export default App;
