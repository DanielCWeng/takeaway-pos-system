-- migration: 003_call_logs
-- Records every completed inbound TAPI call for audit and analytics.
-- phone is NOT a foreign key on customers — a call may arrive from an unknown
-- number before the customer record exists (created by callerIdService).

CREATE TABLE IF NOT EXISTS call_logs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  phone            TEXT    NOT NULL,
  call_started_at  TEXT    NOT NULL,   -- ISO 8601 UTC
  call_ended_at    TEXT    NOT NULL,   -- ISO 8601 UTC
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  customer_name    TEXT,               -- snapshot at call time (nullable)
  notes            TEXT                -- for future manual annotation
);

CREATE INDEX IF NOT EXISTS idx_call_logs_phone         ON call_logs (phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_ended_at ON call_logs (call_ended_at DESC);
