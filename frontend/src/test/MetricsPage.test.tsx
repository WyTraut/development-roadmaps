import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import MetricsPage from "../MetricsPage";
import type { MetricsEvidence } from "../types";


const evidence: MetricsEvidence = {
  sources: [
    {
      id: "l2l_scrubber",
      name: "Activations Scrub Tool",
      source_url: "https://github.com/WyattTrautman/L2L-Scrubber/issues/1",
      purpose: "Adoption and value evidence from real-world usage.",
      last_aggregated: "2026-07-20T15:21:28Z",
      total_scrubs: 175,
      warehouse_lookups: 53,
      minutes_saved_per_warehouse_query: 2,
      estimated_minutes_saved: 3610,
      tracked_clients: 8,
      daily_totals: [
        { date: "2026-07-17", scrubs: 5 },
        { date: "2026-07-20", scrubs: 10 }
      ],
      privacy_note: "Metrics are aggregate only and omit task IDs and operational details."
    }
  ],
  reporting_suite: {
    id: "reporting_suite",
    name: "Reporting Suite",
    source_url: "https://github.com/WyTraut/development-roadmaps/issues/29",
    source_ref: "fixture123",
    purpose: "Code-derived evidence of the reporting platform.",
    registered_views: 52,
    active_views: 47,
    api_capabilities: 156,
    data_tables: 38,
    automation_steps: 26,
    scheduled_workflows: 6,
    workspaces: [
      { name: "Operations", active_views: 13 },
      { name: "FIT", active_views: 10 },
      { name: "Hub", active_views: 7 },
      { name: "Offnet", active_views: 6 },
      { name: "Tools", active_views: 6 },
      { name: "Admin", active_views: 3 },
      { name: "Manager Views", active_views: 2 }
    ],
    source_note: "Derived from source code.",
    report_views: 175,
    total_views: 12450,
    data_points: 987654,
    unique_viewers: 84,
    source_systems: [
      "Slider",
      "FlightDeck",
      "Amdocs",
      "SharePoint",
      "SWIFT",
      "UPS",
      "ConcertTech",
      "NSchedule"
    ],
    tracking_started: "2025-05-01T12:00:00Z",
    last_aggregated: "2026-07-23T17:30:00Z",
    monthly_views: [
      { month: "2026-05", views: 1020 },
      { month: "2026-06", views: 1330 },
      { month: "2026-07", views: 1490 }
    ],
    privacy_note: "Aggregate metrics only."
  }
};

function evidenceWithProjection(minutes: number, orders: number): MetricsEvidence {
  return {
    sources: [{ ...evidence.sources[0], estimated_minutes_saved: minutes, total_scrubs: orders }]
  };
}

function evidenceWithReportViews(reportViews: number): MetricsEvidence {
  return {
    sources: evidence.sources,
    reporting_suite: {
      ...evidence.reporting_suite!,
      report_views: reportViews,
      active_views: reportViews
    }
  };
}

