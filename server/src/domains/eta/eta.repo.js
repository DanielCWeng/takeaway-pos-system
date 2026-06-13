import { getDb } from "../../infrastructure/db.js";

const stmts = { get: null, save: null };

function getStmts() {
  const db = getDb();
  if (!stmts.get) {
    stmts.get = db.prepare(
      "SELECT theta, p_matrix, sigma_sq, sample_count FROM eta_model WHERE id = 1",
    );
    stmts.save = db.prepare(`
      UPDATE eta_model
      SET theta = ?, p_matrix = ?, sigma_sq = ?, sample_count = ?, updated_at = datetime('now')
      WHERE id = 1
    `);
  }
  return stmts;
}

export function getModel() {
  const { get } = getStmts();
  const row = get.get();
  if (!row) return null;
  return {
    theta: JSON.parse(row.theta),
    pMatrix: JSON.parse(row.p_matrix),
    sigmaSq: row.sigma_sq,
    sampleCount: row.sample_count,
  };
}

export function saveModel({ theta, pMatrix, sigmaSq, sampleCount }) {
  const { save } = getStmts();
  save.run(JSON.stringify(theta), JSON.stringify(pMatrix), sigmaSq, sampleCount);
}
