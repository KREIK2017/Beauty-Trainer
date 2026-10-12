import { readFileSync, writeFileSync } from "node:fs";
import { catalogSchema, type Catalog } from "../shared/schema";
import { catalogStatements } from "../worker/db/catalog";

const [, , output, ...inputs] = process.argv;
if (!output || !inputs.length) {
  throw new Error(
    "Usage: tsx scripts/catalog-update-to-sql.ts output.sql catalog-1.json [catalog-2.json]",
  );
}

const updates = inputs.map((path) =>
  catalogSchema.parse(JSON.parse(readFileSync(path, "utf8"))),
);
const catalog = catalogSchema.parse({
  brands: updates.flatMap((update) => update.brands),
  lines: updates.flatMap((update) => update.lines),
  products: updates.flatMap((update) => update.products),
} satisfies Catalog);

const sql: string[] = [];
const quote = (value: unknown) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
const db = {
  prepare: (query: string) => ({
    bind: (...values: unknown[]) => {
      let index = 0;
      sql.push(query.replace(/\?/g, () => quote(values[index++])) + ";");
      return {};
    },
  }),
} as unknown as D1Database;

catalogStatements(db, catalog);
writeFileSync(output, sql.join("\n") + "\n");
console.log(
  `Generated ${output}: ${catalog.brands.length} brands, ${catalog.lines.length} lines, ${catalog.products.length} products.`,
);
