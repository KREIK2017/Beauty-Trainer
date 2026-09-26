const compact = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("uk-UA")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function repeatsMeaningfully(first: string, second: string) {
  const a = compact(first);
  const b = compact(second);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return shorter.length >= 24 && longer.includes(shorter);
}

export function productCopyWarnings(
  description: string,
  purpose: string,
  benefits: string[],
) {
  const warnings: string[] = [];
  if (repeatsMeaningfully(description, purpose))
    warnings.push(
      "Опис повторює призначення. В описі поясніть дію та результат, а в призначенні — коли рекомендувати продукт.",
    );
  if (benefits.some((benefit) => repeatsMeaningfully(purpose, benefit)))
    warnings.push(
      "Призначення повторює перевагу. Сформулюйте його як потребу клієнта або ситуацію застосування.",
    );
  return warnings;
}
