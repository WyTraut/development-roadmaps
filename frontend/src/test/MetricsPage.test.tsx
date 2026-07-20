import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import MetricsPage from "../MetricsPage";
import type { MetricsEvidence } from "../types";


const evidence: MetricsEvidence = {
  sources: [
    {
      id: "l2l_scrubber",
      name: "L2L Scrubber",
      source_url: "https://github.com/WyattTrautman/L2L-Scrubber/issues/1",
      purpose: "Adoption and value evidence from real-world usage.",
      last_aggregated: "2026-07-20T15:21:28Z",
      total_scrubs: 163,
      warehouse_lookups: 49,
      minutes_saved_per_warehouse_query: 2,
      estimated_minutes_saved: 3356,
      tracked_clients: 8,
      daily_totals: [
        { date: "2026-07-17", scrubs: 5 },
        { date: "2026-07-20", scrubs: 10 }
      ],
      privacy_note: "Metrics are aggregate only and omit task IDs and operational details."
    }
  ]
};

function evidenceWithProjection(minutes: number, orders: number): MetricsEvidence {
  return {
    sources: [{ ...evidence.sources[0], estimated_minutes_saved: minutes, total_scrubs: orders }]
  };
}

describe("MetricsPage", () => {
  afterEach(cleanup);

  it("renders aggregate measures, projected savings, and source attribution", () => {
    render(<MetricsPage evidence={evidence} />);

    expect(screen.getByRole("heading", { name: "L2L Scrubber impact" })).toBeVisible();
    const summary = screen.getByLabelText("L2L Scrubber aggregate summary");
    expect(within(summary).getByText("163")).toBeVisible();
    expect(within(summary).getByText("49")).toBeVisible();
    expect(within(summary).getByText("Warehouse queries")).toBeVisible();
    expect(within(summary).getByText("56 hours")).toBeVisible();
    expect(within(summary).getByText("8")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Projected time saved" })).toBeVisible();
    expect(screen.getByText("275 hours")).toBeVisible();
    expect(screen.getByText("800 orders")).toBeVisible();
    const aggregation = screen.getByRole("img", {
      name: "Slider, Warehouse, UPS, and FortiGate aggregate into L2L Scrubber"
    });
    expect(aggregation).toBeVisible();
    expect(within(aggregation).getByText("Slider")).toBeVisible();
    expect(within(aggregation).getByText("Warehouse")).toBeVisible();
    expect(within(aggregation).getByText("UPS")).toBeVisible();
    expect(within(aggregation).getByText("FortiGate")).toBeVisible();
    expect(screen.queryByText("Four systems. One view.")).not.toBeInTheDocument();
    expect(
      within(aggregation).queryByText(/Scheduling|Orders|Tracking|PDFs \+ configs|Unified order view/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Projected time saved at 800 orders: 275 hours" })
    ).toBeVisible();
    expect(screen.queryByText("Capacity returned")).not.toBeInTheDocument();
    expect(screen.queryByText("2 min saved each")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Daily scrubs" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View source metrics for L2L Scrubber" })).toHaveAttribute(
      "href",
      evidence.sources[0].source_url
    );
    expect(screen.queryByText("Aggregate data only")).not.toBeInTheDocument();
  });

  it("projects the observed average across 800 orders", () => {
    render(<MetricsPage evidence={evidenceWithProjection(6000, 100)} />);

    expect(
      screen.getByRole("img", { name: "Projected time saved at 800 orders: 800 hours" })
    ).toBeVisible();
  });

  it("renders a zero projection when there are no observed orders", () => {
    render(<MetricsPage evidence={evidenceWithProjection(0, 0)} />);

    expect(
      screen.getByRole("img", { name: "Projected time saved at 800 orders: 0 hours" })
    ).toBeVisible();
  });
});
