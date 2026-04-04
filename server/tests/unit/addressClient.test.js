import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findAddressesFromApi } from "../../src/domains/callerIdService/addressClient.js";
import { config } from "../../src/config/index.js";

describe("Address API Client (getaddress.io)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    config.address.apiKey = "test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null if API key is missing", async () => {
    config.address.apiKey = "";
    const result = await findAddressesFromApi("KEYMISSING");
    expect(result).toBeNull();
  });

  it("returns address list on successful API call", async () => {
    const postcode = "SUCCESS";
    const mockResponse = {
      latitude: 52.9,
      longitude: -1.2,
      addresses: [{ line_1: "10 High St", line_2: "Chilwell", town_or_city: "Nottingham" }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await findAddressesFromApi(postcode);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      line1: "10 High St",
      line2: "Chilwell",
      town: "Nottingham",
      latitude: 52.9,
      longitude: -1.2,
    });
  });

  it("returns null on 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await findAddressesFromApi("NOTFOUND");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));
    const result = await findAddressesFromApi("NETWORKFAIL");
    expect(result).toBeNull();
  });

  it("returns null on 429 rate limit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const result = await findAddressesFromApi("RATELIMIT");
    expect(result).toBeNull();
  });

  it("returns null when request aborts on timeout", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const pending = findAddressesFromApi("TIMEOUT01");
    await vi.advanceTimersByTimeAsync(5000);

    await expect(pending).resolves.toBeNull();
  });

  it("returns null on unexpected API payload shape", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latitude: 52.9,
        longitude: -1.2,
        addresses: "not-an-array",
      }),
    });

    const result = await findAddressesFromApi("SHAPE01");
    expect(result).toBeNull();
  });

  it("returns null on invalid coordinate payload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latitude: "bad",
        longitude: -1.2,
        addresses: [{ line_1: "1 Test Rd", line_2: "", town_or_city: "Derby" }],
      }),
    });

    const result = await findAddressesFromApi("BADCOORD");
    expect(result).toBeNull();
  });

  it("normalises postcode before caching - different cases/spaces share one cache entry", async () => {
    const mockResponse = {
      latitude: 53.0,
      longitude: -1.5,
      addresses: [{ line_1: "1 Test Rd", line_2: "", town_or_city: "Derby" }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const r1 = await findAddressesFromApi("de1 1aa");
    const r2 = await findAddressesFromApi("DE11AA");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it("caches empty API results and reuses them", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latitude: 53.0,
        longitude: -1.5,
        addresses: [],
      }),
    });

    const r1 = await findAddressesFromApi("DE2 2BB");
    const r2 = await findAddressesFromApi("de22bb");

    expect(r1).toEqual([]);
    expect(r2).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
