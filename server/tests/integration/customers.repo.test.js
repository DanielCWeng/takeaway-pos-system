import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb, closeDb, runMigrations, getDb } from '../../src/infrastructure/db.js';
import * as repo from '../../src/domains/customers/customers.repo.js';

describe('Customers Repository (Integration)', () => {
  beforeAll(() => {
    openDb(':memory:');
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  const now = '2026-01-01T12:00:00.000Z';

  it('upserts a new customer with minimal fields', () => {
    const customer = repo.upsertCustomer({
      phone: '07911123456',
      firstCall: now,
      lastCall: now,
      callCount: 1,
    });

    expect(customer.phone).toBe('07911123456');
    expect(customer.name).toBeNull(); // Default null mapped correctly
    expect(customer.latitude).toBeNull();
    expect(customer.longitude).toBeNull();
    expect(customer.distance).toBeNull();
  });

  it('updates an existing customer via upsert', () => {
    const phone = '07911123456';

    const previous = repo.findByPhone(phone);
    expect(previous).not.toBeNull();

    const updated = repo.upsertCustomer({
      phone,
      name: 'Bob',
      latitude: 51.5074,
      longitude: -0.1278,
      distance: 1.5,
      firstCall: previous.firstCall,
      lastCall: '2026-01-02T12:00:00.000Z',
      callCount: 2,
    });

    expect(updated.name).toBe('Bob');
    expect(updated.latitude).toBe(51.5074);
    expect(updated.longitude).toBe(-0.1278);
    expect(updated.distance).toBe(1.5);
    expect(updated.callCount).toBe(2);

    // Verify raw storage
    const db = getDb();
    const rawRow = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
    expect(rawRow.latitude).toBe(51.5074);
    expect(rawRow.longitude).toBe(-0.1278);
    expect(rawRow.distance).toBe(1.5);
  });

  it('returns null when finding an unknown phone', () => {
    const fetched = repo.findByPhone('00000000000');
    expect(fetched).toBeNull();
  });

  it('increments call count atomically', () => {
    const phone = '01159000000';
    repo.upsertCustomer({ phone, firstCall: now, lastCall: now, callCount: 5 });

    repo.incrementCallCountAndReturn(phone);

    const fetched = repo.findByPhone(phone);
    expect(fetched.callCount).toBe(6);
    expect(fetched.lastCall).not.toBe(now); // Updated to current time internally
  });

  it('partially updates address fields (coalesce behaviour)', () => {
    const phone = '02070000000';
    repo.upsertCustomer({
      phone,
      name: 'Alice',
      postcode: 'W1A 1AA',
      houseNumber: '1',
      street: 'Oxford St',
      firstCall: now,
      lastCall: now,
      callCount: 1,
    });

    // Update only the house number — street and postcode should survive
    repo.updateAddress(phone, { houseNumber: '2' });

    const fetched = repo.findByPhone(phone);
    expect(fetched.name).toBe('Alice'); // Unchanged
    expect(fetched.postcode).toBe('W1A 1AA'); // Unchanged
    expect(fetched.street).toBe('Oxford St'); // Unchanged
    expect(fetched.houseNumber).toBe('2'); // Updated
    expect(fetched.latitude).toBeNull(); // Default survives
  });

  it('can explicitly clear a field with null', () => {
    const phone = '02080000000';
    repo.upsertCustomer({
      phone,
      name: 'Charlie',
      town: 'London',
      firstCall: now,
      lastCall: now,
      callCount: 1,
    });

    // Explicitly clear the town
    repo.updateAddress(phone, { town: null });

    const fetched = repo.findByPhone(phone);
    expect(fetched.name).toBe('Charlie'); // Unchanged
    expect(fetched.town).toBeNull(); // Cleared
  });

  describe('incrementCallCountAndReturn', () => {
    it('increments call count and returns updated customer', () => {
      const phone = '01159111222';
      repo.upsertCustomer({ phone, firstCall: now, lastCall: now, callCount: 1 });

      const updated = repo.incrementCallCountAndReturn(phone);

      expect(updated.phone).toBe(phone);
      expect(updated.callCount).toBe(2);
      expect(updated.lastCall).not.toBe(now);
    });

    it('returns null for unknown phone', () => {
      const result = repo.incrementCallCountAndReturn('99999999999');
      expect(result).toBeNull();
    });
  });
});
