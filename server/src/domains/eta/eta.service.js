/**
 * domains/eta/eta.service.js
 *
 * Recursive Least Squares (RLS) model for order prep-time prediction.
 *
 * Feature vector: x = [1, item_count, complexity, queue_depth, is_delivery]
 * Prediction:     ŷ = θ · x
 * Forgetting:     λ = 0.95  (~20 most-recent orders drive the fit)
 */

import * as repo from "./eta.repo.js";

const LAMBDA = 0.95;
const N = 5;
const MAX_LEARNING_DURATION_MINS = 180;

// ---------------------------------------------------------------------------
// Linear algebra helpers (N-vector / N×N matrix)
// ---------------------------------------------------------------------------

function dot(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function matVec(M, v) {
  return M.map((row) => dot(row, v));
}

function matMul(A, B) {
  return A.map((row, i) =>
    B[0].map((_, j) => row.reduce((sum, _, k) => sum + A[i][k] * B[k][j], 0)),
  );
}

function outerProduct(a, b) {
  return a.map((ai) => b.map((bj) => ai * bj));
}

function matScale(M, s) {
  return M.map((row) => row.map((v) => v * s));
}

function matSub(A, B) {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]));
}

function identity(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
}

// ---------------------------------------------------------------------------
// Feature construction
// ---------------------------------------------------------------------------

function buildX(itemCount, complexity, queueDepth, isDelivery) {
  return [1, itemCount, complexity, queueDepth, isDelivery ? 1 : 0];
}

// ---------------------------------------------------------------------------
// Complexity derivation from order items
// ---------------------------------------------------------------------------

export function deriveItemCount(items) {
  return items.filter((i) => !i.parentId).reduce((sum, i) => sum + (i.quantity ?? 1), 0);
}

export function deriveComplexity(items) {
  const n = deriveItemCount(items);
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Predict
// ---------------------------------------------------------------------------

export function predict(itemCount, complexity, queueDepth, isDelivery) {
  const model = repo.getModel();
  if (!model) {
    const fallback = isDelivery ? 37 : 20;
    return { predictedMins: fallback, rangeLow: fallback - 5, rangeHigh: fallback + 10 };
  }

  const { theta, pMatrix, sigmaSq } = model;
  const x = buildX(itemCount, complexity, queueDepth, isDelivery);
  const yHat = dot(theta, x);

  const xTPx = dot(x, matVec(pMatrix, x));
  // Use a 5-min std-dev floor while model is cold (sigmaSq = 0 initially)
  const variance = sigmaSq > 0 ? sigmaSq * (1 + xTPx) : 25;
  const sigma = Math.sqrt(variance);

  const predictedMins = Math.max(5, Math.round(yHat));
  const rangeLow = Math.max(3, Math.round(yHat - 2 * sigma));
  const rangeHigh = Math.max(predictedMins + 2, Math.round(yHat + 2 * sigma));

  return { predictedMins, rangeLow, rangeHigh };
}

// ---------------------------------------------------------------------------
// RLS update — called once per completed order
// ---------------------------------------------------------------------------

export function updateModelWithObservation(itemCount, complexity, queueDepth, isDelivery, actualMins) {
  if (
    !Number.isFinite(actualMins) ||
    actualMins < 1 ||
    actualMins >= MAX_LEARNING_DURATION_MINS ||
    !Number.isFinite(itemCount) || !Number.isFinite(complexity) || !Number.isFinite(queueDepth)
  ) return;

  const model = repo.getModel();
  if (!model) return;

  const { theta, pMatrix, sigmaSq, sampleCount } = model;
  const x = buildX(itemCount, complexity, queueDepth, isDelivery);

  // Step 1: prediction error
  const yHat = dot(theta, x);
  const e = actualMins - yHat;

  // Step 2: gain vector k = Px / (λ + x^T P x)
  const Px = matVec(pMatrix, x);
  const xTPx = dot(x, Px);
  const k = Px.map((v) => v / (LAMBDA + xTPx));

  // Step 3: θ_new = θ_old + k·e
  const thetaNew = theta.map((t, i) => t + k[i] * e);

  // Step 4: P_new = (1/λ)(I − k x^T) P_old
  const IminusKxT = matSub(identity(N), outerProduct(k, x));
  const pNew = matScale(matMul(IminusKxT, pMatrix), 1 / LAMBDA);

  // Update σ² as exponential moving average of squared prediction error
  const newSigmaSq = sampleCount === 0 ? e * e : LAMBDA * sigmaSq + (1 - LAMBDA) * e * e;

  repo.saveModel({ theta: thetaNew, pMatrix: pNew, sigmaSq: newSigmaSq, sampleCount: sampleCount + 1 });
}
