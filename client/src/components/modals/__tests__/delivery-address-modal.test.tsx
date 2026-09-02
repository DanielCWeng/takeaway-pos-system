import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { DeliveryAddressModal } from "../delivery-address-modal";

vi.mock("../../../api/client", () => ({
  apiClient: {
    lookupPostcode: vi.fn(),
    fetchCustomer: vi.fn(),
  },
}));

import { apiClient } from "../../../api/client";

describe("DeliveryAddressModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("applies lookup result when postcode resolves to a single address", async () => {
    const onSave = vi.fn();
    vi.mocked(apiClient.lookupPostcode).mockResolvedValue({
      addresses: [
        {
          line1: "10 High Street",
          town: "Nottingham",
          postcode: "NG9 8GF",
          latitude: 52.95,
          longitude: -1.18,
        },
      ],
    });

    render(<DeliveryAddressModal customerInfo={{}} onClose={vi.fn()} onSave={onSave} />);

    const postcodeInput = screen.getByPlaceholderText("NG9 1AA");
    fireEvent.change(postcodeInput, { target: { value: "NG9 8GF" } });
    fireEvent.keyDown(postcodeInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("10 High Street")).toBeTruthy();
      expect(screen.getByDisplayValue("Nottingham")).toBeTruthy();
      expect(screen.getByDisplayValue("NG9 8GF")).toBeTruthy();
    });

    fireEvent.change(screen.getByDisplayValue("10 High Street"), {
      target: { value: "10 High Street (rear entrance)" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        line1: "10 High Street (rear entrance)",
        latitude: null,
        longitude: null,
        distance: null,
      }),
    );
  });

  it("opens the picker for multiple provider results", async () => {
    vi.mocked(apiClient.lookupPostcode).mockResolvedValue({
      addresses: [
        {
          line1: "10 Copeland Avenue",
          postcode: "NG9 8DQ",
          latitude: 52.91,
          longitude: -1.25,
        },
        {
          line1: "12 Copeland Avenue",
          postcode: "NG9 8DQ",
          latitude: 52.91,
          longitude: -1.25,
        },
      ],
    });
    render(<DeliveryAddressModal customerInfo={{}} onClose={vi.fn()} onSave={vi.fn()} />);
    const postcodeInput = screen.getByPlaceholderText("NG9 1AA");
    fireEvent.change(postcodeInput, { target: { value: "NG9 8DQ" } });
    fireEvent.keyDown(postcodeInput, { key: "Enter" });

    expect(await screen.findByText("10 Copeland Avenue")).toBeTruthy();
    expect(screen.getByText("12 Copeland Avenue")).toBeTruthy();
  });

  it("saves a syntactically valid manual address without verification", async () => {
    const onSave = vi.fn();

    render(<DeliveryAddressModal customerInfo={{}} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("07..."), { target: { value: "07911123456" } });
    fireEvent.change(screen.getByPlaceholderText("John Doe"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByPlaceholderText("NG9 1AA"), { target: { value: "NG9 8GF" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 42 Copeland Avenue"), {
      target: { value: "42 Copeland Avenue" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: "07911123456",
          name: "Alex",
          postcode: "NG9 8GF",
          line1: "42 Copeland Avenue",
          deliveryTime: expect.stringMatching(/^\d{2}:\d{2}$/),
        }),
      );
    });
    expect(apiClient.lookupPostcode).not.toHaveBeenCalled();
  });

  it("keeps manual entry usable when lookup is unavailable", async () => {
    vi.mocked(apiClient.lookupPostcode).mockRejectedValue(
      Object.assign(new Error("Lookup unavailable"), { status: 502 }),
    );

    render(<DeliveryAddressModal customerInfo={{}} onClose={vi.fn()} onSave={vi.fn()} />);
    const postcodeInput = screen.getByPlaceholderText("NG9 1AA");
    fireEvent.change(postcodeInput, { target: { value: "NG9 8DQ" } });
    fireEvent.keyDown(postcodeInput, { key: "Enter" });

    await screen.findByText(/Address lookup is unavailable.*enter the address manually/i);
    expect(
      screen.getByPlaceholderText("e.g. 42 Copeland Avenue").getAttribute("disabled"),
    ).toBeNull();
  });

  it("clears an existing address when customer search finds no saved history", async () => {
    vi.mocked(apiClient.fetchCustomer).mockResolvedValue({
      customer: {
        phone: "07911123456",
        name: "New Customer",
        firstCall: "2026-01-01T00:00:00.000Z",
        lastCall: "2026-01-01T00:00:00.000Z",
        callCount: 1,
      },
      addresses: [],
    });

    render(
      <DeliveryAddressModal
        customerInfo={{
          phone: "07911123456",
          name: "Old Customer",
          postcode: "NG9 8DQ",
          line1: "10 Old Road",
          line2: "Old Flat",
          town: "Old Town",
          latitude: 52.91,
          longitude: -1.25,
          distance: 1.5,
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText("07..."), { key: "Enter" });

    await screen.findByText(/No saved address/i);
    expect((screen.getByPlaceholderText("e.g. 42 Copeland Avenue") as HTMLInputElement).value).toBe(
      "",
    );
    expect((screen.getByPlaceholderText("NG9 1AA") as HTMLInputElement).value).toBe("NG9 ");
    expect(screen.queryByDisplayValue("Old Flat")).toBeNull();
    expect(screen.queryByDisplayValue("Old Town")).toBeNull();
  });

  it.each([
    [
      "one",
      [
        {
          line1: "18 Saved Road",
          line2: "Flat 3",
          town: "Beeston",
          postcode: "NG9 8AA",
          latitude: 52.92,
          longitude: -1.23,
          distance: 1.2,
        },
      ],
      "18 Saved Road",
    ],
    [
      "multiple",
      [
        {
          line1: "18 Saved Road",
          postcode: "NG9 8AA",
          latitude: 52.92,
          longitude: -1.23,
        },
        {
          line1: "20 Other Road",
          postcode: "NG9 8AB",
          latitude: 52.93,
          longitude: -1.24,
        },
      ],
      "20 Other Road",
    ],
  ])("requires explicit selection with %s saved history", async (_label, addresses, selected) => {
    const onSave = vi.fn();
    vi.mocked(apiClient.fetchCustomer).mockResolvedValue({
      customer: {
        phone: "07911999999",
        name: "History Customer",
        firstCall: "2026-01-01T00:00:00.000Z",
        lastCall: "2026-01-01T00:00:00.000Z",
        callCount: 1,
      },
      addresses,
    });

    render(
      <DeliveryAddressModal
        customerInfo={{
          phone: "07911000000",
          line1: "Previous Customer Address",
          postcode: "NG9 7AA",
          latitude: 52.9,
          longitude: -1.2,
          distance: 2,
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const phoneInput = screen.getByPlaceholderText("07...");
    fireEvent.change(phoneInput, { target: { value: "07911999999" } });
    fireEvent.keyDown(phoneInput, { key: "Enter" });

    expect(await screen.findByText("Select Address")).toBeTruthy();
    expect((screen.getByPlaceholderText("e.g. 42 Copeland Avenue") as HTMLInputElement).value).toBe(
      "",
    );
    expect(screen.queryByDisplayValue("Previous Customer Address")).toBeNull();

    fireEvent.click(screen.getByText(selected));
    expect((screen.getByPlaceholderText("e.g. 42 Copeland Avenue") as HTMLInputElement).value).toBe(
      selected,
    );
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ line1: selected, phone: "07911999999" }),
    );
  });

  it.each(["Cancel", "Enter Manually"])(
    "%s from saved history cannot restore the previous customer address",
    async (action) => {
      vi.mocked(apiClient.fetchCustomer).mockResolvedValue({
        customer: {
          phone: "07911999999",
          name: "History Customer",
          firstCall: "2026-01-01T00:00:00.000Z",
          lastCall: "2026-01-01T00:00:00.000Z",
          callCount: 1,
        },
        addresses: [
          {
            line1: "18 Saved Road",
            postcode: "NG9 8AA",
            latitude: 52.92,
            longitude: -1.23,
          },
        ],
      });

      render(
        <DeliveryAddressModal
          customerInfo={{
            phone: "07911000000",
            line1: "Previous Customer Address",
            postcode: "NG9 7AA",
            latitude: 52.9,
            longitude: -1.2,
            distance: 2,
          }}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />,
      );

      const phoneInput = screen.getByPlaceholderText("07...");
      fireEvent.change(phoneInput, { target: { value: "07911999999" } });
      fireEvent.keyDown(phoneInput, { key: "Enter" });
      await screen.findByText("Select Address");

      const matchingButtons = screen.getAllByRole("button", { name: action });
      fireEvent.click(matchingButtons[matchingButtons.length - 1]);

      await waitFor(() => expect(screen.queryByText("Select Address")).toBeNull());
      expect(
        (screen.getByPlaceholderText("e.g. 42 Copeland Avenue") as HTMLInputElement).value,
      ).toBe("");
      expect(screen.queryByDisplayValue("Previous Customer Address")).toBeNull();
    },
  );

  it.each([
    ["postcode", "NG9 8DQ", "NG9 8AA"],
    ["town", "Starting Town", "Changed Town"],
    ["line2", "Starting Flat", "Changed Flat"],
  ])("clears lookup coordinates when %s is edited", (_field, initialValue, changedValue) => {
    const onSave = vi.fn();
    render(
      <DeliveryAddressModal
        customerInfo={{
          postcode: _field === "postcode" ? initialValue : "NG9 8DQ",
          line1: "10 Starting Road",
          line2: _field === "line2" ? initialValue : "Starting Flat",
          town: _field === "town" ? initialValue : "Starting Town",
          latitude: 52.91,
          longitude: -1.25,
          distance: 1.5,
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByDisplayValue(initialValue), { target: { value: changedValue } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: null, longitude: null, distance: null }),
    );
  });

  it("clears an old address when provider selection switches to manual entry", async () => {
    const onSave = vi.fn();
    vi.mocked(apiClient.lookupPostcode).mockResolvedValue({
      addresses: [
        {
          line1: "10 Provider Road",
          postcode: "NG9 8DQ",
          latitude: 52.91,
          longitude: -1.25,
        },
        {
          line1: "12 Provider Road",
          postcode: "NG9 8DQ",
          latitude: 52.91,
          longitude: -1.25,
        },
      ],
    });
    render(
      <DeliveryAddressModal
        customerInfo={{
          postcode: "NG9 8DQ",
          line1: "Old Selected Road",
          latitude: 52.91,
          longitude: -1.25,
          distance: 1.5,
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText("NG9 1AA"), { key: "Enter" });
    await screen.findByText("Select Address");
    fireEvent.click(screen.getByRole("button", { name: "Enter Manually" }));

    const line1Input = screen.getByPlaceholderText("e.g. 42 Copeland Avenue");
    expect((line1Input as HTMLInputElement).value).toBe("");
    fireEvent.change(line1Input, { target: { value: "Manual Road" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        line1: "Manual Road",
        postcode: "NG9 8DQ",
        latitude: null,
        longitude: null,
        distance: null,
      }),
    );
  });

  it("ignores a lookup response after the operator edits the address", async () => {
    let resolveLookup!: (value: {
      addresses: Array<{
        line1: string;
        postcode: string;
        latitude: number;
        longitude: number;
      }>;
    }) => void;
    vi.mocked(apiClient.lookupPostcode).mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );

    render(<DeliveryAddressModal customerInfo={{}} onClose={vi.fn()} onSave={vi.fn()} />);
    const postcodeInput = screen.getByPlaceholderText("NG9 1AA");
    const line1Input = screen.getByPlaceholderText("e.g. 42 Copeland Avenue");
    fireEvent.change(postcodeInput, { target: { value: "NG9 8DQ" } });
    fireEvent.keyDown(postcodeInput, { key: "Enter" });
    fireEvent.change(postcodeInput, { target: { value: "NG9 8GF" } });
    fireEvent.change(line1Input, { target: { value: "Manual Address" } });

    await act(async () => {
      resolveLookup({
        addresses: [
          {
            line1: "Late Provider Address",
            postcode: "NG9 8DQ",
            latitude: 52.91,
            longitude: -1.25,
          },
        ],
      });
    });

    expect((postcodeInput as HTMLInputElement).value).toBe("NG9 8GF");
    expect((line1Input as HTMLInputElement).value).toBe("Manual Address");
    expect(screen.queryByDisplayValue("Late Provider Address")).toBeNull();
  });
});
