/**
 * shared/phones.js
 *
 * Phone normalization helpers used across CTI/customer flows.
 */

/**
 * Normalize UK-ish caller IDs into a canonical local-digit format.
 *
 * Examples:
 *  - +447911123456 -> 07911123456
 *  - 00447911123456 -> 07911123456
 *  - 447911123456 -> 07911123456
 *  - (0115) 123 4567 -> 01151234567
 *
 * UNKNOWN-* and ANON-* identifiers are preserved.
 *
 * @param {string} phone
 * @returns {string}
 */
export function normaliseUkPhone(phone) {
  if (!phone || typeof phone !== "string") return "";

  const trimmed = phone.trim();
  if (trimmed.startsWith("UNKNOWN-") || trimmed.startsWith("ANON-")) {
    return trimmed;
  }

  // Keep a leading + for country-code handling, strip everything else non-numeric.
  const cleaned = trimmed
    .replace(/(?!^\+)[^\d]/g, "")
    .replace(/^\++/, "+")
    .replace(/^00(?=[1-9])/, "+");

  if (!cleaned) return "";

  const withoutPlus = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  const digitsOnly = withoutPlus.replace(/\D/g, "");
  if (!digitsOnly) return "";

  // Convert common UK international forms to local 0-prefix form.
  if (digitsOnly.startsWith("44")) {
    const national = digitsOnly.slice(2);
    if (!national) return "";
    if (national.startsWith("0")) return national;
    return `0${national}`;
  }

  return digitsOnly;
}
