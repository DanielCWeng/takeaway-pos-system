/**
 * scripts/migrate.js
 *
 * Standalone migration runner.
 * Run with: npm run migrate
 *
 * This script is safe to run multiple times — already-applied migrations are skipped.
 * It mirrors exactly what the server does on startup, so running this manually
 * is equivalent to letting the server handle it.
 *
 * Usage:
 *   node scripts/migrate.js
 *   npm run migrate
 *
 * Exit codes:
 *   0 — migrations ran successfully (or were already up to date)
 *   1 — an error occurred (printed to stderr)
 */

// Config first — exits if env is invalid
import { config } from '../src/config/index.js';

import { openDb, runMigrations, closeDb } from '../src/infrastructure/db.js';
import { logger } from '../src/infrastructure/logger.js';

logger.info('Migration runner starting', { dbPath: config.db.path });

try {
  openDb();
  runMigrations();
  closeDb();
  logger.info('Migration runner complete');
  process.exit(0);
} catch (err) {
  logger.error('Migration runner failed', {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
}
