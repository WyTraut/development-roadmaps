import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type {
  ExecutionMode,
  PathResult,
  PortfolioConfig,
  ScenarioResult,
  StageSelection
} from "../types";

const range = { low: 10, high: 20 };
const zero = { low: 0, high: 0 };
const cost = {
  loaded_labor: { low: 70000, high: 100000 },
  vendors: { low: 10000, high: 15000 },
  software_cloud: { low: 10000, high: 20000 },
  contingency: { low: 10000, high: 15000 }
};

const stageNames = {
  foundation: "Inventory & Guardrails",
  scale: "Workflow Orchestration",
  full: "Closed-loop Operations"
};

const config: PortfolioConfig = {
  portfolio: {
    title: "Technology Portfolio Roadmaps",
    subtitle: "Compare three internal IT paths.",
    program_label: "2026-2028 planning",
    currency: "USD",
    last_updated: "2026-07-13",
    illustrative: true,
    source_note: "Illustrative estimates."
  },
  defaults: {
    selections: {
      network_automation: "none",
      reporting: "none",
      audit_automation: "none"
    },
    execution_mode: "parallel"
  },
  impact_dimensions: [
    { key: "efficiency", label: "Efficiency", description: "Less manual work." },
    { key: "risk_reduction", label: "Risk reduction", description: "Stronger controls." },
    { key: "decision_visibility", label: "Decision visibility", description: "Faster insight." },
    { key: "scalability", label: "Scalability", description: "More capacity." }
  ],
  work_packages: [
    {
      id: "shared_foundation",
      name: "Shared foundation",
      description: "Reusable data and workflow foundation.",
      shared: true,
      dependencies: [],
      cost,
      duration_months: { low: 2, high: 3 },
      team_fte: { low: 2, high: 3 },
      person_months: { low: 4, high: 7 },
      confidence: "high",
      risk: "low",
      outcomes: ["Reusable foundation is available."]
    }
  ],
  roadmaps: [
    roadmap("network_automation", "Network Automation", "Network", "emerald", "network"),
    roadmap("reporting", "Reporting", "Reporting", "blue", "reporting"),
    roadmap("audit_automation", "Audit Automation", "Audit", "amber", "audit")
  ],
  assumptions: ["Estimates are illustrative."]
};

function roadmap(
  id: string,
  name: string,
  shortName: string,
  accent: "emerald" | "blue" | "amber",
  icon: "network" | "reporting" | "audit"
) {
  return {
    id,
    name,
    short_name: shortName,
    summary: `${name} strategy.`,
    accent,
    icon,
    stages: (Object.entries(stageNames) as Array<["foundation" | "scale" | "full", string]>).map(
      ([stageId, stageName], index) => ({
        id: stageId,
        label: stageId === "full" ? "Full Vision" : stageId[0].toUpperCase() + stageId.slice(1),
        name: stageName,
        summary: `${stageName} summary.`,
        work_packages: ["shared_foundation"],
        deliverables: [`${stageName} deliverable`],
        kpis: [{ label: "Cycle time", target: `${10 + index * 10}%`, context: "Illustrative target." }],
        impact: {
          efficiency: 3 + index,
          risk_reduction: 3,
          decision_visibility: 3,
          scalability: 3 + index
        },
        risks: [`${stageName} risk`]
      })
    )
  };
}

