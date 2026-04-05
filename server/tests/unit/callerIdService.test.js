import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  init,
  handlePhoneDetected,
  clearDebounceMap,
} from "../../src/domains/callerIdService/callerIdService.service.js";
import * as customerService from "../../src/domains/customers/customers.service.js";

// Mock dependencies
vi.mock("../../src/domains/customers/customers.service.js");
vi.mock("../../src/infrastructure/logger.js");

const broadcast = vi.fn();

describe("Caller ID Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    broadcast.mockReset();
    clearDebounceMap();
    init({ broadcast });
  });

  it("orchestrates a full call flow for a known customer", async () => {
    const phone = "07911123456";
    const mockCustomer = {
      phone,
      name: "Alice",
      postcode: "NG9 8GF",
      distance: "1.20",
    };
    const mockAddress = { line1: "10 High St" };

    customerService.getOrCreateCustomer.mockReturnValue(mockCustomer);
    customerService.enrichCustomerAddress.mockResolvedValue({
      customer: mockCustomer,
      addresses: [mockAddress],
    });

    await handlePhoneDetected(phone);

    expect(customerService.getOrCreateCustomer).toHaveBeenCalledWith(phone);
    expect(customerService.enrichCustomerAddress).toHaveBeenCalledWith(phone, "NG9 8GF");
    expect(broadcast).toHaveBeenCalledWith(
      "incoming_call",
      expect.objectContaining({
        phone,
        customer: mockCustomer,
        addresses: [mockAddress],
        distance: "1.20",
        mode: "single_address",
      }),
    );
  });

  it("normalizes phone number by stripping non-digits", async () => {
    const rawPhone = "(0115) 123-4567";
    const normPhone = "01151234567";
    const mockCustomer = { phone: normPhone };

    customerService.getOrCreateCustomer.mockReturnValue(mockCustomer);

    await handlePhoneDetected(rawPhone);

    expect(customerService.getOrCreateCustomer).toHaveBeenCalledWith(normPhone);
    expect(broadcast).toHaveBeenCalledWith(
      "incoming_call",
      expect.objectContaining({
        phone: normPhone,
        mode: "none",
      }),
    );
  });

  it("debounces rapid-fire events for the same phone number", async () => {
    const phone = "07911123456";
    customerService.getOrCreateCustomer.mockReturnValue({});

    await handlePhoneDetected(phone);
    await handlePhoneDetected(phone);

    expect(customerService.getOrCreateCustomer).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it("handles errors gracefully without crashing", async () => {
    customerService.getOrCreateCustomer.mockRejectedValue(new Error("DB Fail"));

    // Should not throw
    await expect(handlePhoneDetected("07911123456")).resolves.not.toThrow();
    // Verify it still broadcasts even if lookup fails (Continue anyway)
    // This ensures the frontend still sees the incoming phone number even if the DB is down.
    expect(broadcast).toHaveBeenCalledWith(
      "incoming_call",
      expect.objectContaining({
        phone: "07911123456",
        customer: null,
        addresses: [],
        mode: "none",
      }),
    );
  });

  it("emits incoming_call_multi_address when customer-linked addresses are multiple", async () => {
    const phone = "07911123456";
    const mockCustomer = { phone, postcode: "NG9 8GF" };
    const addresses = [{ line1: "1 A St" }, { line1: "2 B St" }];
    customerService.getOrCreateCustomer.mockReturnValue(mockCustomer);
    customerService.enrichCustomerAddress.mockResolvedValue({ customer: mockCustomer, addresses });

    await handlePhoneDetected(phone, { callId: 42, source: "tapi" });

    expect(broadcast).toHaveBeenCalledWith(
      "incoming_call_multi_address",
      expect.objectContaining({
        phone,
        addresses,
        callId: 42,
        mode: "multi_address",
      }),
    );
  });
});
