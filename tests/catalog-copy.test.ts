import { describe, expect, it } from "vitest";
import catalog from "../data/products.json";
import copy from "../data/insight-copy.json";

describe("reviewed Insight content", () => {
  it("covers all products and keeps usage instructions out of ingredients", () => {
    const products = catalog.products.filter((p) => p.brand_id === "insight");
    expect(products.map((p) => p.id).sort()).toEqual(
      Object.keys(copy.products).sort(),
    );
    for (const p of products) {
      expect(p.benefits).toEqual(
        copy.products[p.id as keyof typeof copy.products].benefits,
      );
      expect(p.ingredients.join(" ")).not.toMatch(
        /СПОСІБ|Нанесіть|Не змивати|тижнів/i,
      );
    }
    expect(products.filter((p) => "usage" in p && p.usage)).toHaveLength(9);
  });
});
