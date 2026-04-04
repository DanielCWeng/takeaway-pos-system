import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printReceipt } from "../../src/hardware/printer.js";
import { HardwareError } from "../../src/shared/errors.js";

// Mock the usb module
vi.mock("usb", () => ({
  default: {
    findByIds: vi.fn(),
  },
}));

vi.mock("canvas", () => ({
  default: {
    createCanvas: vi.fn(),
  },
}));

import usb from "usb";

describe("Printer Module (Timeout)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects with HardwareError if the transfer times out", { timeout: 15000 }, async () => {
    const mockEndpoint = {
      direction: "out",
      transfer: vi.fn(), // Never calls the callback
    };
    const mockInterface = {
      claim: vi.fn(),
      release: vi.fn((_b, cb) => cb?.()),
      endpoints: [mockEndpoint],
    };
    const mockDevice = {
      open: vi.fn(),
      close: vi.fn(),
      interface: vi.fn(() => mockInterface),
    };

    usb.findByIds.mockReturnValue(mockDevice);

    vi.useRealTimers();
    const printPromise = printReceipt({ id: 1, data: { items: [] } }, { timeoutMs: 100 });

    await expect(printPromise).rejects.toThrow(HardwareError);
    await expect(printPromise).rejects.toThrow(/timed out/);
    expect(mockDevice.close).toHaveBeenCalled();
  });

  it("resolves if the transfer completes before timeout", async () => {
    const mockEndpoint = {
      direction: "out",
      transfer: vi.fn((_data, cb) => cb()), // Immediate success
    };
    const mockInterface = {
      claim: vi.fn(),
      release: vi.fn((_b, cb) => cb?.()),
      endpoints: [mockEndpoint],
    };
    const mockDevice = {
      open: vi.fn(),
      close: vi.fn(),
      interface: vi.fn(() => mockInterface),
    };

    usb.findByIds.mockReturnValue(mockDevice);

    const printPromise = printReceipt({ id: 1, data: { items: [] } });

    await expect(printPromise).resolves.toEqual({ printed: true });
    expect(mockEndpoint.transfer).toHaveBeenCalled();
  });
});
