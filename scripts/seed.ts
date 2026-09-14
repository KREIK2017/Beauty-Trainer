import { readFileSync, writeFileSync } from "node:fs";
import { catalogSchema } from "../shared/schema";
import { catalogStatements } from "../worker/db/catalog";
const data = catalogSchema.parse(
  JSON.parse(readFileSync("data/products.json", "utf8")),
);
const sql: string[] = [];
const quote = (v: unknown) =>
  v === null
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${String(v).replaceAll("'", "''")}'`;
// Reuse the production import statements to keep JSON seeding and REST imports identical.
const db = {
  prepare: (query: string) => ({
    bind: (...values: unknown[]) => {
      let i = 0;
      sql.push(query.replace(/\?/g, () => quote(values[i++])) + ";");
      return {};
    },
  }),
} as unknown as D1Database;
catalogStatements(db, data);
writeFileSync("data/seed.sql", sql.join("\n"));
console.log(
  `Validated ${data.brands.length} brands, ${data.lines.length} lines, ${data.products.length} products.`,
);
