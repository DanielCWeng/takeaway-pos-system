import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

const mockDevices = vi.fn();
const hidCtor = vi.fn();

vi.mock("node-hid", () => ({
  default: {
    devices: mockDevices,
    HID: hidCtor,
  },
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { extractPhone, startListening, stopListening } from "../../src/hardware/callerIdDevice.js";

function makeMockHidDevice() {
  const handlers = new Map();
  return {
    on: vi.fn((event, cb) => {
      handlers.set(event, cb);
    }),
    close: vi.fn(),
    emit: (event, payload) => {
      const handler = handlers.get(event);
      if (handler) handler(payload);
    },
  };
}

describe("callerIdDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopListening();
    vi.useRealTimers();
  });

  it("extractPhone pulls first UK-style number from noisy HID packet", () => {
    const payload = Uint8Array.from([88, 48, 55, 57, 49, 49, 49, 50, 51, 52, 53, 54, 89, 90]);

    expect(extractPhone(payload)).toBe("07911123456");
    expect(extractPhone(Uint8Array.from([65, 66, 67]))).toBeNull();
  });

  it("starts listening and forwards extracted phone numbers to callback", async () => {
    const onPhone = vi.fn();
    const device = makeMockHidDevice();

    mockDevices.mockReturnValue([{ path: "mock-path", product: "JD-2000S" }]);
    hidCtor.mockImplementation(() => device);

    await startListening(onPhone);

    device.emit(
      "data",
      Uint8Array.from("noise 07911123456 noise".split("").map((c) => c.charCodeAt(0))),
    );

    expect(onPhone).toHaveBeenCalledWith("07911123456");
  });

  it("isolates callback errors so device listener does not crash", async () => {
    const onPhone = vi.fn(() => {
      throw new Error("UI callback failed");
    });
    const device = makeMockHidDevice();

    mockDevices.mockReturnValue([{ path: "mock-path", product: "JD-2000S" }]);
    hidCtor.mockImplementation(() => device);

    await startListening(onPhone);

    expect(() => {
      device.emit("data", Uint8Array.from("07911123456".split("").map((c) => c.charCodeAt(0))));
    }).not.toThrow();
  });

  it("schedules reconnect when HID device emits error", async () => {
    const onPhone = vi.fn();
    const firstDevice = makeMockHidDevice();
    const secondDevice = makeMockHidDevice();

    mockDevices.mockReturnValue([{ path: "mock-path", product: "JD-2000S" }]);
    hidCtor.mockImplementationOnce(() => firstDevice).mockImplementationOnce(() => secondDevice);

    await startListening(onPhone);
    firstDevice.emit("error", new Error("usb fault"));

    expect(hidCtor).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(hidCtor).toHaveBeenCalledTimes(2);
  });

  it("stopListening closes device and prevents pending reconnect from firing", async () => {
    const onPhone = vi.fn();
    const device = makeMockHidDevice();

    mockDevices.mockReturnValue([{ path: "mock-path", product: "JD-2000S" }]);
    hidCtor.mockImplementation(() => device);

    await startListening(onPhone);
    device.emit("error", new Error("usb fault"));

    stopListening();
    await vi.advanceTimersByTimeAsync(3000);

    expect(device.close).toHaveBeenCalledTimes(1);
    expect(hidCtor).toHaveBeenCalledTimes(1);
  });
});