function scenario(
  selections: Record<string, StageSelection>,
  executionMode: ExecutionMode
): ScenarioResult {
  const paths: PathResult[] = config.roadmaps.map((item) => {
    const selection = selections[item.id];
    const selectedStage = selection === "none" ? null : item.stages.find((stage) => stage.id === selection)!;
    return {
      roadmap_id: item.id,
      name: item.name,
      short_name: item.short_name,
      accent: item.accent,
      selection,
      stage_name: selectedStage?.name ?? "No investment",
      standalone_investment: selection === "none" ? zero : { low: 100000, high: 150000 },
      cost_breakdown: selection === "none" ? {
        loaded_labor: zero,
        vendors: zero,
        software_cloud: zero,
        contingency: zero
      } : cost,
      calendar_months: selection === "none" ? zero : { low: 3, high: 5 },
      peak_fte: selection === "none" ? zero : { low: 2, high: 4 },
      person_months: selection === "none" ? zero : { low: 8, high: 12 },
      work_package_ids: selection === "none" ? [] : ["shared_foundation"],
      deliverables: selectedStage?.deliverables ?? [],
      kpis: selectedStage?.kpis ?? [],
      impact: selectedStage?.impact ?? null,
      risks: selectedStage?.risks ?? [],
      confidence: selection === "none" ? null : "high",
      risk: selection === "none" ? null : "low"
    };
  });

  return {
    config_version: "2026-07-13",
    execution_mode: executionMode,
    selections,
    totals: {
      investment: { low: 100000, high: 150000 },
      cost_breakdown: cost,
      calendar_months: { low: 3, high: 5 },
      peak_fte: { low: 5, high: 8 },
      person_months: { low: 20, high: 30 }
    },
    paths,
    schedule: {
      execution_mode: executionMode,
      calendar_months: { low: 3, high: 5 },
      peak_fte: { low: 5, high: 8 },
      items: []
    },
    shared_savings: {
      investment: { low: 20000, high: 30000 },
      person_months: { low: 2, high: 4 },
      work_packages: ["Shared foundation"]
    },
    callouts: [
      { kind: "cost_driver", title: "Largest cost driver", body: "Shared foundation contributes $100K-$150K.", tone: "neutral" },
      { kind: "shared_savings", title: "Shared foundation value", body: "Reusable work avoids $20K-$30K.", tone: "positive" }
    ],
    data_status: { stale: false, warning: null, loaded_at: "2026-07-13T12:00:00Z" }
  };
}

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

