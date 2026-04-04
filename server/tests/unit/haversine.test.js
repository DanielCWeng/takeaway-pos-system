import { describe, it, expect } from "vitest";
import { haversineInMiles } from "../../src/shared/haversine.js";

describe("Haversine Utility", () => {
  it("returns 0 for the same coordinates", () => {
    const lat = 52.9074;
    const lon = -1.2278;
    expect(haversineInMiles(lat, lon, lat, lon)).toBe(0);
  });

  it("calculates distance correctly between store and a known point", () => {
    // Store: NG9 8GF (Chilwell)
    const storeLat = 52.911;
    const storeLon = -1.226;

    // A point ~1 mile away
    const targetLat = 52.925;
    const targetLon = -1.226;

    const dist = haversineInMiles(storeLat, storeLon, targetLat, targetLon);
    // Calculated manually: roughly 0.966 miles
    expect(dist).toBeGreaterThan(0.9);
    expect(dist).toBeLessThan(1.0);
  });

  it("is symmetric", () => {
    const lat1 = 51.5074;
    const lon1 = 0.1278;
    const lat2 = 40.7128;
    const lon2 = -74.006;

    const d1 = haversineInMiles(lat1, lon1, lat2, lon2);
    const d2 = haversineInMiles(lat2, lon2, lat1, lon1);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it("throws RangeError for invalid latitude", () => {
    expect(() => haversineInMiles(91, 0, 0, 0)).toThrow(RangeError);
    expect(() => haversineInMiles(-91, 0, 0, 0)).toThrow(RangeError);
  });

  it("throws RangeError for invalid longitude", () => {
    expect(() => haversineInMiles(0, 181, 0, 0)).toThrow(RangeError);
    expect(() => haversineInMiles(0, -181, 0, 0)).toThrow(RangeError);
  });
});
