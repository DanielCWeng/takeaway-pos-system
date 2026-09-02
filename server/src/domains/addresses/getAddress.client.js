import { config } from "../../config/index.js";
import { logger } from "../../infrastructure/logger.js";
import { ExternalServiceError, NotFoundError } from "../../shared/errors.js";

const GETADDRESS_ORIGIN = "https://api.getaddress.io";
const TIMEOUT_MS = 5000;

export async function findByPostcode(postcode) {
  if (!config.address.apiKey) {
    throw new ExternalServiceError("Address lookup is not configured", { provider: "getAddress" });
  }

  const compact = postcode.replace(/\s+/g, "");
  const url = new URL(`/find/${encodeURIComponent(compact)}`, GETADDRESS_ORIGIN);
  url.searchParams.set("expand", "true");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { "api-key": config.address.apiKey },
      signal: controller.signal,
    });
    if (response.status === 404) throw new NotFoundError("Postcode not found", { postcode });
    if (!response.ok) {
      throw new ExternalServiceError("Address lookup provider is unavailable", {
        provider: "getAddress",
        status: response.status,
      });
    }

    const data = await response.json();
    if (
      !Array.isArray(data.addresses) ||
      data.addresses.length === 0 ||
      !Number.isFinite(data.latitude) ||
      !Number.isFinite(data.longitude) ||
      data.latitude < -90 ||
      data.latitude > 90 ||
      data.longitude < -180 ||
      data.longitude > 180
    ) {
      throw new ExternalServiceError("Address lookup provider returned an invalid response", {
        provider: "getAddress",
      });
    }

    const addresses = data.addresses
      .map((address) => ({
        line1: typeof address.line_1 === "string" ? address.line_1.trim() : "",
        line2: typeof address.line_2 === "string" ? address.line_2.trim() : "",
        town: typeof address.town_or_city === "string" ? address.town_or_city.trim() : "",
      }))
      .filter((address) => address.line1);
    if (addresses.length === 0) {
      throw new ExternalServiceError("Address lookup provider returned no usable addresses", {
        provider: "getAddress",
      });
    }
    return { addresses, latitude: data.latitude, longitude: data.longitude };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ExternalServiceError) throw error;
    const timedOut = error?.name === "AbortError";
    logger.warn("Address lookup request failed", {
      postcode,
      timedOut,
      error: error?.message ?? String(error),
    });
    throw new ExternalServiceError(
      timedOut ? "Address lookup timed out" : "Address lookup provider is unavailable",
      { provider: "getAddress" },
    );
  } finally {
    clearTimeout(timeout);
  }
}
