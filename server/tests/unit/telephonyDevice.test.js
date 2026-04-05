import { beforeEach, describe, expect, it, vi } from "vitest";

describe("telephonyDevice", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadModule({ provider = "none", bridgePort = 0 } = {}) {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const tapi = {
      startListening: vi.fn(),
      stopListening: vi.fn(),
      dial: vi.fn().mockReturnValue(true),
      isBridgeConnected: vi.fn().mockReturnValue(true),
    };
    const bridge = {
      startBridge: vi.fn(),
      stopBridge: vi.fn(),
    };
    const asterisk = {
      startListening: vi.fn().mockResolvedValue(undefined),
      stopListening: vi.fn(),
      dial: vi.fn().mockReturnValue(true),
      isBridgeConnected: vi.fn().mockReturnValue(true),
    };

    vi.doMock("../../src/config/index.js", () => ({
      config: {
        tapi: { bridgePort },
        telephony: {
          provider,
        },
      },
    }));
    vi.doMock("../../src/infrastructure/logger.js", () => ({ logger }));
    vi.doMock("../../src/hardware/tapiDevice.js", () => tapi);
    vi.doMock("../../src/hardware/tapiBridgeProcess.js", () => bridge);
    vi.doMock("../../src/hardware/asteriskAmiDevice.js", () => asterisk);

    const mod = await import("../../src/hardware/telephonyDevice.js");
    return { mod, logger, tapi, bridge, asterisk };
  }

  it("disables dial/start when provider is none", async () => {
    const { mod, tapi, bridge, asterisk } = await loadModule({ provider: "none", bridgePort: 0 });

    await mod.startListening({ onOffering: vi.fn() });

    expect(mod.getTelephonyProvider()).toBe("none");
    expect(mod.isDialEnabled()).toBe(false);
    expect(mod.isTelephonyConnected()).toBe(false);
    expect(mod.dial("07123456789")).toBe(false);
    expect(tapi.startListening).not.toHaveBeenCalled();
    expect(bridge.startBridge).not.toHaveBeenCalled();
    expect(asterisk.startListening).not.toHaveBeenCalled();
  });

  it("routes startup and dial through tapi provider when enabled", async () => {
    const { mod, tapi, bridge, asterisk } = await loadModule({
      provider: "tapi",
      bridgePort: 8765,
    });

    await mod.startListening({
      onOffering: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    expect(mod.getTelephonyProvider()).toBe("tapi");
    expect(mod.isDialEnabled()).toBe(true);
    expect(bridge.startBridge).toHaveBeenCalledTimes(1);
    expect(tapi.startListening).toHaveBeenCalledTimes(1);
    expect(asterisk.startListening).not.toHaveBeenCalled();
    expect(mod.dial("07123456789")).toBe(true);
    expect(tapi.dial).toHaveBeenCalledWith("07123456789");

    mod.stopListening();
    expect(tapi.stopListening).toHaveBeenCalledTimes(1);
    expect(bridge.stopBridge).toHaveBeenCalledTimes(1);
  });

  it("treats tapi provider as disabled when bridgePort is 0", async () => {
    const { mod, tapi, bridge } = await loadModule({ provider: "tapi", bridgePort: 0 });

    await mod.startListening({ onOffering: vi.fn() });

    expect(mod.getTelephonyProvider()).toBe("none");
    expect(mod.isDialEnabled()).toBe(false);
    expect(tapi.startListening).not.toHaveBeenCalled();
    expect(bridge.startBridge).not.toHaveBeenCalled();
  });

  it("routes startup and dial through asterisk provider", async () => {
    const { mod, tapi, bridge, asterisk } = await loadModule({
      provider: "asterisk_ami",
      bridgePort: 0,
    });

    await mod.startListening({
      onOffering: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    expect(mod.getTelephonyProvider()).toBe("asterisk_ami");
    expect(mod.isDialEnabled()).toBe(true);
    expect(asterisk.startListening).toHaveBeenCalledTimes(1);
    expect(tapi.startListening).not.toHaveBeenCalled();
    expect(bridge.startBridge).not.toHaveBeenCalled();

    expect(mod.dial("07123456789")).toBe(true);
    expect(asterisk.dial).toHaveBeenCalledWith("07123456789");
    expect(mod.isTelephonyConnected()).toBe(true);

    mod.stopListening();
    expect(asterisk.stopListening).toHaveBeenCalledTimes(1);
  });
});
