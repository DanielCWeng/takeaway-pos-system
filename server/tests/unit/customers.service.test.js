import { describe, it, expect, vi, beforeEach } from "vitest";
import * as service from "../../src/domains/customers/customers.service.js";
import * as repo from "../../src/domains/customers/customers.repo.js";
import { ValidationError, NotFoundError } from "../../src/shared/errors.js";

// Mock dependencies
vi.mock("../../src/domains/customers/customers.repo.js", () => ({
  findByPhone: vi.fn(),
  upsertCustomer: vi.fn(),
  updateAddress: vi.fn(),
  incrementCallCountAndReturn: vi.fn(),
  upsertAndIncrementCallCount: vi.fn(),
}));

vi.mock("../../src/shared/postcodes.js");
vi.mock("../../src/domains/callerIdService/addressClient.js");
vi.mock("../../src/shared/haversine.js");
vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("../../src/config/index.js", () => ({
  config: {
    address: {
      storeLatitude: 52.9,
      storeLongitude: -1.2,
    },
  },
}));

import * as postcodes from "../../src/shared/postcodes.js";
import * as addressClient from "../../src/domains/callerIdService/addressClient.js";
import { haversineInMiles } from "../../src/shared/haversine.js";
import { logger } from "../../src/infrastructure/logger.js";

