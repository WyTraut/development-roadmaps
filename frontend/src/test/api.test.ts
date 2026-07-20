import { afterEach, describe, expect, it, vi } from "vitest";


function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

describe("static metrics loader", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns an empty source list for an older static bundle", async () => {
    vi.stubEnv("VITE_STATIC_SITE", "true");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      portfolio: {},
      scenarios: {}
    })));
    const { fetchMetrics } = await import("../api");

    await expect(fetchMetrics()).resolves.toEqual({ sources: [] });
  });
});
