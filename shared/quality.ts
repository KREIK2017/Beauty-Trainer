import type { Catalog, Product } from "./schema";

export const DESCRIPTION_MIN_LENGTH = 80;

export type ProductQualityIssue =
  | "missing-image"
  | "missing-usage"
  | "short-description"
  | "duplicate-description";

export type LineQualityIssue = "too-few-products" | "too-few-distinct-purposes";

export const productIssueLabels: Record<ProductQualityIssue, string> = {
  "missing-image": "Немає фото",
  "missing-usage": "Немає застосування",
  "short-description": "Короткий опис",
  "duplicate-description": "Однаковий опис",
};

export const lineIssueLabels: Record<LineQualityIssue, string> = {
  "too-few-products": "Менше трьох продуктів",
  "too-few-distinct-purposes": "Недостатньо різних призначень",
};

export interface ProductQualityRow {
  product: Product;
  brandName: string;
  lineName: string;
  issues: ProductQualityIssue[];
}

export interface LineQualityRow {
  id: string;
  name: string;
  brandName: string;
  productCount: number;
  distinctPurposeCount: number;
  issues: LineQualityIssue[];
}

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function catalogQuality(catalog: Catalog) {
  const descriptionCounts = new Map<string, number>();
  for (const product of catalog.products) {
    const description = normalized(product.description);
    descriptionCounts.set(
      description,
      (descriptionCounts.get(description) ?? 0) + 1,
    );
  }

  const products: ProductQualityRow[] = catalog.products.map((product) => {
    const issues: ProductQualityIssue[] = [];
    if (!product.image) issues.push("missing-image");
    if (!product.usage) issues.push("missing-usage");
    if (product.description.trim().length < DESCRIPTION_MIN_LENGTH)
      issues.push("short-description");
    if ((descriptionCounts.get(normalized(product.description)) ?? 0) > 1)
      issues.push("duplicate-description");
    return {
      product,
      brandName:
        catalog.brands.find((brand) => brand.id === product.brand_id)?.name ??
        product.brand_id,
      lineName:
        catalog.lines.find((line) => line.id === product.line_id)?.name ??
        product.line_id,
      issues,
    };
  });

  const lines: LineQualityRow[] = catalog.lines.map((line) => {
    const lineProducts = catalog.products.filter(
      (product) => product.line_id === line.id,
    );
    const distinctPurposeCount = new Set(
      lineProducts.map((product) => normalized(product.purpose)),
    ).size;
    const issues: LineQualityIssue[] = [];
    if (lineProducts.length < 3) issues.push("too-few-products");
    if (lineProducts.length >= 3 && distinctPurposeCount < 3)
      issues.push("too-few-distinct-purposes");
    return {
      id: line.id,
      name: line.name,
      brandName:
        catalog.brands.find((brand) => brand.id === line.brand_id)?.name ??
        line.brand_id,
      productCount: lineProducts.length,
      distinctPurposeCount,
      issues,
    };
  });

  return {
    products,
    lines,
    summary: {
      products: products.length,
      completeProducts: products.filter((row) => !row.issues.length).length,
      missingImage: products.filter((row) =>
        row.issues.includes("missing-image"),
      ).length,
      missingUsage: products.filter((row) =>
        row.issues.includes("missing-usage"),
      ).length,
      weakDescription: products.filter((row) =>
        row.issues.some((issue) =>
          ["short-description", "duplicate-description"].includes(issue),
        ),
      ).length,
      linesNeedWork: lines.filter((row) => row.issues.length).length,
    },
  };
}
