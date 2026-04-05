import { describe, expect, it } from "vitest";
import { normaliseUkPhone } from "../../src/shared/phones.js";

describe("normaliseUkPhone", () => {
  it("canonicalises common UK international prefixes to 0-prefix local form", () => {
    expect(normaliseUkPhone("+447911123456")).toBe("07911123456");
    expect(normaliseUkPhone("00447911123456")).toBe("07911123456");
    expect(normaliseUkPhone("447911123456")).toBe("07911123456");
  });

  it("preserves UNKNOWN and ANON synthetic identifiers", () => {
    expect(normaliseUkPhone("UNKNOWN-abc")).toBe("UNKNOWN-abc");
    expect(normaliseUkPhone("ANON-123")).toBe("ANON-123");
  });

  it("does not collapse plain leading-zero values into '+' international form", () => {
    expect(normaliseUkPhone("00000000000")).toBe("00000000000");
  });
});
