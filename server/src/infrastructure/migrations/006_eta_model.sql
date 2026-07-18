-- ETA model state (single-row table, seeded from initial regression coefficients)
-- x = [1, item_count, complexity, queue_depth, is_delivery]
-- θ = [14.5, 1.09, 2.60, -1.85, 10.6]
CREATE TABLE IF NOT EXISTS eta_model (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  theta         TEXT    NOT NULL,
  p_matrix      TEXT    NOT NULL,
  sigma_sq      REAL    NOT NULL DEFAULT 0,
  sample_count  INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO eta_model (id, theta, p_matrix, sigma_sq, sample_count, updated_at)
VALUES (
  1,
  '[14.5,1.09,2.60,-1.85,10.6]',
  '[[100,0,0,0,0],[0,100,0,0,0],[0,0,100,0,0],[0,0,0,100,0],[0,0,0,0,100]]',
  0,
  0,
  datetime('now')
);

-- Extra columns on order_status to feed the self-updating ETA model
ALTER TABLE order_status ADD COLUMN item_count     INTEGER;
ALTER TABLE order_status ADD COLUMN complexity     INTEGER;
ALTER TABLE order_status ADD COLUMN queue_depth    INTEGER;
ALTER TABLE order_status ADD COLUMN is_delivery    INTEGER;
ALTER TABLE order_status ADD COLUMN predicted_mins REAL;
