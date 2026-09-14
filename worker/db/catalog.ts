import type { Catalog, Brand, Line, Product } from "../../shared/schema";
export async function getCatalog(db: D1Database): Promise<Catalog> {
  const [brands, lines, products, hair, benefits, ingredients] =
    await Promise.all([
      db.prepare("SELECT * FROM brands ORDER BY name").all<Brand>(),
      db
        .prepare("SELECT * FROM product_lines ORDER BY name")
        .all<Record<string, string>>(),
      db
        .prepare("SELECT * FROM products ORDER BY name")
        .all<Omit<Product, "hair_types" | "benefits" | "ingredients">>(),
      db
        .prepare(
          "SELECT ph.product_id, h.name FROM product_hair_types ph JOIN hair_types h ON h.id=ph.hair_type_id",
        )
        .all<{ product_id: string; name: string }>(),
      db
        .prepare("SELECT * FROM product_benefits ORDER BY position")
        .all<{ product_id: string; benefit: string }>(),
      db
        .prepare("SELECT * FROM product_ingredients ORDER BY position")
        .all<{ product_id: string; ingredient: string }>(),
    ]);
  return {
    brands: brands.results,
    lines: lines.results.map(
      (l) =>
        ({
          ...l,
          image: l.image ?? undefined,
          hair_types: JSON.parse(l.hair_types),
          purposes: JSON.parse(l.purposes),
          benefits: JSON.parse(l.benefits),
          keywords: JSON.parse(l.keywords),
        }) as Line,
    ),
    products: products.results.map((p) => ({
      ...p,
      image: p.image ?? undefined,
      usage: p.usage ?? undefined,
      hair_types: hair.results
        .filter((h) => h.product_id === p.id)
        .map((h) => h.name),
      benefits: benefits.results
        .filter((b) => b.product_id === p.id)
        .map((b) => b.benefit),
      ingredients: ingredients.results
        .filter((i) => i.product_id === p.id)
        .map((i) => i.ingredient),
    })),
  };
}
export function catalogStatements(
  db: D1Database,
  c: Catalog,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  type Value = string | number | null;
  function insert(
    table: string,
    columns: string[],
    rows: Value[][],
    conflict = "",
  ) {
    const chunkSize = Math.floor(100 / columns.length);
    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      const placeholders = chunk
        .map((row) => `(${row.map(() => "?").join(",")})`)
        .join(",");
      statements.push(
        db
          .prepare(
            `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders} ${conflict}`,
          )
          .bind(...chunk.flat()),
      );
    }
  }
  const upsert = (columns: string[]) =>
    `ON CONFLICT(id) DO UPDATE SET ${columns.map((k) => `${k}=excluded.${k}`).join(",")}`;
  insert(
    "brands",
    ["id", "name", "description"],
    c.brands.map((b) => [b.id, b.name, b.description]),
    upsert(["name", "description"]),
  );
  const lineColumns = [
    "id",
    "brand_id",
    "name",
    "short_description",
    "description",
    "hair_types",
    "purposes",
    "benefits",
    "keywords",
    "image",
  ];
  insert(
    "product_lines",
    lineColumns,
    c.lines.map((l) => [
      l.id,
      l.brand_id,
      l.name,
      l.short_description,
      l.description,
      JSON.stringify(l.hair_types),
      JSON.stringify(l.purposes),
      JSON.stringify(l.benefits),
      JSON.stringify(l.keywords),
      l.image ?? null,
    ]),
    upsert(lineColumns.slice(1)),
  );
  const productColumns = [
    "id",
    "brand_id",
    "line_id",
    "name",
    "category",
    "description",
    "purpose",
    "image",
    "usage",
  ];
  insert(
    "products",
    productColumns,
    c.products.map((p) => [
      p.id,
      p.brand_id,
      p.line_id,
      p.name,
      p.category,
      p.description,
      p.purpose,
      p.image ?? null,
      p.usage ?? null,
    ]),
    upsert(productColumns.slice(1)),
  );
  for (const table of [
    "product_hair_types",
    "product_benefits",
    "product_ingredients",
  ]) {
    for (let start = 0; start < c.products.length; start += 100) {
      const ids = c.products.slice(start, start + 100).map((p) => p.id);
      statements.push(
        db
          .prepare(
            `DELETE FROM ${table} WHERE product_id IN (${ids.map(() => "?").join(",")})`,
          )
          .bind(...ids),
      );
    }
  }
  const hairTypes = [...new Set(c.products.flatMap((p) => p.hair_types))];
  insert(
    "hair_types",
    ["id", "name"],
    hairTypes.map((name) => [name, name]),
    "ON CONFLICT DO NOTHING",
  );
  insert(
    "product_hair_types",
    ["product_id", "hair_type_id"],
    c.products.flatMap((p) =>
      [...new Set(p.hair_types)].map((name) => [p.id, name]),
    ),
  );
  insert(
    "product_benefits",
    ["product_id", "benefit", "position"],
    c.products.flatMap((p) =>
      [...new Set(p.benefits)].map((value, i) => [p.id, value, i]),
    ),
  );
  insert(
    "product_ingredients",
    ["product_id", "ingredient", "position"],
    c.products.flatMap((p) =>
      [...new Set(p.ingredients)].map((value, i) => [p.id, value, i]),
    ),
  );
  return statements;
}
