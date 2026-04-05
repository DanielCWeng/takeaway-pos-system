-- Migration: 003_orders_customer_phone_index.sql
-- TODO: rename to 004_orders_customer_phone_index.sql — this file shares the 003_ prefix with
-- 003_call_logs.sql. The runner tracks by full filename so there is no runtime crash, but the
-- numbering is wrong and will cause confusion when the next migration is added.
-- Adds an expression index to speed up GDPR export/erasure phone lookups
-- inside the orders.data JSON blob.

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_json
ON orders(json_extract(data, '$.customerInfo.phone'))
WHERE json_valid(data) = 1;
