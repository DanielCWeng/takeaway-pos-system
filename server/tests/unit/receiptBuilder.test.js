import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { buildReceiptBuffer } from "../../src/hardware/printer/receiptBuilder.js";

describe("receiptBuilder", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders computed totals, modifiers, and Chinese lines in text fallback mode", () => {
    const parts = buildReceiptBuffer(
      {
        id: 42,
        archivedAt: "2026-01-01T12:30:00.000Z",
        data: {
          orderType: "delivery",
          items: [
            {
              id: "A1",
              name: "Chicken Chow Mein",
              zhName: "???",
              price: 8,
              finalPrice: 7.5,
              quantity: 2,
              modifiers: [
                {
                  command: "REMOVE",
                  ingredient: { name: "Onion", zh: "??" },
                },
              ],
            },
          ],
          customerInfo: {
            line1: "12 Main Street",
            town: "Toton & Chilwell Meadows Extra",
            postcode: "ng9 8gf",
            phone: "07911123456",
            distance: 1.237,
            mapRef: "A-12",
          },
          total: 18.2,
        },
      },
      { canvasApi: null },
    );

    const rendered = parts.map((part) => part.toString("utf8")).join("");

    expect(rendered).toContain("DELIVERY  #42");
    expect(rendered).toContain("(A1) Chicken Chow Mein (REMOVE");
    expect(rendered).toContain("Onion)");
    expect(rendered).toContain("2 ???");
    expect(rendered).toContain("(走");
    expect(rendered).toContain("Sub-total");
    expect(rendered).toContain("15.00");
    expect(rendered).toContain("+Delivery");
    expect(rendered).toContain("3.20");
    expect(rendered).toContain("Total 18.20");
    expect(rendered).toContain("Map ref: A-12");
    expect(rendered).toContain("Mileage: 1.24 miles");
    expect(rendered).toContain("12 Main Street");
    expect(rendered).toContain("Toton & Chilwell");
    expect(rendered).toContain("NG9 8GF");
  });

  it("uses provided subtotal and deliveryCharge instead of deriving them", () => {
    const parts = buildReceiptBuffer(
      {
        id: 7,
        data: {
          orderType: "delivery",
          items: [{ name: "Soup", price: 5, quantity: 1 }],
          subtotal: 10,
          deliveryCharge: 2.5,
          total: 12.5,
        },
      },
      { canvasApi: null },
    );

    const rendered = parts.map((part) => part.toString("utf8")).join("");

    expect(rendered).toContain("Sub-total");
    expect(rendered).toContain("10.00");
    expect(rendered).toContain("+Delivery");
    expect(rendered).toContain("2.50");
    expect(rendered).toContain("Total 12.50");
  });
});
