/**
 * client/src/constants/delivery.ts
 *
 * Delivery charge constants and helpers extracted from the old system.
 * These values are intentionally simple so they can be unit tested and config-driven later.
 */

export const DELIVERY_BASE_CHARGE = 2.0;
export const DELIVERY_DISTANCE_THRESHOLD_MILES = 2;
export const DELIVERY_RATE_PER_MILE_OVER_THRESHOLD = 0.5;

export function calculateDeliveryCharge(distanceInMiles?: number | null): number {
  if (!distanceInMiles || distanceInMiles <= DELIVERY_DISTANCE_THRESHOLD_MILES) {
    return DELIVERY_BASE_CHARGE;
  }

  const milesOverThreshold = Math.floor(distanceInMiles - DELIVERY_DISTANCE_THRESHOLD_MILES);

  return DELIVERY_BASE_CHARGE + milesOverThreshold * DELIVERY_RATE_PER_MILE_OVER_THRESHOLD;
}
