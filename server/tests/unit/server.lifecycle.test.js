import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("server lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function bootServer() {
    const handlers = {};
    const server = {
      closeAllConnections: vi.fn(),
      closeIdleConnections: vi.fn(),
      close: vi.fn((cb) => cb?.()),
    };
    const app = {
      use: vi.fn(),
      set: vi.fn(),
      listen: vi.fn((_port, cb) => {
        queueMicrotask(() => cb?.());
        return server;
      }),
    };
    const express = vi.fn(() => app);
    express.json = vi.fn(() => "json-middleware");
    const cors = vi.fn(() => "cors-middleware");

    const openDb = vi.fn();
    const runMigrations = vi.fn();
    const closeDb = vi.fn();
    const createWsServer = vi.fn();
    const broadcast = vi.fn();
    const closeWsServer = vi.fn();
    const closePostcodeDb = vi.fn();
    const startListening = vi.fn().mockResolvedValue(undefined);
    const stopListening = vi.fn();
    const initCallerIdService = vi.fn();
    const handlePhoneDetected = vi.fn();
    const logger = { info: vi.fn(), error: vi.fn() };

    vi.doMock("express", () => ({ default: express }));
    vi.doMock("cors", () => ({ default: cors }));
    vi.doMock("../../src/config/index.js", () => ({
      config: {
        port: 4444,
        corsOrigin: "http://localhost:5173",
        security: {
          adminApiToken: "test-admin-token",
          trustProxy: false,
          apiRateLimitWindowMs: 60000,
          apiRateLimitMaxRequests: 600,
          apiRateLimitMaxBuckets: 5000,
        },
      },
    }));
    vi.doMock("../../src/infrastructure/db.js", () => ({
      openDb,
      runMigrations,
      closeDb,
    }));
    vi.doMock("../../src/infrastructure/logger.js", () => ({ logger }));
    vi.doMock("../../src/api/router.js", () => ({
      apiRouter: "api-router",
      globalErrorHandler: "global-error-handler",
    }));
    vi.doMock("../../src/api/websocket.js", () => ({
      createWsServer,
      broadcast,
      closeWsServer,
    }));
    vi.doMock("../../src/shared/postcodes.js", () => ({ closePostcodeDb }));
    vi.doMock("../../src/hardware/callerIdDevice.js", () => ({
      startListening,
      stopListening,
    }));
    vi.doMock("../../src/domains/callerIdService/callerIdService.service.js", () => ({
      init: initCallerIdService,
      handlePhoneDetected,
    }));

    const processOnSpy = vi.spyOn(process, "on").mockImplementation((event, handler) => {
      handlers[event] = handler;
      return process;
    });
    const processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined);

    await import("../../src/server.js");
    await Promise.resolve();

    return {
      app,
      server,
      handlers,
      openDb,
      runMigrations,
      closeDb,
      createWsServer,
      broadcast,
      closeWsServer,
      closePostcodeDb,
      startListening,
      stopListening,
      initCallerIdService,
      handlePhoneDetected,
      logger,
      processOnSpy,
      processExitSpy,
    };
  }

  it("boots in order and wires startup dependencies", async () => {
    const ctx = await bootServer();

    expect(ctx.openDb).toHaveBeenCalledTimes(1);
    expect(ctx.runMigrations).toHaveBeenCalledTimes(1);
    expect(ctx.openDb.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.runMigrations.mock.invocationCallOrder[0],
    );

    expect(ctx.app.listen).toHaveBeenCalledWith(4444, expect.any(Function));
    expect(ctx.createWsServer).toHaveBeenCalledWith(ctx.server);
    expect(ctx.initCallerIdService).toHaveBeenCalledWith({
      broadcast: ctx.broadcast,
    });
    expect(ctx.startListening).toHaveBeenCalledWith(expect.any(Function));

    const phoneHandler = ctx.startListening.mock.calls[0][0];
    await phoneHandler("07911123456");
    expect(ctx.handlePhoneDetected).toHaveBeenCalledWith("07911123456");
  });

  it("runs graceful shutdown cleanup and fatal handlers", async () => {
    const ctx = await bootServer();

    ctx.handlers.SIGTERM();

    expect(ctx.stopListening).toHaveBeenCalledTimes(1);
    expect(ctx.closePostcodeDb).toHaveBeenCalledTimes(1);
    expect(ctx.closeWsServer).toHaveBeenCalledTimes(1);
    expect(ctx.server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(ctx.server.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(ctx.server.close).toHaveBeenCalledTimes(1);
    expect(ctx.closeDb).toHaveBeenCalledTimes(1);
    expect(ctx.processExitSpy).toHaveBeenCalledWith(0);

    ctx.handlers.uncaughtException(new Error("boom"));
    expect(ctx.logger.error).toHaveBeenCalledWith(
      "Uncaught exception",
      expect.objectContaining({ message: "boom" }),
    );
    expect(ctx.processExitSpy).toHaveBeenCalledWith(1);

    ctx.handlers.unhandledRejection(new Error("bad promise"));
    expect(ctx.logger.error).toHaveBeenCalledWith(
      "Unhandled promise rejection",
      expect.objectContaining({ reason: "bad promise" }),
    );
    expect(ctx.processExitSpy).toHaveBeenCalledWith(1);
  });
});
