import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../../api/client", () => ({
  apiClient: {
    fetchOrders: vi.fn(),
    deleteOrdersByDate: vi.fn(),
    reprintOrder: vi.fn(),
  },
}));

vi.mock("../../../config", () => ({
  config: {
    adminPassword: "1234",
    apiUrl: "http://localhost:4000/api",
    wsUrl: "ws://localhost:4000",
  },
}));

import { AdminPage } from "../admin-page";
import { apiClient } from "../../../api/client";
import type { ArchivedOrder, FullOrder, OrderItem } from "../../../types";

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    uniqueId: "line-1",
    id: "ITEM-1",
    name: "Chips",
    quantity: 1,
    price: 3,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<FullOrder> = {}): FullOrder {
  return {
    orderType: "collection",
    customerInfo: { name: "Alice", phone: "0700" },
    items: [makeItem()],
    payment: { method: "cash", amount: 3 },
    total: 3,
    ...overrides,
  };
}

const ordersPayload = {
  orders: [
    {
      id: 1,
      archivedAt: "2026-04-04T10:00:00.000Z",
      data: makeOrder(),
    },
    {
      id: 2,
      archivedAt: "2026-04-04T10:30:00.000Z",
      data: makeOrder({
        orderType: "delivery",
        customerInfo: { name: "Bob", phone: "0711", street: "Main", postcode: "NG9" },
        items: [makeItem({ uniqueId: "line-2", id: "ITEM-2", name: "Rice", price: 4 })],
        payment: { method: "card", amount: 4 },
        total: 4,
      }),
    },
  ],
} satisfies { orders: ArchivedOrder[] };

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchOrders).mockResolvedValue(ordersPayload);
    vi.mocked(apiClient.deleteOrdersByDate).mockResolvedValue(undefined);
    vi.mocked(apiClient.reprintOrder).mockResolvedValue({ printed: true });
  });

  it("handles login, fetch/filter, delete day, and reprint workflow", async () => {
    render(<AdminPage onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "UNLOCK" }));

    await waitFor(() => {
      expect(apiClient.fetchOrders).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Admin Dashboard")).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("ID, Name, Phone..."), {
      target: { value: "Bob" },
    });
    expect(screen.getByText("Bob")).toBeTruthy();

    fireEvent.click(screen.getByText("#2"));
    fireEvent.click(screen.getByRole("button", { name: /REPRINT/i }));

    await waitFor(() => {
      expect(apiClient.reprintOrder).toHaveBeenCalledWith(2);
    });

    fireEvent.click(screen.getByRole("button", { name: /Clear Day/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(apiClient.deleteOrdersByDate).toHaveBeenCalledTimes(1);
    });
  });
});
