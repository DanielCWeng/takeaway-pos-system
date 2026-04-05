-- Migration: 003_orders_customer_phone_index.sql
-- Adds an expression index to speed up GDPR export/erasure phone lookups
-- inside the orders.data JSON blob.

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_json
ON orders(json_extract(data, '$.customerInfo.phone'))
WHERE json_valid(data) = 1;
