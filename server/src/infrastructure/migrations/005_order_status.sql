-- Migration: 005_order_status
-- Adds a separate workflow status table for the kitchen screen.
--
-- Design decisions:
--  - Kept separate from orders.data so the archive blob stays immutable.
--  - estimated_ready_at is set on creation (null for Phase 1, calculated client-side).
--  - actual_ready_at is set automatically by setOrderStatus when status → 'ready'.
--  - FK to orders(id) enforced — SQLite has foreign_keys = ON at runtime.

CREATE TABLE IF NOT EXISTS order_status (
  order_id            INTEGER PRIMARY KEY REFERENCES orders(id),
  status              TEXT NOT NULL DEFAULT 'new',
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by          TEXT NOT NULL DEFAULT 'system',
  estimated_ready_at  TEXT,
  actual_ready_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_status_status  ON order_status (status);
CREATE INDEX IF NOT EXISTS idx_order_status_updated ON order_status (updated_at DESC);
