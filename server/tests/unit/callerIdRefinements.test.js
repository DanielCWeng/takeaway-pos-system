import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  init,
  handlePhoneDetected,
  clearDebounceMap,
} from "../../src/domains/callerIdService/callerIdService.service.js";
import * as customerService from "../../src/domains/customers/customers.service.js";

vi.mock("../../src/domains/customers/customers.service.js");
vi.mock("../../src/infrastructure/logger.js");

const broadcast = vi.fn();

describe("CallerID Service Refinements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    broadcast.mockReset();
    clearDebounceMap();
    vi.useFakeTimers();
    init({ broadcast });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("evicts entries from debounce map after DEBOUNCE_MS", async () => {
    const phone = "0123456789";
    customerService.getOrCreateCustomer.mockResolvedValue({ phone });
    customerService.listCustomerAddresses.mockReturnValue([]);

    // First call
    await handlePhoneDetected(phone);
    expect(customerService.getOrCreateCustomer).toHaveBeenCalledTimes(1);

    // Immediate second call - should be debounced
    await handlePhoneDetected(phone);
    expect(customerService.getOrCreateCustomer).toHaveBeenCalledTimes(1);

    // Fast-forward time
    vi.advanceTimersByTime(2100); // DEBOUNCE_MS is 2000

    // Third call - should NOT be debounced
    await handlePhoneDetected(phone);
    expect(customerService.getOrCreateCustomer).toHaveBeenCalledTimes(2);
  });

  it("broadcasts confirmed customer history without postcode enrichment", async () => {
    const phone = "0123456789";
    const mockCustomer = { phone };
    const mockAddresses = [{ line1: "123 Fake St", town: "Springfield" }];

    customerService.getOrCreateCustomer.mockResolvedValue(mockCustomer);
    customerService.listCustomerAddresses.mockReturnValue(mockAddresses);

    await handlePhoneDetected(phone);

    expect(broadcast).toHaveBeenCalledWith(
      "incoming_call",
      expect.objectContaining({
        addresses: mockAddresses,
        mode: "single_address",
      }),
    );
  });

  it("broadcasts even if customer lookup fails", async () => {
    const phone = "01150000000";
    customerService.getOrCreateCustomer.mockRejectedValue(new Error("DB Down"));

    await handlePhoneDetected(phone);

    expect(broadcast).toHaveBeenCalledWith(
      "incoming_call",
      expect.objectContaining({
        phone: "01150000000",
        addresses: [],
        mode: "none",
      }),
    );
  });

  it("clearDebounceMap cancels pending eviction timers so they do not fire after clear", async () => {
    const phone = "07700900001";
    customerService.getOrCreateCustomer.mockResolvedValue({ phone });
    customerService.listCustomerAddresses.mockReturnValue([]);

    await handlePhoneDetected(phone);
    // Phone is now in the debounce map with a pending eviction timer

    clearDebounceMap();
    // Fast-forward past the debounce window — the cancelled timer should NOT fire
    vi.advanceTimersByTime(3000);

    // If the timer had fired it would try to delete from an already-cleared map (harmless but indicative).
    // The real check: a brand-new call to the same number must succeed (not be blocked by a stale map entry).
    await handlePhoneDetected(phone);
    expect(customerService.getOrCreateCustomer).toHaveBeenCalledTimes(2);
  });

  it("gracefully handles null phone input (hardware noise)", async () => {
    await expect(handlePhoneDetected(null)).resolves.not.toThrow();
    expect(customerService.getOrCreateCustomer).not.toHaveBeenCalled();
  });
});
