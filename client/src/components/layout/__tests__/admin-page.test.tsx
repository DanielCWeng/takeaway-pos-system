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

const ordersPayload = {
  orders: [
    {
      id: 1,
      archivedAt: "2026-04-04T10:00:00.000Z",
      data: {
        orderType: "collection",
        customerInfo: { name: "Alice", phone: "0700" },
        items: [{ name: "Chips", quantity: 1, price: 3 }],
        total: 3,
      },
    },
    {
      id: 2,
      archivedAt: "2026-04-04T10:30:00.000Z",
      data: {
        orderType: "delivery",
        customerInfo: { name: "Bob", phone: "0711", street: "Main", postcode: "NG9" },
        items: [{ name: "Rice", quantity: 1, price: 4 }],
        total: 4,
      },
    },
  ],
};

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.fetchOrders as any).mockResolvedValue(ordersPayload);
    (apiClient.deleteOrdersByDate as any).mockResolvedValue({});
    (apiClient.reprintOrder as any).mockResolvedValue({ printed: true });
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
