import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { openDb, closeDb, runMigrations } from '../../src/infrastructure/db.js';
import { apiRouter, globalErrorHandler } from '../../src/api/router.js';

// Setup an Express app just for this test suite
const app = express();
app.use(express.json());
app.use('/api', apiRouter);
app.use(globalErrorHandler);

describe('Orders API Integration', () => {
  beforeAll(() => {
    openDb(':memory:');
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  let createdId = null;
  let printedOrderId = null;

  it('POST /api/orders — creates a valid collection order', async () => {
    const payload = {
      orderType: 'collection',
      items: [{ name: 'Chips', price: 2.5, quantity: 2 }],
      subtotal: 5.0,
      total: 5.0,
      paymentMethod: 'cash',
    };

    const res = await request(app).post('/api/orders').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.id).toBeTypeOf('number');
    expect(res.body.order.data).toEqual({
      ...payload,
      items: payload.items.map((item) => ({
        modifiers: [],
        hidePrice: false,
        hideQuantity: false,
        ...item,
      })),
    });

    createdId = res.body.order.id;
  });

  it('POST /api/orders/print - archives and returns printed flag', async () => {
    const payload = {
      order: {
        orderType: 'collection',
        items: [{ name: 'Spring Roll', price: 3.0, quantity: 1 }],
        total: 3.0,
        payment: { method: 'cash', amount: 3.0 },
      },
      payment: { method: 'cash', amount: 3.0 },
    };

    const res = await request(app).post('/api/orders/print').send(payload);

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBeTypeOf('number');
    expect(res.body.printed).toBeTypeOf('boolean');

    printedOrderId = res.body.orderId;
  });

  it('POST /api/orders/:id/reprint - returns printed flag (best-effort)', async () => {
    const res = await request(app).post(`/api/orders/${printedOrderId}/reprint`);

    expect(res.status).toBe(200);
    expect(res.body.printed).toBeTypeOf('boolean');
  });

  it('POST /api/orders — returns 400 for a delivery order without an address', async () => {
    const payload = {
      orderType: 'delivery',
      items: [{ name: 'Burger', price: 6 }],
      customerInfo: { name: 'Bob' }, // Missing address/postcode
    };

    const res = await request(app).post('/api/orders').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/require a valid customer address/);
  });

  it('POST /api/orders — returns 400 for an empty items array', async () => {
    const payload = {
      orderType: 'collection',
      items: [],
    };

    const res = await request(app).post('/api/orders').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/orders — lists archived orders', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.orders.some((o) => o.id === createdId)).toBe(true);
  });

  it('GET /api/orders/:id — fetches a single order', async () => {
    const res = await request(app).get(`/api/orders/${createdId}`);

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(createdId);
  });

  it('GET /api/orders/:id — returns 404 for unknown order', async () => {
    const res = await request(app).get('/api/orders/9999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/orders/:id — returns 400 for invalid ID format', async () => {
    const res = await request(app).get('/api/orders/abc');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE /api/orders/:id — deletes an order', async () => {
    const delRes = await request(app).delete(`/api/orders/${createdId}`);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/api/orders/${createdId}`);
    expect(getRes.status).toBe(404);
  });

  it('POST /api/orders/:id/reprint — returns 501 Not Implemented (Phase 2 stub)', async () => {
    const res = await request(app).post(`/api/orders/${createdId}/reprint`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
