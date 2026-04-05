-- Migration: 004_orders_client_order_id
-- Adds a client-generated idempotency key to orders.
-- Allows the server to detect and deduplicate retry submissions from the client
-- print queue without creating duplicate order rows.
--
-- NULL is allowed (legacy orders have no clientOrderId) so the unique index
-- uses a partial WHERE clause to exclude NULLs from the uniqueness check.

ALTER TABLE orders ADD COLUMN client_order_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_order_id
  ON orders (client_order_id)
  WHERE client_order_id IS NOT NULL;
