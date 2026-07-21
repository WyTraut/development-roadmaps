import { cleanup, render, screen, within } from "@testing-library/react";
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

    expect(screen.getByRole("heading", { name: "Activations Scrub Tool" })).toBeVisible();
    expect(screen.queryByText("Usage to date")).not.toBeInTheDocument();
    expect(screen.queryByText("L2L Scrubber", { exact: true })).not.toBeInTheDocument();
    const summary = screen.getByLabelText("Activations Scrub Tool aggregate summary");
    expect(within(summary).getByText("163")).toBeVisible();
    expect(within(summary).getByText("49")).toBeVisible();
    expect(within(summary).getByText("Warehouse queries")).toBeVisible();
    expect(within(summary).getByText("56 hours")).toBeVisible();
    expect(within(summary).getByText("8")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Projected time saved" })).toBeVisible();
    expect(screen.getByText("275 hours")).toBeVisible();
    expect(screen.getByText("800 orders")).toBeVisible();
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
    expect(screen.getByRole("link", { name: "View source metrics for Activations Scrub Tool" })).toHaveAttribute(
      "href",
      evidence.sources[0].source_url
    );
    expect(screen.queryByText("Aggregate data only")).not.toBeInTheDocument();
  });

  it("explains the Activations Scrub Tool workflow and restores focus after every close path", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} />);

    const trigger = screen.getByRole("button", { name: "How Activations Scrub Tool works" });
    expect(trigger).toHaveAttribute("title", "How Activations Scrub Tool works");
    expect(trigger).toHaveClass("metrics-aggregation-target");
    expect(within(trigger).getByText("Activations Scrub Tool")).toBeVisible();

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "How Activations Scrub Tool works" });
    const closeButton = within(dialog).getByRole("button", { name: "Close explanation" });

    expect(closeButton).toHaveFocus();
    expect(dialog).toHaveTextContent(
      "Activations Scrub Tool starts with a task ID from Slider or FlightDeck. It uses that ID to open the matching invite and reads the order number, location, and scheduled date."
    );
    expect(dialog).toHaveTextContent(
      "It uses those details to find the matching sales intake PDF and supporting files in SharePoint and OneDrive. It checks the related Warehouse and Power Apps record, adds UPS delivery status when available, and finds the matching FortiGate files."
    );
    expect(dialog).toHaveTextContent(
      "The app compares the order ID, location, schedule, equipment, shipping, and device details across those sources. Matching information is brought together in one review package for a person to confirm."
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
    expect(screen.queryByRole("dialog", { name: "How Activations Scrub Tool works" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByTestId("metrics-explanation-backdrop"));
    expect(screen.queryByRole("dialog", { name: "How Activations Scrub Tool works" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "How Activations Scrub Tool works" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("explains scrubs and Warehouse queries on hover and keyboard focus", async () => {
    const user = userEvent.setup();
    render(<MetricsPage evidence={evidence} />);

    const scrubsInfo = screen.getByRole("button", { name: "About Scrubs" });
    await user.hover(scrubsInfo);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "A process where network technicians gather information and verify logistical and network standards. It is crucial to preventing HEOs and failures while significantly reducing activation times."
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
