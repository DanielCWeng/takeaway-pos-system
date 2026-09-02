import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/domains/customers/customers.service.js", () => ({
  getOrCreateCustomer: vi.fn(),
  listCustomerAddresses: vi.fn(() => []),
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import * as customerService from "../../src/domains/customers/customers.service.js";
import { logger } from "../../src/infrastructure/logger.js";
import {
  init,
  handlePhoneDetected,
  clearDebounceMap,
} from "../../src/domains/callerIdService/callerIdService.service.js";

describe("Caller ID Service init and broadcast guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDebounceMap();
  });

  it("throws TypeError when init is called without a function broadcast", () => {
    expect(() => init({ broadcast: null })).toThrow(TypeError);
    expect(() => init({ broadcast: 123 })).toThrow(/requires a broadcast function/);
  });

  it("logs and returns when handlePhoneDetected runs without init()", async () => {
    customerService.getOrCreateCustomer.mockResolvedValue({ phone: "07911123456" });

    await expect(handlePhoneDetected("07911 123456")).resolves.not.toThrow();

    expect(customerService.getOrCreateCustomer).toHaveBeenCalledWith("07911123456");
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("callerIdService.broadcast is not initialised"),
    );
  });
});
