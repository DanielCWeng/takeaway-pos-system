/**
 * shared/haversine.js
 *
 * Provides a pure function to calculate the great-circle distance
 * between two lat/lng coordinate pairs on the Earth's surface.
 *
 * This is used to calculate delivery distance from the store to the customer.
 */

const EARTH_RADIUS_MILES = 3958.8;

/** Valid latitude range (WGS84) */
const LAT_RANGE = { min: -90, max: 90 };

/** Valid longitude range (WGS84) */
const LON_RANGE = { min: -180, max: 180 };

/**
 * Calculate the great-circle distance between two points, returned in miles.
 * Coordinates must be WGS84 decimal degrees.
 *
 * @param {number} lat1 - Latitude of point A  [-90, 90]
 * @param {number} lon1 - Longitude of point A [-180, 180]
 * @param {number} lat2 - Latitude of point B  [-90, 90]
 * @param {number} lon2 - Longitude of point B [-180, 180]
 * @returns {number} Distance in miles
 * @throws {TypeError}  If any argument is not a finite number
 * @throws {RangeError} If any coordinate falls outside its valid WGS84 range
 */
export function haversineInMiles(lat1, lon1, lat2, lon2) {
  // Type guard — catches null, undefined, NaN, non-numeric strings
  for (const [name, val] of [
    ['lat1', lat1],
    ['lon1', lon1],
    ['lat2', lat2],
    ['lon2', lon2],
  ]) {
    if (typeof val !== 'number' || !isFinite(val)) {
      throw new TypeError(`haversineInMiles: '${name}' must be a finite number, got ${val}`);
    }
  }

  // Range guard — out-of-range coords produce nonsensical distances silently
  if (lat1 < LAT_RANGE.min || lat1 > LAT_RANGE.max)
    throw new RangeError(`haversineInMiles: lat1 (${lat1}) out of range [-90, 90]`);
  if (lat2 < LAT_RANGE.min || lat2 > LAT_RANGE.max)
    throw new RangeError(`haversineInMiles: lat2 (${lat2}) out of range [-90, 90]`);
  if (lon1 < LON_RANGE.min || lon1 > LON_RANGE.max)
    throw new RangeError(`haversineInMiles: lon1 (${lon1}) out of range [-180, 180]`);
  if (lon2 < LON_RANGE.min || lon2 > LON_RANGE.max)
    throw new RangeError(`haversineInMiles: lon2 (${lon2}) out of range [-180, 180]`);

  if (lat1 === lat2 && lon1 === lon2) return 0;

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const dLat = radLat2 - radLat1;
  const dLon = toRad(lon2 - lon1);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const a = sinLat * sinLat + Math.cos(radLat1) * Math.cos(radLat2) * sinLon * sinLon;

  // Clamp a to [0, 1] to guard against floating-point overshoot near antipodal points,
  // which would otherwise cause Math.sqrt(1 - a) to return NaN.
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Convert decimal degrees to radians.
 *
 * @param {number} degrees
 * @returns {number}
 */
function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}
