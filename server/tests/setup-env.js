// Vitest setup file: ensure required server env vars exist.
//
// The config module validates environment variables on import.
// In CI we do not want tests to depend on a local `.env` file.

process.env.PORT ||= "4000";
process.env.DB_PATH ||= ":memory:";
process.env.POSTCODES_DB_PATH ||= "./data/postcodes.db";

process.env.GETADDRESS_API_KEY ||= "";
process.env.STORE_POSTCODE ||= "NG9 8GF";
process.env.STORE_LATITUDE ||= "52.9";
process.env.STORE_LONGITUDE ||= "-1.2";

process.env.PRINTER_VENDOR_ID ||= "0x154f";
process.env.PRINTER_PRODUCT_ID ||= "0x154f";
process.env.CALLER_DEVICE_PATH ||= "";

process.env.DELIVERY_BASE_CHARGE ||= "2.00";
process.env.DELIVERY_DISTANCE_THRESHOLD_MILES ||= "2";
process.env.DELIVERY_RATE_PER_MILE ||= "0.50";
process.env.ORDER_AUTO_RELOAD_COUNT ||= "3";
process.env.ORDER_AUTO_CLEANUP_MINUTES ||= "5";
process.env.MAX_CONCURRENT_ORDERS ||= "9";
process.env.ADMIN_API_TOKEN ||= "test-admin-token";

process.env.LOG_LEVEL ||= "error";
process.env.WS_HEARTBEAT_MS ||= "30000";
