import { z } from "zod";
z.setErrorMap((issue) => {
  if (issue.code === "invalid_type")
    return {
      message:
        issue.received === "undefined"
          ? "Обов’язкове поле"
          : "Неправильний тип даних",
    };
  if (issue.code === "too_small")
    return {
      message: `Мінімальна кількість символів або елементів: ${issue.minimum}`,
    };
  if (issue.code === "too_big")
    return {
      message: `Максимальна кількість символів або елементів: ${issue.maximum}`,
    };
  if (issue.code === "invalid_string")
    return {
      message:
        issue.validation === "url"
          ? "Вкажіть коректну адресу зображення"
          : "Некоректний формат значення",
    };
  return { message: "Некоректне значення" };
});
const text = z.string().trim().min(1).max(4000);
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const list = z.array(text).min(1).max(30);
// Accept an external HTTPS address or a root-relative file served from the Worker assets.
const image = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (v) =>
      v.startsWith("/")
        ? /^\/[a-zA-Z0-9/._-]+$/.test(v) && !v.includes("..")
        : /^https:\/\//.test(v) && z.string().url().safeParse(v).success,
    "Вкажіть HTTPS-адресу або локальний шлях виду /images/файл.webp",
  );
export const brandSchema = z.object({ id, name: text, description: text });
export const lineSchema = z.object({
  id,
  brand_id: id,
  name: text,
  short_description: text,
  description: text,
  hair_types: list,
  purposes: list,
  benefits: list,
  keywords: list,
  image: image.optional(),
});
export const productSchema = z.object({
  id,
  brand_id: id,
  line_id: id,
  name: text,
  category: text,
  description: text,
  hair_types: list,
  purpose: text,
  benefits: list,
  ingredients: list,
  image: image.optional(),
  usage: text.optional(),
});
export const catalogSchema = z
  .object({
    brands: z.array(brandSchema).max(100),
    lines: z.array(lineSchema).max(300),
    products: z.array(productSchema).max(1000),
  })
  .superRefine((c, ctx) => {
    for (const key of ["brands", "lines", "products"] as const) {
      const ids = new Set<string>();
      c[key].forEach((v, i) => {
        if (ids.has(v.id))
          ctx.addIssue({
            code: "custom",
            path: [key, i, "id"],
            message: "ID повторюється",
          });
        ids.add(v.id);
      });
    }
    c.lines.forEach((l, i) => {
      if (!c.brands.some((b) => b.id === l.brand_id))
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "brand_id"],
          message: "Бренд не знайдено",
        });
    });
    c.products.forEach((p, i) => {
      if (!c.lines.some((l) => l.id === p.line_id && l.brand_id === p.brand_id))
        ctx.addIssue({
          code: "custom",
          path: ["products", i, "line_id"],
          message: "Лінійка має існувати та належати бренду продукту",
        });
    });
  });
export type Brand = z.infer<typeof brandSchema>;
export type Line = z.infer<typeof lineSchema>;
export type Product = z.infer<typeof productSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type EntityType = "brand" | "line" | "product";
export interface Progress {
  entity_type: EntityType;
  entity_id: string;
  correct_answers: number;
  incorrect_answers: number;
  mastery_score: number;
  last_reviewed_at: string;
  next_review_at: string;
}
export interface History {
  id: string;
  session_id: string;
  question_id: string;
  product_id: string | null;
  line_id: string;
  selected_answer: string;
  correct_answer: string;
  correct: number;
  xp: number;
  created_at: string;
}
export interface Stats {
  progress: Progress[];
  history: History[];
  xp: number;
  streak: number;
}
