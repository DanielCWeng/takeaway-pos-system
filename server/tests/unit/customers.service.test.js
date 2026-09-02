import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../src/shared/errors.js";

vi.mock("../../src/domains/customers/customers.repo.js", () => ({
  findByPhone: vi.fn(),
  upsertCustomer: vi.fn(),
  upsertAndIncrementCallCount: vi.fn(),
  updateName: vi.fn(),
  listAddressesByCustomer: vi.fn(),
  upsertCustomerAddress: vi.fn(),
  deleteByPhone: vi.fn(),
}));
vi.mock("../../src/domains/orders/orders.service.js", () => ({
  scrubOrdersByPhone: vi.fn(),
  getOrdersByPhone: vi.fn(),
}));
vi.mock("../../src/config/index.js", () => ({
  config: { address: { storeLatitude: 52.9, storeLongitude: -1.2 } },
}));
vi.mock("../../src/shared/haversine.js", () => ({ haversineInMiles: vi.fn(() => 1.5) }));
vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as service from "../../src/domains/customers/customers.service.js";
import * as repo from "../../src/domains/customers/customers.repo.js";

describe("customers.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.listAddressesByCustomer.mockReturnValue([]);
  });

  it("normalises a UK phone when creating a caller identity", () => {
    repo.upsertAndIncrementCallCount.mockReturnValue({ phone: "07911123456" });
    service.getOrCreateCustomer("+44 7911 123456");
    expect(repo.upsertAndIncrementCallCount).toHaveBeenCalledWith("07911123456", {});
  });

  it("rejects invalid phone identifiers", () => {
    expect(() => service.getOrCreateCustomer("123")).toThrow(ValidationError);
  });

  it("returns identity and confirmed history without postcode enrichment", () => {
    repo.findByPhone.mockReturnValue({ phone: "07911123456", name: "Alice" });
    repo.listAddressesByCustomer.mockReturnValue([
      {
        line1: "10 Copeland Avenue",
        line2: "",
        town: "Nottingham",
        postcode: "NG9 8DQ",
        latitude: 52.91,
        longitude: -1.25,
      },
    ]);

    const addresses = service.listCustomerAddresses("07911123456");

    expect(addresses[0]).toMatchObject({ line1: "10 Copeland Avenue", distance: 1.5 });
  });

  it("rejects history lookup for an unknown customer", () => {
    repo.findByPhone.mockReturnValue(null);
    expect(() => service.listCustomerAddresses("07911123456")).toThrow(NotFoundError);
  });

  it("persists a confirmed order address only in customer history", () => {
    repo.findByPhone.mockReturnValue({ phone: "07911123456", name: "Alice" });

    service.syncCustomerFromOrder(
      {
        phone: "07911123456",
        name: "Alice",
        line1: "10 Copeland Avenue",
        line2: "",
        town: "Nottingham",
        postcode: "NG9 8DQ",
        latitude: 52.91,
        longitude: -1.25,
      },
      { includeAddress: true },
    );

    expect(repo.upsertCustomerAddress).toHaveBeenCalledWith("07911123456", {
      line1: "10 Copeland Avenue",
      line2: "",
      town: "Nottingham",
      postcode: "NG9 8DQ",
      latitude: 52.91,
      longitude: -1.25,
    });
    expect(repo.upsertCustomer).not.toHaveBeenCalled();
    expect(repo.updateName).not.toHaveBeenCalled();
  });

  it("does not write address history unless the confirmed-delivery caller opts in", () => {
    repo.findByPhone.mockReturnValue({ phone: "07911123456", name: "Alice" });

    service.syncCustomerFromOrder({
      phone: "07911123456",
      name: "Alice",
      line1: "10 Copeland Avenue",
      postcode: "NG9 8DQ",
    });

    expect(repo.upsertCustomerAddress).not.toHaveBeenCalled();
  });

  it("creates identity and allows a manual address with null coordinates", () => {
    repo.findByPhone.mockReturnValue(null);
    service.syncCustomerFromOrder(
      {
        phone: "07911123456",
        name: "New customer",
        line1: "1 Manual Road",
        postcode: "NG1 1AA",
      },
      { includeAddress: true },
    );
    expect(repo.upsertCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "07911123456",
        name: "New customer",
      }),
    );
    expect(repo.upsertCustomerAddress).toHaveBeenCalledWith(
      "07911123456",
      expect.objectContaining({ line1: "1 Manual Road", latitude: undefined }),
    );
  });
});
