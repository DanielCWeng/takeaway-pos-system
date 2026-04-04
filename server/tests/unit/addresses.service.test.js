import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../src/shared/errors.js";

vi.mock("../../src/config/index.js", () => ({
  config: {
    address: {
      apiKey: "",
      storeLatitude: 52.9,
      storeLongitude: -1.2,
    },
  },
}));

vi.mock("../../src/shared/postcodes.js", () => ({
  normalisePostcode: vi.fn(),
  findAddressesLocally: vi.fn(),
  saveAddresses: vi.fn(),
}));

vi.mock("../../src/domains/callerIdService/addressClient.js", () => ({
  findAddressesFromApi: vi.fn(),
}));

vi.mock("../../src/domains/customers/customers.service.js", () => ({
  getOrCreateCustomer: vi.fn(),
  updateCustomerAddress: vi.fn(),
}));

vi.mock("../../src/shared/haversine.js", () => ({
  haversineInMiles: vi.fn(),
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import * as service from "../../src/domains/addresses/addresses.service.js";
import * as postcodes from "../../src/shared/postcodes.js";
import * as addressClient from "../../src/domains/callerIdService/addressClient.js";
import * as customersService from "../../src/domains/customers/customers.service.js";
import { haversineInMiles } from "../../src/shared/haversine.js";
import { config } from "../../src/config/index.js";

describe("addresses.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postcodes.normalisePostcode.mockImplementation((postcode) => postcode?.toUpperCase() ?? "");
    postcodes.findAddressesLocally.mockReturnValue([]);
    config.address.apiKey = "";
  });

  describe("lookupPostcode", () => {
    it("maps ward to town for local rows", async () => {
      postcodes.normalisePostcode.mockReturnValue("NG1 1AA");
      postcodes.findAddressesLocally.mockReturnValue([
        {
          postcode: "NG1 1AA",
          line1: "Huntingdon Street",
          ward: "St. Ann's",
          latitude: 52.955,
          longitude: -1.146,
        },
      ]);

      const result = await service.lookupPostcode("ng11aa");

      expect(result.source).toBe("local_db");
      expect(result.addresses).toEqual([
        {
          line1: "Huntingdon Street",
          line2: "",
          town: "St. Ann's",
          postcode: "NG1 1AA",
          latitude: 52.955,
          longitude: -1.146,
        },
      ]);
      expect(addressClient.findAddressesFromApi).not.toHaveBeenCalled();
    });

    it("returns no_api_key when local db has no result and api key is absent", async () => {
      postcodes.normalisePostcode.mockReturnValue("NG9 8GF");
      postcodes.findAddressesLocally.mockReturnValue([]);
      config.address.apiKey = "";

      const result = await service.lookupPostcode("ng98gf");

      expect(result).toEqual({ addresses: [], source: "no_api_key" });
      expect(addressClient.findAddressesFromApi).not.toHaveBeenCalled();
    });

    it("returns not_found when API returns null", async () => {
      postcodes.normalisePostcode.mockReturnValue("NG9 8GF");
      config.address.apiKey = "test-key";
      addressClient.findAddressesFromApi.mockResolvedValue(null);

      const result = await service.lookupPostcode("ng9 8gf");

      expect(addressClient.findAddressesFromApi).toHaveBeenCalledWith("NG9 8GF");
      expect(result).toEqual({ addresses: [], source: "not_found" });
    });

    it("falls back to API and saves first address to local cache", async () => {
      postcodes.normalisePostcode.mockReturnValue("NG9 8GF");
      config.address.apiKey = "test-key";
      addressClient.findAddressesFromApi.mockResolvedValue([
        {
          line1: "123 High Road",
          line2: "Beeston",
          town: "Nottingham",
          latitude: 52.91,
          longitude: -1.25,
        },
      ]);

      const result = await service.lookupPostcode("ng9 8gf");

      expect(result.source).toBe("api");
      expect(result.addresses).toEqual([
        {
          line1: "123 High Road",
          line2: "Beeston",
          town: "Nottingham",
          postcode: "NG9 8GF",
          latitude: 52.91,
          longitude: -1.25,
        },
      ]);
      expect(postcodes.saveAddresses).toHaveBeenCalledWith(
        "NG9 8GF",
        {
          street: "123 High Road",
          latitude: 52.91,
          longitude: -1.25,
        },
        [
          {
            line1: "123 High Road",
            line2: "Beeston",
            town: "Nottingham",
            postcode: "NG9 8GF",
            latitude: 52.91,
            longitude: -1.25,
          },
        ],
      );
    });

    it("throws ValidationError for malformed postcode input", async () => {
      postcodes.normalisePostcode.mockReturnValue("INVALID");

      await expect(service.lookupPostcode("bad postcode")).rejects.toThrow(ValidationError);
      expect(postcodes.findAddressesLocally).not.toHaveBeenCalled();
    });
  });

  describe("verifyAddress", () => {
    it("generates UNKNOWN phone when phone is missing or invalid", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.123456789);
      customersService.updateCustomerAddress.mockImplementation((phone, update) => ({
        phone,
        ...update,
      }));

      const customer = service.verifyAddress("", {
        line1: "10 High St",
        town: "Nottingham",
        postcode: "NG9 8GF",
      });

      expect(customersService.getOrCreateCustomer).toHaveBeenCalledTimes(1);
      const generated = customersService.getOrCreateCustomer.mock.calls[0][0];
      expect(generated).toMatch(/^UNKNOWN-/);
      expect(customersService.updateCustomerAddress).toHaveBeenCalledWith(
        generated,
        expect.objectContaining({ postcode: "NG9 8GF" }),
      );
      expect(customer.phone).toBe(generated);
    });

    it("accepts existing UNKNOWN-* phones without regenerating", () => {
      customersService.updateCustomerAddress.mockReturnValue({ phone: "UNKNOWN-ABC123XYZ" });

      service.verifyAddress("UNKNOWN-ABC123XYZ", {
        line1: "10 High St",
        town: "Nottingham",
        postcode: "NG9 8GF",
      });

      expect(customersService.getOrCreateCustomer).toHaveBeenCalledWith("UNKNOWN-ABC123XYZ");
      expect(customersService.updateCustomerAddress).toHaveBeenCalledWith(
        "UNKNOWN-ABC123XYZ",
        expect.objectContaining({ postcode: "NG9 8GF" }),
      );
    });

    it("computes distance when latitude and longitude are provided", () => {
      postcodes.normalisePostcode.mockReturnValue("NG9 8GF");
      haversineInMiles.mockReturnValue(1.236);
      customersService.updateCustomerAddress.mockReturnValue({});

      service.verifyAddress("07911123456", {
        line1: "10 High St",
        town: "Nottingham",
        postcode: "NG9 8GF",
        latitude: 52.91,
        longitude: -1.23,
      });

      expect(haversineInMiles).toHaveBeenCalledWith(52.9, -1.2, 52.91, -1.23);
      expect(customersService.updateCustomerAddress).toHaveBeenCalledWith(
        "07911123456",
        expect.objectContaining({ distance: 1.24 }),
      );
    });

    it("does not compute distance when coordinates are absent", () => {
      postcodes.normalisePostcode.mockReturnValue("NG9 8GF");
      customersService.updateCustomerAddress.mockReturnValue({});

      service.verifyAddress("07911123456", {
        line1: "10 High St",
        town: "Nottingham",
        postcode: "NG9 8GF",
      });

      expect(haversineInMiles).not.toHaveBeenCalled();
      expect(customersService.updateCustomerAddress).toHaveBeenCalledWith(
        "07911123456",
        expect.not.objectContaining({ distance: expect.anything() }),
      );
    });

    it("throws ValidationError when postcode is invalid in verify flow", () => {
      postcodes.normalisePostcode.mockReturnValue("BAD");

      expect(() =>
        service.verifyAddress("07911123456", {
          line1: "10 High St",
          town: "Nottingham",
          postcode: "BAD",
        }),
      ).toThrow(ValidationError);

      expect(customersService.updateCustomerAddress).not.toHaveBeenCalled();
    });
  });
});
