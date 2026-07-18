/**
 * scripts/cleanupData.js
 *
 * Standalone data retention cleanup script.
 * Purges order history older than the configured years (default: 6).
 *
 * Usage:
 *   node scripts/cleanupData.js
 *
 * Exit codes:
 *   0 — cleanup successful
 *   1 — an error occurred
 */

import { config } from "../src/config/index.js";
import { openDb, closeDb } from "../src/infrastructure/db.js";
import { logger } from "../src/infrastructure/logger.js";
import { cleanupOldOrders } from "../src/domains/orders/orders.service.js";

async function run() {
  logger.info("Data cleanup starting", {
    dbPath: config.db.path,
    retentionYears: config.business.dataRetentionYears,
  });

  try {
    openDb();
    const deletedCount = cleanupOldOrders();
    closeDb();

    logger.info("Data cleanup complete", { deletedCount });
    process.exit(0);
  } catch (err) {
    logger.error("Data cleanup failed", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

run();
