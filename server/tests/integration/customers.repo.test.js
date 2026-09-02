import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, openDb, runMigrations } from "../../src/infrastructure/db.js";
import * as repo from "../../src/domains/customers/customers.repo.js";

describe("customers repository", () => {
  beforeAll(() => {
    openDb(":memory:");
    runMigrations();
  });

  afterAll(() => closeDb());

  it("stores customer identity without address columns", () => {
    const customer = repo.upsertCustomer({
      phone: "07911123456",
      name: "Alice",
      firstCall: "2026-01-01T12:00:00.000Z",
      lastCall: "2026-01-01T12:00:00.000Z",
      callCount: 1,
    });
    expect(customer).toEqual({
      phone: "07911123456",
      name: "Alice",
      firstCall: "2026-01-01T12:00:00.000Z",
      lastCall: "2026-01-01T12:00:00.000Z",
      callCount: 1,
    });
  });

  it("upserts confirmed history and increments usage without duplicating it", () => {
    const address = {
      line1: "10 Copeland Avenue",
      line2: "",
      town: "Nottingham",
      postcode: "NG9 8DQ",
      latitude: 52.91,
      longitude: -1.25,
    };
    repo.upsertCustomerAddress("07911123456", address);
    repo.upsertCustomerAddress("07911123456", address);

    const rows = repo.listAddressesByCustomer("07911123456");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...address, usageCount: 2 });
  });

  it("stores manual history with null coordinates", () => {
    repo.upsertCustomerAddress("07911123456", {
      line1: "1 Manual Road",
      line2: "",
      town: "Nottingham",
      postcode: "NG1 1AA",
    });
    const manual = repo
      .listAddressesByCustomer("07911123456")
      .find((row) => row.line1 === "1 Manual Road");
    expect(manual).toMatchObject({ latitude: null, longitude: null });
  });

  it("increments call count atomically", () => {
    const updated = repo.incrementCallCountAndReturn("07911123456");
    expect(updated.callCount).toBe(2);
    expect(repo.incrementCallCountAndReturn("00000000000")).toBeNull();
  });
});
