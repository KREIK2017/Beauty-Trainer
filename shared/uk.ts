import { ZodError } from "zod";

export const fieldLabels: Record<string, string> = {
  id: "ID",
  name: "Назва",
  description: "Опис",
  brand_id: "Бренд",
  line_id: "Лінійка",
  short_description: "Короткий опис",
  hair_types: "Типи волосся",
  purposes: "Призначення",
  purpose: "Призначення",
  benefits: "Переваги",
  ingredients: "Складники",
  keywords: "Ключові слова",
  category: "Категорія",
  image: "Посилання на зображення",
  usage: "Спосіб застосування",
  brands: "Бренди",
  lines: "Лінійки",
  products: "Продукти",
  mode: "Режим",
  questionId: "Запитання",
  answer: "Відповідь",
};
export const entityLabels = {
  brand: "Бренд",
  line: "Лінійка",
  product: "Продукт",
};
export const weakHeadings = {
  brand: "Бренди для повторення",
  line: "Лінійки для повторення",
  product: "Продукти для повторення",
};
const plurals = new Intl.PluralRules("uk-UA");
export function counted(
  count: number,
  forms: [string, string, string],
): string {
  const category = plurals.select(count);
  return `${count.toLocaleString("uk-UA")} ${forms[category === "one" ? 0 : category === "few" ? 1 : 2]}`;
}
export function errorMessage(error: unknown): string {
  if (error instanceof ZodError)
    return error.issues
      .map(
        (issue) =>
          `${issue.path.map((p) => (typeof p === "number" ? p + 1 : (fieldLabels[p] ?? p))).join(" → ")}: ${issue.message}`,
      )
      .join("\n");
  if (error instanceof SyntaxError)
    return "Некоректний JSON. Перевірте лапки, коми та дужки.";
  return error instanceof Error
    ? error.message
    : "Сталася помилка. Спробуйте ще раз.";
}
