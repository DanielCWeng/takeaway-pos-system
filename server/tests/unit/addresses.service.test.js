import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../src/shared/errors.js";

vi.mock("../../src/config/index.js", () => ({
  config: { address: { storeLatitude: 52.9, storeLongitude: -1.2 } },
}));
vi.mock("../../src/domains/addresses/addresses.repo.js", () => ({
  findCached: vi.fn(),
  saveCached: vi.fn(),
}));
vi.mock("../../src/domains/addresses/getAddress.client.js", () => ({
  findByPostcode: vi.fn(),
}));
vi.mock("../../src/shared/haversine.js", () => ({ haversineInMiles: vi.fn(() => 1.234) }));

import * as service from "../../src/domains/addresses/addresses.service.js";
import * as repo from "../../src/domains/addresses/addresses.repo.js";
import * as provider from "../../src/domains/addresses/getAddress.client.js";

const providerResult = {
  addresses: [{ line1: "10 Copeland Avenue", line2: "", town: "Nottingham" }],
  latitude: 52.91,
  longitude: -1.25,
};

describe("addresses.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findCached.mockReturnValue(null);
  });

  it("normalises case and spacing before cache access", async () => {
    repo.findCached.mockReturnValue({ postcode: "NG9 8DQ", ...providerResult });

    const result = await service.lookupPostcode(" ng98dq ");

    expect(repo.findCached).toHaveBeenCalledWith("NG9 8DQ");
    expect(provider.findByPostcode).not.toHaveBeenCalled();
    expect(result.addresses[0]).toMatchObject({
      line1: "10 Copeland Avenue",
      postcode: "NG9 8DQ",
      distance: 1.23,
    });
  });

  it("rejects malformed postcodes before cache or provider access", async () => {
    await expect(service.lookupPostcode("not a postcode")).rejects.toThrow(ValidationError);
    expect(repo.findCached).not.toHaveBeenCalled();
    expect(provider.findByPostcode).not.toHaveBeenCalled();
  });

  it("accepts the GIR special case and rejects impossible postcode areas", () => {
    expect(service.validatePostcode("gir0aa")).toBe("GIR 0AA");
    expect(() => service.validatePostcode("ZZ1 1ZZ")).toThrow(ValidationError);
  });

  it("queries getAddress once on a miss and persists the normalized result", async () => {
    provider.findByPostcode.mockResolvedValue(providerResult);

    const result = await service.lookupPostcode("NG9 8DQ");

    expect(provider.findByPostcode).toHaveBeenCalledOnce();
    expect(provider.findByPostcode).toHaveBeenCalledWith("NG9 8DQ");
    expect(repo.saveCached).toHaveBeenCalledWith({ postcode: "NG9 8DQ", ...providerResult });
    expect(result.addresses[0].line1).toContain("Copeland Avenue");
    expect(result.addresses[0].line1).not.toContain("Saville Close");
  });

  it("does not write a cache row when getAddress fails", async () => {
    provider.findByPostcode.mockRejectedValue(new Error("upstream unavailable"));

    await expect(service.lookupPostcode("NG9 8DQ")).rejects.toThrow("upstream unavailable");
    expect(repo.saveCached).not.toHaveBeenCalled();
  });

  it("fails the lookup when persisting a successful provider result fails", async () => {
    provider.findByPostcode.mockResolvedValue(providerResult);
    repo.saveCached.mockImplementation(() => {
      throw new Error("cache write failed");
    });

    await expect(service.lookupPostcode("NG9 8DQ")).rejects.toThrow("cache write failed");
  });
});
