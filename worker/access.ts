import type { User } from "../shared/auth";
import type { Catalog } from "../shared/schema";
import type { LearningAccess } from "../shared/access";
import { getCatalog } from "./db/catalog";

export async function learningAccess(
  db: D1Database,
  user: User,
): Promise<LearningAccess & { revision: string }> {
  const row =
    user.role === "admin"
      ? null
      : await db
          .prepare("SELECT * FROM account_learning_access WHERE user_id=?")
          .bind(user.id)
          .first<{
            all_materials: number;
            brand_ids: string;
            line_ids: string;
            revision: string;
          }>();
  return row
    ? {
        allMaterials: !!row.all_materials,
        brandIds: JSON.parse(row.brand_ids),
        lineIds: JSON.parse(row.line_ids),
        revision: row.revision,
      }
    : { allMaterials: true, brandIds: [], lineIds: [], revision: "" };
}
export function filterCatalog(
  catalog: Catalog,
  access: LearningAccess,
): Catalog {
  if (access.allMaterials) return catalog;
  const lines = catalog.lines.filter(
    (line) =>
      access.brandIds.includes(line.brand_id) ||
      access.lineIds.includes(line.id),
  );
  const ids = new Set(lines.map((line) => line.id));
  return {
    brands: catalog.brands.filter(
      (brand) =>
        access.brandIds.includes(brand.id) ||
        lines.some((line) => line.brand_id === brand.id),
    ),
    lines,
    products: catalog.products.filter((product) => ids.has(product.line_id)),
  };
}
export async function learningCatalog(db: D1Database, user: User) {
  const access = await learningAccess(db, user);
  return { catalog: filterCatalog(await getCatalog(db), access), access };
}