describe("MetricsPage", () => {
  afterEach(cleanup);

  it("renders aggregate measures, projected savings, and source attribution", () => {
    render(<MetricsPage evidence={evidence} />);

    expect(screen.getByRole("heading", { name: "Activations Scrub Tool" })).toBeVisible();
    expect(screen.queryByText("Usage to date")).not.toBeInTheDocument();
    expect(screen.queryByText("L2L Scrubber", { exact: true })).not.toBeInTheDocument();
    const summary = screen.getByLabelText("Activations Scrub Tool aggregate summary");
    expect(within(summary).getByText("175")).toBeVisible();
    expect(within(summary).getByText("53")).toBeVisible();
    expect(within(summary).getByText("Warehouse queries")).toBeVisible();
    expect(within(summary).getByText("60 hours")).toBeVisible();
    expect(within(summary).getByText("8")).toBeVisible();
    expect(within(summary).getByText("Checks per scrub")).toBeVisible();
    expect(within(summary).getByText("28")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Projected time saved" })).toBeVisible();
    expect(screen.getByText("275 hours")).toBeVisible();
    expect(screen.getByText("in 4.6 months")).toBeVisible();
    expect(screen.getByText("Current L2L automation")).toBeVisible();
    expect(
      screen.queryByText(
        "Projected savings if these products are implemented in the Activations Scrub Tool"
      )
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 month")).toBeVisible();
    expect(screen.getByText("3 months")).toBeVisible();
    expect(screen.getByText("4.6 months")).toBeVisible();
    expect(screen.getByText("Hover products left to right")).toBeVisible();
    const productScenarios = screen.getByRole("group", { name: "Product automation scenarios" });
    expect(within(productScenarios).getByRole("button", { name: "Include through L2L" })).toBeVisible();
    expect(
      within(productScenarios).getByRole("button", { name: "Include through Zero Touches" })
    ).toBeVisible();
    expect(
      within(productScenarios).getByRole("button", { name: "Include through SD-WAN new installs" })
    ).toBeVisible();
    expect(
      within(productScenarios).getByRole("button", { name: "Include through FortiGate installs" })
    ).toBeVisible();
    expect(
      within(productScenarios).getByRole("button", { name: "Include through Plug and Play VPN installs" })
    ).toBeVisible();
    expect(within(productScenarios).queryByText(/^\+/)).not.toBeInTheDocument();
    expect(screen.queryByText("800 orders")).not.toBeInTheDocument();
    const aggregation = screen.getByRole("group", {
      name: "Slider, Warehouse, UPS, FortiGate, SharePoint, Power Apps, OneDrive, and FlightDeck aggregate into Activations Scrub Tool"
    });
    expect(aggregation).toBeVisible();
    expect(within(aggregation).getByText("Slider")).toBeVisible();
    expect(within(aggregation).getByText("Warehouse")).toBeVisible();
    expect(within(aggregation).getByText("UPS")).toBeVisible();
    expect(within(aggregation).getByText("FortiGate")).toBeVisible();
    expect(within(aggregation).getByText("SharePoint")).toBeVisible();
    expect(within(aggregation).getByText("Power Apps")).toBeVisible();
    expect(within(aggregation).getByText("OneDrive")).toBeVisible();
    expect(within(aggregation).getByText("FlightDeck")).toBeVisible();
    expect(screen.getByText("Sources aggregated through automation")).toBeVisible();
    expect(screen.queryByText("Four systems. One view.")).not.toBeInTheDocument();
    expect(
      within(aggregation).queryByText(/Scheduling|Orders|Tracking|PDFs \+ configs|Unified order view/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Projected time saved: 275 hours in 4.6 months with L2L automation"
      })
    ).toBeVisible();
    expect(screen.queryByText("Capacity returned")).not.toBeInTheDocument();
    expect(screen.queryByText("2 min saved each")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Daily scrubs" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View source metrics for Activations Scrub Tool" })).toHaveAttribute(
      "href",
      evidence.sources[0].source_url
    );
    expect(screen.queryByText("Aggregate data only")).not.toBeInTheDocument();
  });

  it("switches to Reporting Suite and renders reach and usage metrics", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} />);

    await user.click(screen.getByRole("button", { name: "Switch to Reporting Suite" }));

    expect(
      screen.getByRole("button", { name: "Switch to Activations Scrub Tool" })
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Reporting Suite" })).toBeVisible();
    const summary = screen.getByLabelText("Reporting Suite reach and usage summary");
    expect(within(summary).getByText("Report pages")).toBeVisible();
    expect(within(summary).getByText("175")).toBeVisible();
    expect(within(summary).getByText("Total views")).toBeVisible();
    expect(within(summary).getByText("12,450")).toBeVisible();
    expect(within(summary).getByText("Data points")).toBeVisible();
    expect(within(summary).getByText("987,654")).toBeVisible();
    expect(within(summary).getByText("Unique viewers")).toBeVisible();
    expect(within(summary).getByText("84")).toBeVisible();
    expect(within(summary).getByText("Source systems")).toBeVisible();
    expect(within(summary).getByText("8")).toBeVisible();
    const universe = screen.getByRole("region", { name: "Report Universe" });
    expect(within(universe).getByText("175 report pages")).toBeVisible();
    expect(within(universe).getAllByTestId("report-universe-cluster")).toHaveLength(7);
    expect(within(universe).getAllByTestId("report-universe-tile")).toHaveLength(175);
    for (const cluster of within(universe).getAllByTestId("report-universe-cluster")) {
      expect(within(cluster).getAllByTestId("report-universe-tile")).toHaveLength(25);
    }
    expect(screen.getByRole("heading", { name: "Cumulative Views" })).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Cumulative Reporting Suite views. 2026-05: 9,630 total views, 2026-06: 10,960 total views, 2026-07: 12,450 total views"
      })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View source metrics for Reporting Suite" })
    ).toHaveAttribute("href", evidence.reporting_suite?.source_url);
    expect(screen.getByText("Aggregate metrics only.")).toBeVisible();
    expect(screen.getByLabelText("Activations Scrub Tool aggregate summary")).not.toBeVisible();
  });

  it("distributes anonymous report tiles without exposing internal details", () => {
    const { rerender } = render(
      <MetricsPage evidence={evidenceWithReportViews(10)} activeView="reporting-suite" />
    );

    let universe = screen.getByRole("region", { name: "Report Universe" });
    let clusters = within(universe).getAllByTestId("report-universe-cluster");
    expect(clusters).toHaveLength(7);
    expect(
      clusters.map(
        (cluster) => within(cluster).getAllByTestId("report-universe-tile").length
      )
    ).toEqual([2, 2, 2, 1, 1, 1, 1]);

    for (const internalLabel of [
      "Operations",
      "FIT",
      "Hub",
      "Offnet",
      "Tools",
      "Admin",
      "Manager Views",
      "Slider",
      "FlightDeck"
    ]) {
      expect(within(universe).queryByText(internalLabel)).not.toBeInTheDocument();
    }

    rerender(
      <MetricsPage evidence={evidenceWithReportViews(3)} activeView="reporting-suite" />
    );
    universe = screen.getByRole("region", { name: "Report Universe" });
    clusters = within(universe).getAllByTestId("report-universe-cluster");
    expect(clusters).toHaveLength(3);
    expect(within(universe).getAllByTestId("report-universe-tile")).toHaveLength(3);

    rerender(
      <MetricsPage evidence={evidenceWithReportViews(0)} activeView="reporting-suite" />
    );
    expect(screen.queryByRole("region", { name: "Report Universe" })).not.toBeInTheDocument();
  });

  it("highlights one anonymous report cluster on hover or focus", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} activeView="reporting-suite" />);

    const universe = screen.getByRole("region", { name: "Report Universe" });
    const clusters = within(universe).getAllByTestId("report-universe-cluster");

    await user.hover(clusters[2]);
    expect(clusters[2]).toHaveClass("is-active");
    expect(clusters[0]).toHaveClass("is-muted");
    expect(clusters[1]).toHaveClass("is-muted");

    await user.unhover(clusters[2]);
    expect(clusters[2]).not.toHaveClass("is-active");
    expect(clusters[0]).not.toHaveClass("is-muted");

    fireEvent.focus(clusters[4]);
    expect(clusters[4]).toHaveClass("is-active");
    expect(clusters[3]).toHaveClass("is-muted");

    fireEvent.blur(clusters[4]);
    expect(clusters[4]).not.toHaveClass("is-active");
    expect(clusters[3]).not.toHaveClass("is-muted");
  });

  it("explains the Reporting Suite counts in concise tooltips", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} activeView="reporting-suite" />);

    await user.hover(screen.getByRole("button", { name: "About Report pages" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "active route, named tab, scorecard, one-pager, embedded manager view, and Macias subview"
    );
    await user.unhover(screen.getByRole("button", { name: "About Report pages" }));

    await user.hover(screen.getByRole("button", { name: "About Data points" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Zeroes count");
    await user.unhover(screen.getByRole("button", { name: "About Data points" }));

    await user.hover(screen.getByRole("button", { name: "About Unique viewers" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Only the aggregate count");
    await user.unhover(screen.getByRole("button", { name: "About Unique viewers" }));

    await user.hover(screen.getByRole("button", { name: "About Source systems" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Slider, FlightDeck, Amdocs, SharePoint, SWIFT, UPS, ConcertTech, NSchedule"
    );
  });

  it("shows the workstation-sync state while retaining code-owned metrics", () => {
    const reportingSuite = {
      ...evidence.reporting_suite!,
      total_views: null,
      data_points: null,
      unique_viewers: null,
      tracking_started: null,
      last_aggregated: null,
      monthly_views: []
    };
    render(
      <MetricsPage
        evidence={{ sources: evidence.sources, reporting_suite: reportingSuite }}
        activeView="reporting-suite"
      />
    );

    const summary = screen.getByLabelText("Reporting Suite reach and usage summary");
    expect(within(summary).getByText("175")).toBeVisible();
    expect(within(summary).getByText("8")).toBeVisible();
    expect(within(summary).getAllByText("--")).toHaveLength(3);
    expect(screen.getAllByText("Awaiting workstation sync")).toHaveLength(2);
  });

  it("shows a Reporting Suite empty state when no code snapshot is available", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={{ sources: evidence.sources }} />);

    await user.click(screen.getByRole("button", { name: "Switch to Reporting Suite" }));

    expect(screen.getByRole("heading", { name: "Reporting Suite" })).toBeVisible();
    expect(screen.getByText("No code metrics available.")).toBeVisible();
  });

  it("explains the Activations Scrub Tool workflow and restores focus after every close path", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} />);

    const trigger = screen.getByRole("button", { name: "Activation Scrub Tool Usage" });
    expect(trigger).toHaveAttribute("title", "Activation Scrub Tool Usage");
    expect(trigger).toHaveClass("metrics-aggregation-target");
    expect(within(trigger).getByText("Activations Scrub Tool")).toBeVisible();

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Activation Scrub Tool Usage" });
    const closeButton = within(dialog).getByRole("button", { name: "Close explanation" });

    expect(closeButton).toHaveFocus();
    expect(dialog).toHaveTextContent(
      "The Activations Scrub Tool starts with a task ID from Slider or FlightDeck. It uses that ID to open the matching invite and reads the order number, location, and scheduled date."
    );
    expect(dialog).toHaveTextContent(
      "It uses those details to find the matching sales intake PDF and supporting files in SharePoint and OneDrive. It checks the related Warehouse and Power Apps records, adds UPS delivery status when available, and finds the matching FortiGate files."
    );
    expect(dialog).toHaveTextContent(
      "For each scrub, the app runs 28 checks covering IP schemas, routing logic, BGP configuration, shipping, equipment, scheduling, and order details across those sources. Matching information is brought together in one review package for a person to confirm."
    );
    for (const system of [
      "Slider",
      "FlightDeck",
      "SharePoint",
      "OneDrive",
      "Warehouse",
      "Power Apps",
      "UPS",
      "FortiGate"
    ]) {
      expect(dialog).toHaveTextContent(system);
    }
    expect(dialog).not.toHaveTextContent(/\b(?:API|REST|CDP)\b/);
    expect(dialog).not.toHaveTextContent(/\b[A-Z]{2,}-\d+\b/);

    await user.click(closeButton);
    expect(screen.queryByRole("dialog", { name: "Activation Scrub Tool Usage" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByTestId("metrics-explanation-backdrop"));
    expect(screen.queryByRole("dialog", { name: "Activation Scrub Tool Usage" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Activation Scrub Tool Usage" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("explains KPI definitions on hover and keyboard focus", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} />);

    const scrubsInfo = screen.getByRole("button", { name: "About Scrubs" });
    await user.hover(scrubsInfo);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "A process where network technicians gather information and verify logistical and network standards. Scrubs are crucial to preventing HEOs and failures while significantly reducing activation times."
    );
    await user.unhover(scrubsInfo);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    const warehouseInfo = screen.getByRole("button", { name: "About Warehouse queries" });
    await user.click(warehouseInfo);
    expect(warehouseInfo).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "The number of times the tool checks Warehouse order records to confirm equipment, location, and activation details."
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    const checksInfo = screen.getByRole("button", { name: "About Checks per scrub" });
    await user.click(checksInfo);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Each automated scrub runs 28 checks across IP schemas, routing logic, BGP configuration, shipping, equipment, scheduling, and order details."
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("adds product savings from left to right on hover and pins a scenario on click", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} />);

    const zeroTouches = screen.getByRole("button", { name: "Include through Zero Touches" });
    await user.hover(zeroTouches);
    expect(
      screen.getByRole("img", {
        name: "Projected time saved with L2L and Zero Touches automation: 775 hours. Product contributions: L2L 275 hours and Zero Touches adds 500 hours"
      })
    ).toBeVisible();
    expect(screen.queryByText("in 4.6 months")).not.toBeInTheDocument();
    expect(screen.queryByText("Current L2L automation")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Projected savings if these products are implemented in the Activations Scrub Tool"
      )
    ).toBeVisible();
    expect(screen.queryByText("1 month")).not.toBeInTheDocument();
    expect(screen.queryByText("3 months")).not.toBeInTheDocument();
    expect(screen.queryByText("4.6 months")).not.toBeInTheDocument();
    expect(screen.getByText("275h")).toBeVisible();
    expect(screen.getByText("+500h")).toBeVisible();
    expect(within(screen.getByRole("group", { name: "Product automation scenarios" })).queryByText(/^\+/)).not.toBeInTheDocument();

    const sdwan = screen.getByRole("button", { name: "Include through SD-WAN new installs" });
    await user.unhover(zeroTouches);
    await user.hover(sdwan);
    expect(screen.getByText("1,775 hours")).toBeVisible();
    expect(screen.getByText("+1,000h")).toBeVisible();

    const fortigate = screen.getByRole("button", { name: "Include through FortiGate installs" });
    await user.unhover(sdwan);
    await user.hover(fortigate);
    expect(screen.getByText("2,775 hours")).toBeVisible();

    const plugAndPlay = screen.getByRole("button", {
      name: "Include through Plug and Play VPN installs"
    });
    await user.unhover(fortigate);
    await user.hover(plugAndPlay);
    expect(screen.getByText("4,775 hours")).toBeVisible();
    expect(screen.getAllByText("+1,000h")).toHaveLength(2);
    expect(screen.getByText("+2,000h")).toBeVisible();

    await user.click(plugAndPlay);
    await user.unhover(plugAndPlay);
    expect(plugAndPlay).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("4,775 hours")).toBeVisible();
    expect(screen.queryByText("1 month")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Include through L2L" }));
    expect(screen.getByText("275 hours")).toBeVisible();
    expect(screen.getByText("in 4.6 months")).toBeVisible();
    expect(screen.getByText("Current L2L automation")).toBeVisible();
    expect(screen.getByText("1 month")).toBeVisible();
    expect(screen.getByText("3 months")).toBeVisible();
    expect(screen.getByText("4.6 months")).toBeVisible();
    expect(screen.queryByText("+500h")).not.toBeInTheDocument();
  });

  it("updates the product-expansion total from the observed L2L projection", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidenceWithProjection(6000, 100)} />);

    expect(
      screen.getByRole("img", {
        name: "Projected time saved: 800 hours in 8 months with L2L automation"
      })
    ).toBeVisible();

    await user.hover(
      screen.getByRole("button", { name: "Include through Plug and Play VPN installs" })
    );
    expect(
      screen.getByRole("img", {
        name: "Projected time saved with L2L, Zero Touches, SD-WAN new installs, FortiGate installs, and Plug and Play VPN installs automation: 5,300 hours. Product contributions: L2L 800 hours, Zero Touches adds 500 hours, SD-WAN new installs adds 1,000 hours, FortiGate installs adds 1,000 hours, and Plug and Play VPN installs adds 2,000 hours"
      })
    ).toBeVisible();
  });

  it("renders a zero projection when there are no observed orders", () => {
    render(<MetricsPage evidence={evidenceWithProjection(0, 0)} />);

    expect(
      screen.getByRole("img", {
        name: "Projected time saved: 0 hours in 0 months with L2L automation"
      })
    ).toBeVisible();
  });
});
