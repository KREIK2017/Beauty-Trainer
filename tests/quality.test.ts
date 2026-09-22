import { describe, expect, it } from "vitest";
import type { Catalog, Product } from "../shared/schema";
import { catalogQuality } from "../shared/quality";

const complete = (id: string, lineId: string): Product => ({
  id,
  brand_id: "brand",
  line_id: lineId,
  name: id,
  category: "Шампунь",
  description: `Докладний унікальний опис продукту ${id}, його основної дії, способу використання та очікуваного результату для волосся після регулярного догляду.`,
  hair_types: ["Усі типи"],
  purpose: `Призначення ${id}`,
  benefits: ["Перевага"],
  ingredients: ["Активний компонент"],
  image: `/images/${id}.webp`,
  usage: "Нанести на волосся та змити.",
});

describe("catalog quality report", () => {
  it("finds missing fields, duplicate descriptions and line quiz limitations", () => {
    const catalog: Catalog = {
      brands: [{ id: "brand", name: "Brand", description: "Опис бренду" }],
      lines: [
        {
          id: "line-a",
          brand_id: "brand",
          name: "Line A",
          short_description: "Коротко",
          description: "Опис",
          hair_types: ["Усі типи"],
          purposes: ["Догляд"],
          benefits: ["Перевага"],
          keywords: ["догляд"],
        },
        {
          id: "line-b",
          brand_id: "brand",
          name: "Line B",
          short_description: "Коротко",
          description: "Опис",
          hair_types: ["Усі типи"],
          purposes: ["Догляд"],
          benefits: ["Перевага"],
          keywords: ["догляд"],
        },
      ],
      products: [
        {
          ...complete("one", "line-a"),
          description: "Однаковий короткий опис.",
          purpose: "Спільне призначення",
          image: undefined,
          usage: undefined,
        },
        {
          ...complete("two", "line-a"),
          description: "Однаковий короткий опис!",
          purpose: "Спільне призначення",
        },
        complete("three", "line-a"),
        complete("four", "line-b"),
      ],
    };

    const report = catalogQuality(catalog);
    expect(
      report.products.find((row) => row.product.id === "one")?.issues,
    ).toEqual([
      "missing-image",
      "missing-usage",
      "short-description",
      "duplicate-description",
    ]);
    expect(
      report.products.find((row) => row.product.id === "two")?.issues,
    ).toEqual(["short-description", "duplicate-description"]);
    expect(report.lines.find((row) => row.id === "line-a")?.issues).toEqual([
      "too-few-distinct-purposes",
    ]);
    expect(report.lines.find((row) => row.id === "line-b")?.issues).toEqual([
      "too-few-products",
    ]);
    expect(report.summary).toMatchObject({
      products: 4,
      completeProducts: 2,
      missingImage: 1,
      missingUsage: 1,
      weakDescription: 2,
      linesNeedWork: 2,
    });
  });
});
