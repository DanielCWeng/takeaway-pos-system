/**
 * infrastructure/db.js
 *
 * better-sqlite3 singleton + migration runner.
 *
 * Rules:
 *  - Only one connection is ever opened (singleton).
 *  - Migrations complete BEFORE the server binds to a port.
 *  - The raw Database handle is only exported for use by repo modules.
 *  - Domain (service) modules must never import from this file directly.
 */

import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "../config/index.js";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** @type {import('better-sqlite3').Database | null} */
let _db = null;

/**
 * Returns the open database connection.
 * Throws if the DB has not been initialised yet (i.e. openDb() was not called).
 *
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (!_db) {
    throw new Error("Database has not been initialised. Call openDb() before using getDb().");
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

/**
 * Opens the database connection.
 * Should be called once during application startup, before runMigrations().
 *
 * @param {string} [dbPath] - Override the DB path (used in tests for ':memory:')
 * @returns {import('better-sqlite3').Database}
 */
export function openDb(dbPath) {
  const path = dbPath ?? config.db.path;

  _db = new Database(path, {
    // No verbose logging in production — debug-level SQL logs are noisy.
    // Enable only when configured logLevel is 'debug'.
    verbose: config.logLevel === "debug" ? (msg) => logger.debug(msg) : null,
  });

  // Enable WAL mode for better concurrent read performance
  _db.pragma("journal_mode = WAL");
  // Enforce foreign key constraints
  _db.pragma("foreign_keys = ON");
  // Wait up to 5s before throwing SQLITE_BUSY
  _db.pragma("busy_timeout = 5000");

  logger.info("Database opened", { path });

  return _db;
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = join(__dirname, "migrations");

/**
 * Runs any SQL migration files in `infrastructure/migrations/` that have not
 * yet been applied. Migrations are applied in ascending filename order.
 *
 * The `_migrations` table acts as the applied-migrations ledger.
 * This function is idempotent — already-applied migrations are skipped.
 */
export function runMigrations() {
  const db = getDb();

  // Bootstrap: ensure the migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  // Collect all .sql files, sorted by name (so 001_ comes before 002_, etc.)
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Query for already-applied migrations once
  const applied = new Set(
    db
      .prepare("SELECT filename FROM _migrations")
      .all()
      .map((r) => r.filename),
  );

  let count = 0;
  for (const filename of files) {
    if (applied.has(filename)) {
      logger.debug("Migration already applied, skipping", { filename });
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, filename), "utf8");

    // Wrap each migration in a transaction so a partial failure can't corrupt state
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)").run(
        filename,
        new Date().toISOString(),
      );
    });

    applyMigration();
    logger.info("Migration applied", { filename });
    count++;
  }

  if (count === 0) {
    logger.info("All migrations are up to date");
  } else {
    logger.info(`Applied ${count} migration(s)`);
  }
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

/**
 * Closes the database connection cleanly.
 * Called manually during graceful shutdown — also safe to call in tests.
 */
export function closeDb() {
  if (_db && _db.open) {
    _db.close();
    logger.info("Database connection closed");
    _db = null;
  }
}
