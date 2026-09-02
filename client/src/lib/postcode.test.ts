import { describe, expect, it } from "vitest";
import { isValidUkPostcode, normalisePostcode } from "./postcode";

describe("postcode", () => {
  it.each([
    ["ng98dq", "NG9 8DQ"],
    ["W1A1HQ", "W1A 1HQ"],
    ["gir0aa", "GIR 0AA"],
  ])("normalises and accepts %s", (input, expected) => {
    expect(normalisePostcode(input)).toBe(expected);
    expect(isValidUkPostcode(input)).toBe(true);
  });

  it.each(["ZZ1 1ZZ", "NG9 8D", "NOT A POSTCODE", "EC1Z 1AA"])("rejects %s", (postcode) => {
    expect(isValidUkPostcode(postcode)).toBe(false);
  });
});
