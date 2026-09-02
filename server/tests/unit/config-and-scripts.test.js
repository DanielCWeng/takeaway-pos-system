import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(here, "../..");

function makeValidEnv(overrides = {}) {
  return {
    ...process.env,
    PORT: "4000",
    CORS_ORIGIN: "http://localhost:5173",
    DB_PATH: ":memory:",
    GETADDRESS_API_KEY: "",
    STORE_LATITUDE: "52.9",
    STORE_LONGITUDE: "-1.2",
    PRINTER_VENDOR_ID: "0x154f",
    PRINTER_PRODUCT_ID: "0x154f",
    CALLER_DEVICE_PATH: "",
    DELIVERY_BASE_CHARGE: "2.00",
    DELIVERY_DISTANCE_THRESHOLD_MILES: "2",
    DELIVERY_RATE_PER_MILE: "0.50",
    ORDER_AUTO_RELOAD_COUNT: "3",
    ORDER_AUTO_CLEANUP_MINUTES: "5",
    MAX_CONCURRENT_ORDERS: "9",
    ADMIN_API_TOKEN: "test-admin-token",
    LOG_LEVEL: "error",
    WS_HEARTBEAT_MS: "30000",
    ...overrides,
  };
}

describe("config and scripts", () => {
  it("fails fast when config env schema is invalid", () => {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", "import './src/config/index.js'"],
      {
        cwd: serverRoot,
        env: makeValidEnv({ PORT: "abc" }),
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Server configuration is invalid");
    expect(result.stderr).toContain("PORT");
  });

  it("migrate script exits with code 1 on invalid environment", () => {
    const result = spawnSync(process.execPath, ["scripts/migrate.js"], {
      cwd: serverRoot,
      env: makeValidEnv({ PORT: "not-a-number" }),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Server configuration is invalid");
  });
});
