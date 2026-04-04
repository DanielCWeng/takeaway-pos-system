import { describe, it, expect, vi, beforeEach } from "vitest";
import { HardwareError } from "../../src/shared/errors.js";

vi.mock("usb", () => ({
  default: {
    findByIds: vi.fn(),
  },
}));

vi.mock("canvas", () => ({}));

vi.mock("../../src/hardware/printer/receiptBuilder.js", () => ({
  buildReceiptBuffer: vi.fn(() => [Buffer.from([0x1b, 0x40])]),
}));

import usb from "usb";
import { printReceipt } from "../../src/hardware/printer.js";

function createDevice({ claimError, endpoints, releaseError, transferError } = {}) {
  const outEndpoint = {
    direction: "out",
    address: 1,
    transfer: vi.fn((_part, cb) => cb(transferError ?? null)),
  };

  const iface = {
    isKernelDriverActive: vi.fn(() => false),
    claim: vi.fn(() => {
      if (claimError) throw claimError;
    }),
    endpoints: endpoints ?? [outEndpoint],
    release: vi.fn((_close, cb) => cb?.(releaseError ?? null)),
  };

  const device = {
    open: vi.fn(),
    close: vi.fn(),
    interface: vi.fn(() => iface),
  };

  return { device, iface, outEndpoint };
}

describe("printer transport error branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns printed false when no printer device is found", async () => {
    usb.findByIds.mockReturnValue(null);

    await expect(printReceipt({ id: 1, data: { items: [] } })).resolves.toEqual({
      printed: false,
    });
  });

  it("throws HardwareError when interface claim fails", async () => {
    const { device } = createDevice({ claimError: new Error("claim denied") });
    usb.findByIds.mockReturnValue(device);

    await expect(printReceipt({ id: 1, data: { items: [] } })).rejects.toThrow(
      /Could not claim printer interface/,
    );
    expect(device.close).toHaveBeenCalled();
  });

  it("throws HardwareError when OUT endpoint is missing", async () => {
    const { device } = createDevice({
      endpoints: [
        {
          direction: "in",
          address: 2,
          transfer: vi.fn(),
        },
      ],
    });
    usb.findByIds.mockReturnValue(device);

    await expect(printReceipt({ id: 1, data: { items: [] } })).rejects.toThrow(
      /OUT endpoint not found/,
    );
    expect(device.close).toHaveBeenCalled();
  });

  it("throws HardwareError when endpoint transfer fails", async () => {
    const { device, outEndpoint } = createDevice({
      transferError: new Error("usb transfer failed"),
    });
    usb.findByIds.mockReturnValue(device);

    await expect(printReceipt({ id: 1, data: { items: [] } })).rejects.toThrow(
      /Failed to send data to printer/,
    );
    expect(outEndpoint.transfer).toHaveBeenCalled();
    expect(device.close).toHaveBeenCalled();
  });

  it("throws HardwareError when interface release fails after transfers", async () => {
    const { device } = createDevice({ releaseError: new Error("release failed") });
    usb.findByIds.mockReturnValue(device);

    await expect(printReceipt({ id: 1, data: { items: [] } })).rejects.toThrow(
      /Failed to release printer interface/,
    );
    expect(device.close).toHaveBeenCalled();
  });
});
