import { describe, expect, it } from "vitest";

import { readUrlState, scenarioSearch, scenarioUrl } from "../urlState";
import type { PortfolioConfig } from "../types";

const config = {
  defaults: {
    selections: {
      network_automation: "foundation",
      reporting: "foundation",
      audit_automation: "foundation"
    },
    execution_mode: "parallel"
  },
  roadmaps: [
    { id: "network_automation" },
    { id: "reporting" },
    { id: "audit_automation" }
  ]
} as unknown as PortfolioConfig;

describe("URL scenario state", () => {
  it("reads valid selections and falls back for invalid values", () => {
    const state = readUrlState(
      config,
      "?network_automation=full&reporting=not-a-stage&audit_automation=none&mode=sequential"
    );

    expect(state.selections).toEqual({
      network_automation: "full",
      reporting: "foundation",
      audit_automation: "none"
    });
    expect(state.executionMode).toBe("sequential");
  });

  it("serializes every roadmap and delivery mode", () => {
    const search = scenarioSearch(
      ["network_automation", "reporting", "audit_automation"],
      { network_automation: "scale", reporting: "full", audit_automation: "none" },
      "parallel"
    );
    expect(search).toContain("network_automation=scale");
    expect(search).toContain("reporting=full");
    expect(search).toContain("audit_automation=none");
    expect(search).toContain("mode=parallel");
  });

  it("keeps the current origin and path when building a share link", () => {
    const url = scenarioUrl(
      "http://example.local:8080/portfolio?old=value",
      ["network_automation", "reporting", "audit_automation"],
      { network_automation: "foundation", reporting: "scale", audit_automation: "full" },
      "sequential"
    );
    expect(url).toMatch(/^http:\/\/example\.local:8080\/portfolio\?/);
    expect(url).toContain("audit_automation=full");
    expect(url).not.toContain("old=value");
  });
});
