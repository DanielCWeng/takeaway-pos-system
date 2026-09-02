const UK_POSTCODE_RE =
  /^(?:GIR 0AA|(?:[A-PR-UWYZ]\d[\dA-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y]\d[\dABEHMNPRVWXY]?) \d[ABD-HJLNP-UW-Z]{2})$/;

export function normalisePostcode(postcode: string): string {
  const compact = postcode.trim().toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidUkPostcode(postcode: string): boolean {
  return UK_POSTCODE_RE.test(normalisePostcode(postcode));
}