describe("App", () => {
  const clipboardWrite = vi.fn();

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    clipboardWrite.mockReset();
    clipboardWrite.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      get: () => ({ writeText: clipboardWrite })
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/portfolio")) {
        return jsonResponse({
          config,
          data_status: { stale: false, warning: null, loaded_at: "2026-07-13T12:00:00Z" }
        });
      }
      const body = JSON.parse(String(init?.body)) as {
        selections: Record<string, StageSelection>;
        execution_mode: ExecutionMode;
      };
      return jsonResponse(scenario(body.selections, body.execution_mode));
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("draws a three-branch path into the live chooser", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })));
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Development Path" })
    ).toBeVisible();
    const trident = screen.getByTestId("chooser-trident");
    expect(trident.querySelectorAll(".chooser-branch")).toHaveLength(3);
    expect(trident.closest(".path-chooser")).toHaveClass("is-opening");

    await waitFor(
      () => expect(trident.closest(".path-chooser")).not.toHaveClass("is-opening"),
      { timeout: 2200 }
    );
    expect(screen.getByLabelText("Available roadmaps").querySelectorAll("button")).toHaveLength(3);
    expect(screen.queryByText("Current level")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose this path")).not.toBeInTheDocument();
  });

  it("opens on a three-path chooser and edits one roadmap at a time", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Development Path" })).toBeVisible();
    expect(screen.getByRole("banner", { name: "Global navigation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Paths" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Available roadmaps").querySelectorAll("button")).toHaveLength(3);
    expect(screen.queryByText("Current level")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose this path")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-2028 planning")).not.toBeInTheDocument();
    expect(screen.queryByText("Start with the roadmap that matters most. Then choose how far to take it.")).not.toBeInTheDocument();
    expect(screen.queryByText("Path 01")).not.toBeInTheDocument();
    expect(screen.queryByText("Network Automation strategy.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Selected portfolio summary")).not.toBeVisible();

    await user.click(screen.getByTestId("choose-network_automation"));
    const networkEditor = screen.getByRole("region", { name: "Network Automation commitment editor" });
    expect(networkEditor).toBeVisible();
    expect(screen.getByLabelText("Roadmap workspace").querySelectorAll(".roadmap-screen")).toHaveLength(3);
    expect(screen.getByTestId("roadmap-screen-network_automation")).toHaveClass("is-active");
    expect(screen.getByTestId("roadmap-screen-reporting")).toHaveClass("is-below");
    expect(screen.getByTestId("roadmap-screen-audit_automation")).toHaveClass("is-below");
    expect(screen.getByTestId("commitment-road-network_automation")).toBeVisible();
    expect(screen.getByLabelText("Network Automation commitment stops").querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByTestId("network_automation-none")).toHaveAccessibleName("Stop 0: None");
    expect(screen.getByTestId("network_automation-none")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Choose your commitment")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose a stop. Every stop includes the work from each stop before it.")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\$/);
    expect(within(networkEditor).queryByRole("button", { name: "Full details" })).not.toBeInTheDocument();

    await user.click(screen.getByTestId("network_automation-foundation"));
    expect(await within(networkEditor).findByRole("heading", { name: "Inventory & Guardrails" })).toBeVisible();
    expect(within(networkEditor).getByText("Inventory & Guardrails summary.")).toBeVisible();
    const commitmentSelection = networkEditor.querySelector(".commitment-selection") as HTMLElement;
    expect(within(commitmentSelection).getByText("Commitment level")).toBeVisible();
    expect(within(commitmentSelection).getByText("Foundation")).toBeVisible();
    expect(document.body).not.toHaveTextContent(/\$/);
    expect(within(networkEditor).getByRole("button", { name: "Full details" })).toBeVisible();

    await user.click(screen.getByTestId("roadmap-screen-header-network_automation"));
    expect(screen.getByLabelText("Roadmap workspace")).toHaveClass("is-collapsed");
    expect(screen.queryByRole("region", { name: "Network Automation commitment editor" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Expand roadmap")).toHaveLength(3);

    await user.click(screen.getByTestId("roadmap-screen-header-network_automation"));
    expect(screen.getByRole("region", { name: "Network Automation commitment editor" })).toBeVisible();

    await user.click(screen.getByTestId("roadmap-screen-header-reporting"));
    expect(screen.getByTestId("roadmap-screen-network_automation")).toHaveClass("is-above");
    expect(screen.getByTestId("roadmap-screen-reporting")).toHaveClass("is-active");
    expect(screen.getByTestId("roadmap-screen-audit_automation")).toHaveClass("is-below");

    await user.click(screen.getByTestId("roadmap-screen-header-audit_automation"));
    expect(screen.getByTestId("roadmap-screen-network_automation")).toHaveClass("is-above");
    expect(screen.getByTestId("roadmap-screen-reporting")).toHaveClass("is-above");
    expect(screen.getByTestId("roadmap-screen-audit_automation")).toHaveClass("is-active");

    await user.click(screen.getByTestId("roadmap-screen-header-network_automation"));
    await user.click(screen.getByTestId("network_automation-full"));

    await waitFor(() => expect(window.location.search).toContain("network_automation=full"));
    expect(screen.getByTestId("network_automation-full")).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByTestId("network_automation-full")).getByText("Full Vision")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Closed-loop Operations" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "All roadmaps" }));
    expect(screen.getByRole("heading", { name: "Development Path" })).toBeVisible();
    expect(within(screen.getByTestId("choose-network_automation")).getByText("Network Automation")).toBeVisible();
    expect(within(screen.getByTestId("choose-network_automation")).queryByText("Full Vision")).not.toBeInTheDocument();
  });

  it("moves between paths and portfolio from the global navigation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Development Path" });
    expect(screen.getByRole("button", { name: "Metrics" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Portfolio" }));

    expect(screen.getByLabelText("Selected portfolio summary")).toBeVisible();
    expect(screen.getByRole("button", { name: "Portfolio" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "Paths" }));

    expect(screen.getByRole("heading", { name: "Development Path" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Paths" })).toHaveAttribute("aria-current", "page");
  });

  it("opens the metrics evidence page with a local empty state", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Development Path" });
    await user.click(screen.getByRole("button", { name: "Metrics" }));

    expect(screen.getByRole("heading", { name: "Activations Scrub Tool" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Metrics" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("No metrics available.")).toBeVisible();
    expect(window.location.hash).toBe("#metrics");
  });

  it("opens metrics directly from the metrics URL", async () => {
    window.history.replaceState(null, "", "/#metrics");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Activations Scrub Tool" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Metrics" })).toHaveAttribute("aria-current", "page");
    expect(window.location.hash).toBe("#metrics");
  });

  it("opens Reporting Suite directly from its metrics URL", async () => {
    window.history.replaceState(null, "", "/#metrics/reporting-suite");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Reporting Suite" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Switch to Activations Scrub Tool" })
    ).toBeVisible();
    expect(screen.getByText("No code metrics available.")).toBeVisible();
    expect(window.location.hash).toBe("#metrics/reporting-suite");
  });

  it("transitions the selected roadmap before opening its editor", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Development Path" });

    const reportingCard = screen.getByTestId("choose-reporting");
    await user.click(reportingCard);

    expect(reportingCard).toHaveClass("is-zoom-target");
    expect(reportingCard).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Reporting commitment editor" })).not.toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Reporting commitment editor" })).toBeVisible();
  });

  it("opens stage details and supports arrow-key tab navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Development Path" });

    await user.click(screen.getByTestId("choose-network_automation"));
    expect(screen.queryByRole("button", { name: "Full details" })).not.toBeInTheDocument();
    await user.click(screen.getByTestId("network_automation-foundation"));
    await user.click(screen.getByRole("button", { name: "Full details" }));
    const drawer = screen.getByRole("dialog", { name: "Inventory & Guardrails" });
    expect(drawer).toBeVisible();
    expect(within(drawer).getByText("Shared foundation")).toBeVisible();
    expect(drawer).not.toHaveTextContent(/\$/);
    await user.click(screen.getByRole("button", { name: "Close stage details" }));

    await user.click(screen.getByRole("button", { name: "Review portfolio" }));
    expect(screen.getByLabelText("Selected portfolio summary")).toBeVisible();
    expect(document.body).not.toHaveTextContent(/\$/);
    const comparisonTab = screen.getByRole("tab", { name: "Comparison" });
    comparisonTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Delivery" })).toHaveAttribute("aria-selected", "true");
  });

  it("resets the portfolio and returns to the chooser", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Development Path" });

    await user.click(screen.getByTestId("choose-network_automation"));
    await user.click(screen.getByTestId("network_automation-full"));
    await user.click(screen.getByRole("button", { name: "Review portfolio" }));
    await user.click(screen.getByRole("button", { name: "Reset scenario" }));

    expect(screen.getByRole("heading", { name: "Development Path" })).toBeVisible();
    expect(window.location.search).toContain("network_automation=none");
    expect(window.location.search).toContain("mode=parallel");
  });

  it("prints from portfolio review with the executive summary visible", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<App />);
    await screen.findByRole("heading", { name: "Development Path" });

    await user.click(screen.getByTestId("choose-network_automation"));
    await user.click(screen.getByRole("button", { name: "Review portfolio" }));
    expect(screen.getByLabelText("Selected portfolio summary")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });

  it("confirms the complete scenario state can be shared", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Development Path" });

    await user.click(screen.getByTestId("choose-network_automation"));
    await user.click(screen.getByRole("button", { name: "Review portfolio" }));
    await user.click(screen.getByTestId("share-scenario"));
    expect(await screen.findByText("Scenario link copied")).toBeVisible();
    expect(window.location.search).toContain("network_automation=none");
    expect(window.location.search).toContain("reporting=none");
    expect(window.location.search).toContain("audit_automation=none");
    expect(window.location.search).toContain("mode=parallel");
  });

  it("offers a selectable link when clipboard access is blocked", async () => {
    const user = userEvent.setup();
    clipboardWrite.mockRejectedValue(new Error("Clipboard access blocked"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      get: () => ({ writeText: clipboardWrite })
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Development Path" });

    await user.click(screen.getByTestId("choose-network_automation"));
    await user.click(screen.getByRole("button", { name: "Review portfolio" }));
    await user.click(screen.getByTestId("share-scenario"));
    const dialog = await screen.findByRole("dialog", { name: "Scenario link" }, { timeout: 1500 });
    const link = within(dialog).getByLabelText("Link") as HTMLInputElement;
    expect(link.value).toContain("network_automation=none");
    expect(link.value).toContain("mode=parallel");
  });
});
