import { config } from "../../config/index.js";
import { haversineInMiles } from "../../shared/haversine.js";
import { ValidationError } from "../../shared/errors.js";
import * as repo from "./addresses.repo.js";
import * as getAddressClient from "./getAddress.client.js";

// BS 7666-style syntax validation. This rejects impossible area/sector letters
// while retaining the Royal Mail special case GIR 0AA.
const UK_POSTCODE_RE =
  /^(?:GIR 0AA|(?:[A-PR-UWYZ]\d[\dA-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y]\d[\dABEHMNPRV-Y]?) \d[ABD-HJLNP-UW-Z]{2})$/;

export function normalisePostcode(postcode) {
  if (typeof postcode !== "string") return "";
  const compact = postcode.trim().toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function validatePostcode(postcode) {
  const normalised = normalisePostcode(postcode);
  if (!UK_POSTCODE_RE.test(normalised)) {
    throw new ValidationError("Postcode must be a valid UK postcode", {
      field: "postcode",
      received: postcode,
    });
  }
  return normalised;
}

function hydrate(result) {
  const distance = Number(
    haversineInMiles(
      config.address.storeLatitude,
      config.address.storeLongitude,
      result.latitude,
      result.longitude,
    ).toFixed(2),
  );
  return result.addresses.map((address) => ({
    ...address,
    postcode: result.postcode,
    latitude: result.latitude,
    longitude: result.longitude,
    distance,
  }));
}

export async function lookupPostcode(postcode) {
  const normalised = validatePostcode(postcode);
  const cached = repo.findCached(normalised);
  if (cached) return { addresses: hydrate(cached) };

  const providerResult = await getAddressClient.findByPostcode(normalised);
  const cacheRecord = { postcode: normalised, ...providerResult };
  repo.saveCached(cacheRecord);
  return { addresses: hydrate(cacheRecord) };
}
