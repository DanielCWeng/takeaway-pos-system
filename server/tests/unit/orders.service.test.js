import { describe, it, expect, vi, beforeEach } from "vitest";
import * as service from "../../src/domains/orders/orders.service.js";
import * as repo from "../../src/domains/orders/orders.repo.js";
import { getDb } from "../../src/infrastructure/db.js";
import { ValidationError, NotFoundError } from "../../src/shared/errors.js";

// Mock the repo
vi.mock("../../src/domains/orders/orders.repo.js", () => ({
  createOrder: vi.fn(),
  findOrderById: vi.fn(),
  findAllOrders: vi.fn(),
  findOrdersByDate: vi.fn(),
  deleteOrder: vi.fn(),
  deleteOrdersByDate: vi.fn(),
}));

// Mock the DB for transactions
vi.mock("../../src/infrastructure/db.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../src/hardware/printer.js", () => ({
  printReceipt: vi.fn(),
}));

import { printReceipt } from "../../src/hardware/printer.js";

describe("Orders Service", () => {
  const mockDb = {
    transaction: vi.fn((cb) => cb),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getDb.mockReturnValue(mockDb);
  });

  describe("createOrder (validation)", () => {
    it("throws if order is null or undefined", () => {
      expect(() => service.createOrder(null)).toThrow(ValidationError);
      expect(() => service.createOrder(undefined)).toThrow(ValidationError);
    });

    it("throws if items array is missing or empty", () => {
      expect(() => service.createOrder({ orderType: "collection" })).toThrow(/at least one item/);
      expect(() => service.createOrder({ orderType: "collection", items: [] })).toThrow(
        /at least one item/,
      );
    });

    it("throws if item payload is invalid", () => {
      const baseOrder = { orderType: "collection", items: [{}] };

      // Missing name
      expect(() => service.createOrder(baseOrder)).toThrow(/missing a name/);

      // Invalid price
      expect(() =>
        service.createOrder({ ...baseOrder, items: [{ name: "Chips", price: -1 }] }),
      ).toThrow(/invalid price/);

      // Invalid quantity
      expect(() =>
        service.createOrder({ ...baseOrder, items: [{ name: "Chips", price: 2, quantity: 0 }] }),
      ).toThrow(/invalid quantity/);
    });

    it("throws on invalid orderType", () => {
      expect(() =>
        service.createOrder({
          orderType: "dine-in",
          items: [{ name: "Chips", price: 2, quantity: 1 }],
        }),
      ).toThrow(/must be one of/);
    });

    it("passes for a valid collection order", () => {
      repo.createOrder.mockReturnValue({ id: 1 });
      expect(() =>
        service.createOrder({
          orderType: "collection",
          items: [{ name: "Chips", price: 2, quantity: 1 }],
        }),
      ).not.toThrow();
    });

    it("throws if delivery order lacks customer address info", () => {
      // Missing entirely
      expect(() =>
        service.createOrder({
          orderType: "delivery",
          items: [{ name: "Chips", price: 2, quantity: 1 }],
        }),
      ).toThrow(/require a valid customer address/);

      // Missing postcode
      expect(() =>
        service.createOrder({
          orderType: "delivery",
          items: [{ name: "Chips", price: 2, quantity: 1 }],
          customerInfo: { name: "Bob", address: "123 Fake St" },
        }),
      ).toThrow(/require a valid customer address/);
    });

    it("allows delivery order without customer name when address/postcode are present", () => {
      expect(() =>
        service.createOrder({
          orderType: "delivery",
          items: [{ name: "Chips", price: 2, quantity: 1 }],
          customerInfo: { address: "123 Fake St", postcode: "NG9 8GF" },
        }),
      ).not.toThrow();
    });

    it("passes for a valid delivery order", () => {
      repo.createOrder.mockReturnValue({ id: 1 });
      expect(() =>
        service.createOrder({
          orderType: "delivery",
          items: [{ name: "Chips", price: 2, quantity: 1 }],
          customerInfo: { name: "Bob", address: "123 Fake St", postcode: "NG9 8GF" },
        }),
      ).not.toThrow();
    });
  });

  describe("createOrder", () => {
    it("validates and then delegates to repo", () => {
      const orderData = {
        orderType: "collection",
        items: [{ name: "Chips", price: 2, quantity: 1 }],
      };
      const expectedResult = { id: 1, data: orderData, archivedAt: "2026-01-01T00:00:00Z" };
      repo.createOrder.mockReturnValue(expectedResult);

      const result = service.createOrder(orderData);

      expect(repo.createOrder).toHaveBeenCalledWith({ data: orderData });
      expect(result).toEqual(expectedResult);
    });

    it("blocks creation if validation fails", () => {
      const orderData = { orderType: "delivery", items: [] }; // Invalid
      expect(() => service.createOrder(orderData)).toThrow(ValidationError);
      expect(repo.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("deleteOrder", () => {
    it("throws NotFoundError if order does not exist", () => {
      repo.findOrderById.mockReturnValue(null);
      expect(() => service.deleteOrder(999)).toThrow(NotFoundError);
      expect(repo.deleteOrder).not.toHaveBeenCalled();
    });

    it("delegates to repo if order exists (wrapped in transaction)", () => {
      repo.findOrderById.mockReturnValue({ id: 1 });
      service.deleteOrder(1);

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(repo.deleteOrder).toHaveBeenCalledWith(1);
    });
  });

  describe("listOrders", () => {
    it("delegates to repo", () => {
      repo.findAllOrders.mockReturnValue([{ id: 1 }, { id: 2 }]);
      const result = service.listOrders();
      expect(repo.findAllOrders).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe("getOrderById", () => {
    it("throws NotFoundError if not found", () => {
      repo.findOrderById.mockReturnValue(null);
      expect(() => service.getOrderById(999)).toThrow(NotFoundError);
    });

    it("returns the order from the repo", () => {
      repo.findOrderById.mockReturnValue({ id: 1 });
      const result = service.getOrderById(1);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe("printAndArchiveOrder", () => {
    it("archives and returns printed: true when printer succeeds", async () => {
      const orderData = {
        orderType: "collection",
        items: [{ name: "Chips", price: 2, quantity: 1 }],
      };
      const archived = { id: 1, data: orderData, archivedAt: "2026-01-01T00:00:00Z" };

      repo.createOrder.mockReturnValue(archived);
      printReceipt.mockResolvedValue({ printed: true });

      await expect(service.printAndArchiveOrder(orderData)).resolves.toEqual({
        orderId: 1,
        printed: true,
      });
      expect(repo.createOrder).toHaveBeenCalledWith({ data: orderData });
      expect(printReceipt).toHaveBeenCalledWith(archived);
    });

    it("archives and returns printed: false when printer fails", async () => {
      const orderData = {
        orderType: "collection",
        items: [{ name: "Chips", price: 2, quantity: 1 }],
      };
      repo.createOrder.mockReturnValue({
        id: 1,
        data: orderData,
        archivedAt: "2026-01-01T00:00:00Z",
      });
      printReceipt.mockRejectedValue(new Error("Printer down"));

      await expect(service.printAndArchiveOrder(orderData)).resolves.toEqual({
        orderId: 1,
        printed: false,
      });
    });
  });

  describe("reprintOrder", () => {
    it("throws NotFoundError if order does not exist", async () => {
      repo.findOrderById.mockReturnValue(null);
      await expect(service.reprintOrder(123)).rejects.toThrow(NotFoundError);
    });

    it("returns printed: true when printer succeeds", async () => {
      repo.findOrderById.mockReturnValue({ id: 1, data: {}, archivedAt: "2026-01-01T00:00:00Z" });
      printReceipt.mockResolvedValue({ printed: true });

      await expect(service.reprintOrder(1)).resolves.toEqual({ printed: true });
    });

    it("returns printed: false when printer fails", async () => {
      repo.findOrderById.mockReturnValue({ id: 1, data: {}, archivedAt: "2026-01-01T00:00:00Z" });
      printReceipt.mockRejectedValue(new Error("Printer down"));

      await expect(service.reprintOrder(1)).resolves.toEqual({ printed: false });
    });
  });

  describe("listOrders with date", () => {
    it("should filter orders by date", () => {
      const mockOrders = [{ id: 1, archivedAt: "2023-01-01T10:00:00Z" }];
      repo.findOrdersByDate.mockReturnValue(mockOrders);

      const result = service.listOrders("2023-01-01");
      expect(repo.findOrdersByDate).toHaveBeenCalledWith("2023-01-01");
      expect(result).toEqual(mockOrders);
    });

    it("should throw ValidationError for invalid date format", () => {
      expect(() => service.listOrders("invalid-date")).toThrow(ValidationError);
    });
  });

  describe("deleteOrdersByDate", () => {
    it("should call repo.deleteOrdersByDate", () => {
      service.deleteOrdersByDate("2023-01-01");
      expect(repo.deleteOrdersByDate).toHaveBeenCalledWith("2023-01-01");
    });

    it("should throw ValidationError for invalid date format", () => {
      expect(() => service.deleteOrdersByDate("invalid-date")).toThrow(ValidationError);
    });
  });
});
