import { describe, it, expect } from "vitest";
import { PRIMARY_CATEGORIES, SECONDARY_CATEGORY_PAGES } from "../menu-categories";

describe("menu categories constants", () => {
  it("defines unique primary category names", () => {
    const names = PRIMARY_CATEGORIES.map((category) => category.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Chicken");
    expect(names).toContain("Rice");
  });

  it("keeps secondary pages navigable with Show All and paging controls", () => {
    for (const page of SECONDARY_CATEGORY_PAGES) {
      expect(page[0]?.en).toBe("Show All");
      expect(page.at(-2)?.en).toBe("<<");
      expect(page.at(-1)?.en).toBe(">>");
    }
  });
});

