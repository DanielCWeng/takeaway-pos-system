import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalServiceError, NotFoundError } from "../../src/shared/errors.js";

vi.mock("../../src/config/index.js", () => ({
  config: { address: { apiKey: "test-key" } },
}));
vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: { warn: vi.fn() },
}));

import { config } from "../../src/config/index.js";
import { findByPostcode } from "../../src/domains/addresses/getAddress.client.js";

describe("getAddress client", () => {
  beforeEach(() => {
    config.address.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("normalizes provider-specific expanded fields at the boundary", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        latitude: 52.91,
        longitude: -1.25,
        addresses: [{ line_1: " 10 Copeland Avenue ", line_2: " ", town_or_city: " Nottingham " }],
      }),
    });

    await expect(findByPostcode("NG9 8DQ")).resolves.toEqual({
      addresses: [{ line1: "10 Copeland Avenue", line2: "", town: "Nottingham" }],
      latitude: 52.91,
      longitude: -1.25,
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url.href).toBe("https://api.getaddress.io/find/NG98DQ?expand=true");
    expect(options.headers).toEqual({ "api-key": "test-key" });
  });

  it("maps a provider 404 to NotFoundError", async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(findByPostcode("NG9 8DQ")).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([429, 500, 503])("maps HTTP %s to ExternalServiceError", async (status) => {
    fetch.mockResolvedValue({ ok: false, status });
    await expect(findByPostcode("NG9 8DQ")).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("rejects malformed responses and invalid coordinates", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        latitude: 91,
        longitude: -1.25,
        addresses: [{ line_1: "Invalid", line_2: "", town_or_city: "Nottingham" }],
      }),
    });
    await expect(findByPostcode("NG9 8DQ")).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("rejects malformed JSON", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
    });
    await expect(findByPostcode("NG9 8DQ")).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("rejects a malformed response shape", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ latitude: 52.91, longitude: -1.25, addresses: {} }),
    });
    await expect(findByPostcode("NG9 8DQ")).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("aborts and maps a provider timeout to ExternalServiceError", async () => {
    vi.useFakeTimers();
    fetch.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );

    try {
      const lookup = findByPostcode("NG9 8DQ");
      const rejection = expect(lookup).rejects.toBeInstanceOf(ExternalServiceError);
      await vi.advanceTimersByTimeAsync(5000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects network errors and missing configuration", async () => {
    fetch.mockRejectedValue(new Error("offline"));
    await expect(findByPostcode("NG9 8DQ")).rejects.toBeInstanceOf(ExternalServiceError);
    config.address.apiKey = "";
    await expect(findByPostcode("NG9 8DQ")).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
