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

function evidenceWithMinutes(minutes: number): MetricsEvidence {
  return {
    sources: [{ ...evidence.sources[0], estimated_minutes_saved: minutes }]
  };
}

describe("MetricsPage", () => {
  afterEach(cleanup);

  it("renders aggregate measures, returned capacity, and source attribution", () => {
    render(<MetricsPage evidence={evidence} />);

    expect(screen.getByRole("heading", { name: "L2L Scrubber impact" })).toBeVisible();
    const summary = screen.getByLabelText("L2L Scrubber aggregate summary");
    expect(within(summary).getByText("163")).toBeVisible();
    expect(within(summary).getByText("49")).toBeVisible();
    expect(within(summary).getByText("Warehouse queries")).toBeVisible();
    expect(within(summary).getByText("56 hours")).toBeVisible();
    expect(within(summary).getByText("8")).toBeVisible();
    expect(screen.getByText("1 workweek")).toBeVisible();
    expect(screen.getByText("2 days")).toBeVisible();
    expect(screen.getByText("8-hour days")).toBeVisible();
    expect(screen.queryByText("2 min saved each")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Daily scrubs" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View source metrics for L2L Scrubber" })).toHaveAttribute(
      "href",
      evidence.sources[0].source_url
    );
    expect(screen.queryByText("Aggregate data only")).not.toBeInTheDocument();
  });

  it("renders an exact workweek without a day remainder", () => {
    render(<MetricsPage evidence={evidenceWithMinutes(2400)} />);

    expect(
      screen.getByRole("img", { name: "Equivalent capacity returned: 1 workweek" })
    ).toBeVisible();
    expect(screen.queryByText("0 days")).not.toBeInTheDocument();
  });

  it("renders fractional days below one workweek", () => {
    render(<MetricsPage evidence={evidenceWithMinutes(720)} />);

    expect(
      screen.getByRole("img", { name: "Equivalent capacity returned: 1.5 days" })
    ).toBeVisible();
    expect(screen.queryByText(/workweeks?$/)).not.toBeInTheDocument();
  });

  it("renders zero returned capacity as zero days", () => {
    render(<MetricsPage evidence={evidenceWithMinutes(0)} />);

    expect(
      screen.getByRole("img", { name: "Equivalent capacity returned: 0 days" })
    ).toBeVisible();
  });
});
