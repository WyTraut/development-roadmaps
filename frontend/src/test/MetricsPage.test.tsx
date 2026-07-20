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
      estimated_minutes_saved: 3258,
      tracked_clients: 8,
      daily_totals: [
        { date: "2026-07-17", scrubs: 5 },
        { date: "2026-07-20", scrubs: 10 }
      ],
      privacy_note: "Metrics are aggregate only and omit task IDs and operational details."
    }
  ]
};

describe("MetricsPage", () => {
  afterEach(cleanup);

  it("renders aggregate measures, the daily trend, and source attribution", () => {
    render(<MetricsPage evidence={evidence} />);

    expect(screen.getByRole("heading", { name: "L2L Scrubber" })).toBeVisible();
    const summary = screen.getByLabelText("L2L Scrubber aggregate summary");
    expect(within(summary).getByText("163")).toBeVisible();
    expect(within(summary).getByText("49")).toBeVisible();
    expect(within(summary).getByText("54.3 hours")).toBeVisible();
    expect(within(summary).getByText("8")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Daily scrub activity for L2L Scrubber" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "View source issue" })).toHaveAttribute(
      "href",
      evidence.sources[0].source_url
    );
    expect(screen.getByText(/Metrics are aggregate only/)).toBeVisible();
  });
});