describe("Customers Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateCustomer", () => {
    it("throws ValidationError if phone is invalid", () => {
      expect(() => service.getOrCreateCustomer(null)).toThrow(ValidationError);
      expect(() => service.getOrCreateCustomer("")).toThrow(ValidationError);
      expect(() => service.getOrCreateCustomer("123")).toThrow(/between 10 and 13 digits/); // Too short
      expect(() => service.getOrCreateCustomer("12345678901234")).toThrow(
        /between 10 and 13 digits/,
      ); // Too long
    });
    it("delegates to upsertAndIncrementCallCount and returns the result", () => {
      const phone = "07911123456";
      const mockResult = { phone, callCount: 1 };
      repo.upsertAndIncrementCallCount.mockReturnValue(mockResult);

      const result = service.getOrCreateCustomer(phone);

      expect(repo.upsertAndIncrementCallCount).toHaveBeenCalledWith(phone, {});
      expect(result).toBe(mockResult);
    });

    it("normalises phone number before repo calls", () => {
      const messyPhone = "07911 123-456";
      const cleanPhone = "07911123456";
      repo.upsertAndIncrementCallCount.mockReturnValue({ phone: cleanPhone });

      service.getOrCreateCustomer(messyPhone);

      expect(repo.upsertAndIncrementCallCount).toHaveBeenCalledWith(cleanPhone, {});
    });

    it("accepts UNKNOWN-* phone identifiers without reformatting", () => {
      repo.upsertAndIncrementCallCount.mockReturnValue({ phone: "UNKNOWN-ABC123" });

      service.getOrCreateCustomer("UNKNOWN-ABC123");

      expect(repo.upsertAndIncrementCallCount).toHaveBeenCalledWith("UNKNOWN-ABC123", {});
    });
  });

  describe("updateCustomerAddress", () => {
    const addressData = { houseNumber: "42", postcode: "NG9 8GF" };

    it("throws ValidationError if phone is invalid", () => {
      expect(() => service.updateCustomerAddress("foo", addressData)).toThrow(ValidationError);
    });

    it("throws NotFoundError if customer does not exist", () => {
      repo.findByPhone.mockReturnValue(null);
      expect(() => service.updateCustomerAddress("07911123456", addressData)).toThrow(
        NotFoundError,
      );
      expect(repo.updateAddress).not.toHaveBeenCalled();
    });

    it("delegates to repo and returns updated customer", () => {
      const phone = "07911123456";
      // First find returns existing customer
      repo.findByPhone.mockReturnValueOnce({ phone });
      // Second find returns updated customer
      repo.findByPhone.mockReturnValueOnce({ phone, ...addressData });

      const result = service.updateCustomerAddress(phone, addressData);

      expect(repo.updateAddress).toHaveBeenCalledWith(phone, addressData);
      expect(result).toEqual({ phone, ...addressData });
    });
  });

  describe("getCustomerByPhone", () => {
    it("throws NotFoundError if not found", () => {
      repo.findByPhone.mockReturnValue(null);
      expect(() => service.getCustomerByPhone("07911123456")).toThrow(NotFoundError);
    });

    it("returns the customer if found", () => {
      repo.findByPhone.mockReturnValue({ phone: "07911123456" });
      const result = service.getCustomerByPhone("07911123456");
      expect(result.phone).toBe("07911123456");
    });
  });

  describe("enrichCustomerAddress", () => {
    const phone = "07911123456";
    const postcode = "NG9 8GF";

    it("updates customer with data from local DB if found", async () => {
      repo.findByPhone.mockReturnValue({ phone });
      postcodes.normalisePostcode.mockReturnValue(postcode);
      postcodes.findAddressesLocally.mockReturnValue([
        {
          street: "High St",
          latitude: 52.91,
          longitude: -1.21,
        },
      ]);
      haversineInMiles.mockReturnValue(1.5);

      const result = await service.enrichCustomerAddress(phone, postcode);

      expect(repo.updateAddress).toHaveBeenCalledWith(
        phone,
        expect.objectContaining({
          distance: 1.5,
        }),
      );
      expect(addressClient.findAddressesFromApi).not.toHaveBeenCalled();
      expect(result.addresses).toHaveLength(1);
    });

    it("falls back to API if not in local DB", async () => {
      repo.findByPhone.mockReturnValue({ phone });
      postcodes.normalisePostcode.mockReturnValue(postcode);
      postcodes.findAddressesLocally.mockReturnValue([]); // Not in DB
      addressClient.findAddressesFromApi.mockResolvedValue([
        { line1: "API St", town: "API Town", latitude: 52.92, longitude: -1.22 },
      ]);
      haversineInMiles.mockReturnValue(2.0);

      const result = await service.enrichCustomerAddress(phone, postcode);

      expect(addressClient.findAddressesFromApi).toHaveBeenCalledWith(postcode);
      expect(postcodes.saveAddresses).toHaveBeenCalled();
      expect(repo.updateAddress).toHaveBeenCalledWith(
        phone,
        expect.objectContaining({
          street: "API St",
          distance: 2.0,
        }),
      );
      expect(result.addresses).toHaveLength(1);
    });

    it("returns unchanged customer and empty addresses when no address data is found", async () => {
      const existing = { phone, postcode: null };
      repo.findByPhone.mockReturnValue(existing);
      postcodes.normalisePostcode.mockReturnValue(postcode);
      postcodes.findAddressesLocally.mockReturnValue([]);
      addressClient.findAddressesFromApi.mockResolvedValue(null);

      const result = await service.enrichCustomerAddress(phone, postcode);

      expect(repo.updateAddress).not.toHaveBeenCalled();
      expect(result).toEqual({ customer: existing, addresses: [] });
      expect(logger.info).toHaveBeenCalledWith("Address enrichment failed: no data found", {
        phone,
        postcode,
      });
    });

    it("bubbles coordinate errors from malformed local rows", async () => {
      repo.findByPhone.mockReturnValue({ phone });
      postcodes.normalisePostcode.mockReturnValue(postcode);
      postcodes.findAddressesLocally.mockReturnValue([
        { street: "Bad Coord St", latitude: undefined, longitude: -1.21 },
      ]);
      haversineInMiles.mockImplementation(() => {
        throw new TypeError("lat2 must be finite");
      });

      await expect(service.enrichCustomerAddress(phone, postcode)).rejects.toThrow(TypeError);
      expect(repo.updateAddress).not.toHaveBeenCalled();
    });

    it("bubbles coordinate errors from malformed API rows", async () => {
      repo.findByPhone.mockReturnValue({ phone });
      postcodes.normalisePostcode.mockReturnValue(postcode);
      postcodes.findAddressesLocally.mockReturnValue([]);
      addressClient.findAddressesFromApi.mockResolvedValue([
        { line1: "API St", town: "API Town", latitude: "bad", longitude: -1.22 },
      ]);
      haversineInMiles.mockImplementation(() => {
        throw new TypeError("lat2 must be finite");
      });

      await expect(service.enrichCustomerAddress(phone, postcode)).rejects.toThrow(TypeError);
      expect(repo.updateAddress).not.toHaveBeenCalled();
    });
  });
});
