import { describe, it, expect, vi, beforeEach } from "vitest";

describe("runtime-monitor", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    sessionStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("reports render errors through telemetry fetch fallback", async () => {
    const { reportRenderError } = await import("../runtime-monitor");

    reportRenderError(new Error("render failed"), "ComponentStack");
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/telemetry/client-error"),
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.type).toBe("react.error-boundary");
    expect(body.message).toContain("render failed");
    expect(body.stack).toContain("ComponentStack");
  });

  it("attempts chunk reload only once per session", async () => {
    const { initRuntimeMonitor } = await import("../runtime-monitor");
    sessionStorage.setItem("pos.chunk-reload-attempted.v1", "1");

    initRuntimeMonitor();

    expect(() =>
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "ChunkLoadError: Loading chunk 1 failed",
        }),
      ),
    ).not.toThrow();

    expect(sessionStorage.getItem("pos.chunk-reload-attempted.v1")).toBe("1");
  });
});
