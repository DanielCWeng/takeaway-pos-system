import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeliveryAddressModal } from "../delivery-address-modal";

vi.mock("../../../api/client", () => ({
  apiClient: {
    lookupPostcode: vi.fn(),
    fetchCustomer: vi.fn(),
    verifyAddress: vi.fn(),
  },
}));

import { apiClient } from "../../../api/client";

describe("DeliveryAddressModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("applies lookup result when postcode resolves to a single address", async () => {
    vi.mocked(apiClient.lookupPostcode).mockResolvedValue({
      addresses: [
        {
          line1: "10 High Street",
          town: "Nottingham",
          postcode: "NG9 8GF",
        },
      ],
      source: "api",
    });

    render(<DeliveryAddressModal customerInfo={{}} onClose={vi.fn()} onSave={vi.fn()} />);

    const postcodeInput = screen.getByPlaceholderText("NG9 1AA");
    fireEvent.change(postcodeInput, { target: { value: "NG9 8GF" } });
    fireEvent.keyDown(postcodeInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("10 High Street")).toBeTruthy();
      expect(screen.getByDisplayValue("Nottingham")).toBeTruthy();
      expect(screen.getByDisplayValue("NG9 8GF")).toBeTruthy();
    });
  });

  it("falls back to saving local form data when verify returns 404", async () => {
    const onSave = vi.fn();
    vi.mocked(apiClient.verifyAddress).mockRejectedValue(
      Object.assign(new Error("missing"), { status: 404 }),
    );

    render(<DeliveryAddressModal customerInfo={{}} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("07..."), { target: { value: "07911123456" } });
    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByPlaceholderText("NG9 1AA"), { target: { value: "NG9 8GF" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: "07911123456",
          name: "Alex",
          postcode: "NG9 8GF",
        }),
      );
    });
  });
});
