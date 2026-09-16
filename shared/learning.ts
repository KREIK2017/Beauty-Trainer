import type { Catalog, Progress, EntityType } from "./schema";
export const SESSION_LIVES = 3;
export type Difficulty = "normal" | "hard";
export interface Question {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  brandId: string;
  lineId: string;
  productId?: string;
  interaction?: "multiple" | "matching" | "reasoning";
  image?: string;
  items?: string[];
  reasons?: string[];
}
export type PublicQuestion = Pick<
  Question,
  | "id"
  | "type"
  | "prompt"
  | "options"
  | "interaction"
  | "image"
  | "items"
  | "reasons"
>;

// Complex answers remain strings in existing session/history storage.
export function normalizeAnswer(
  q: PublicQuestion,
  answer: string,
): string | undefined {
  if (!q.interaction) return q.options.includes(answer) ? answer : undefined;
  try {
    const values: unknown = JSON.parse(answer);
    if (
      !Array.isArray(values) ||
      !values.every((v): v is string => typeof v === "string")
    )
      return;
    if (q.interaction === "reasoning") {
      if (
        values.length === 2 &&
        q.options.includes(values[0]) &&
        q.reasons?.includes(values[1])
      )
        return JSON.stringify(values);
      return;
    }
    if (
      !values.length ||
      new Set(values).size !== values.length ||
      !values.every((v) => q.options.includes(v))
    )
      return;
    if (q.interaction === "matching")
      return values.length === q.items?.length
        ? JSON.stringify(values)
        : undefined;
    return JSON.stringify([...values].sort());
  } catch {
    return;
  }
}

export function formatAnswer(q: PublicQuestion, answer: string): string {
  if (!q.interaction) return answer;
  const normalized = normalizeAnswer(q, answer);
  if (!normalized) return answer;
  const values = JSON.parse(normalized) as string[];
  return values
    .map((v, i) => (q.interaction === "matching" ? `${q.items![i]} → ${v}` : v))
    .join("; ");
}
export function nextProgress(
  previous: Progress | undefined,
  correct: boolean,
  now = new Date(),
) {
  const mastery = Math.max(
    0,
    Math.min(100, (previous?.mastery_score ?? 0) + (correct ? 15 : -20)),
  );
  const days =
    mastery <= 20
      ? 0
      : mastery <= 40
        ? 1
        : mastery <= 60
          ? 3
          : mastery <= 80
            ? 7
            : mastery < 100
              ? 14
              : 30;
  return {
    correct_answers: (previous?.correct_answers ?? 0) + Number(correct),
    incorrect_answers: (previous?.incorrect_answers ?? 0) + Number(!correct),
    mastery_score: mastery,
    last_reviewed_at: now.toISOString(),
    next_review_at: new Date(
      now.getTime() + (correct ? days * 86400000 || 4 * 3600000 : 10 * 60000),
    ).toISOString(),
  };
}
export function mastery(progress: Progress[], type: EntityType, id: string) {
  return (
    progress.find((p) => p.entity_type === type && p.entity_id === id)
      ?.mastery_score ?? 0
  );
}
function hash(s: string) {
  let value = 2166136261;
  for (const char of s) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  return value >>> 0;
}
export function generateQuestions(
  c: Catalog,
  progress: Progress[],
  mode = "all",
  seed = "daily",
  now = new Date(),
  lineId?: string,
  difficulty: Difficulty = "normal",
): Question[] {
  const products = c.products.filter((p) => !lineId || p.line_id === lineId);
  const pool: Question[] = [];
  const hashCache = new Map<string, number>();
  const cachedHash = (value: string) => {
    let result = hashCache.get(value);
    if (result === undefined) {
      result = hash(value);
      hashCache.set(value, result);
    }
    return result;
  };
  // Hash each candidate once; recomputing inside a comparator dominates large catalogs.
  const shuffle = (values: string[], salt: string) =>
    values
      .map((value) => ({ value, key: cachedHash(salt + value) }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.value);
  // `ordered` keeps the caller's ranking of distractors instead of reshuffling it.
  const add = (
    q: Omit<Question, "options">,
    distractors: string[],
    ordered = false,
  ) => {
    if ((difficulty === "normal") !== /:[A-G]$/.test(q.id)) return;
    // Naming the selected line would reveal the answer to recognition questions.
    if (lineId && (q.id.endsWith(":A") || q.id.endsWith(":B"))) return;
    const candidates = [...new Set(distractors)].filter((x) => x !== q.answer);
    const other = (ordered ? candidates : shuffle(candidates, seed)).slice(
      0,
      3,
    );
    if (!other.length) return;
    pool.push({ ...q, options: shuffle([q.answer, ...other], seed + q.id) });
  };
  c.lines.forEach((l) => {
    if (lineId && l.id !== lineId) return;
    const base = {
      brandId: l.brand_id,
      lineId: l.id,
      explanation: `${l.name}: ${l.description}`,
    };
    const members = products.filter((p) => p.line_id === l.id);
    const distinct = members
      .filter(
        (p, i) =>
          members.findIndex(
            (x) => x.purpose === p.purpose || x.name === p.name,
          ) === i,
      )
      .slice(0, 3);
    if (difficulty === "hard" && distinct.length === 3) {
      const values = distinct.map((p) => p.purpose);
      pool.push({
        ...base,
        id: `${l.id}:pairs`,
        type: "Зіставлення пар",
        interaction: "matching",
        prompt: `Зіставте продукти ${l.name} з їхнім основним призначенням у каталозі.`,
        items: distinct.map((p) => p.name),
        options: shuffle(values, seed + l.id),
        answer: JSON.stringify(values),
        explanation: distinct.map((p) => `${p.name} — ${p.purpose}.`).join(" "),
      });
    }
    add(
      {
        ...base,
        id: `${l.id}:A`,
        type: "Розпізнавання лінійки",
        prompt: `Якій лінійці відповідає цей опис? ${l.short_description}`,
        answer: l.name,
      },
      c.lines
        .filter((x) => x.short_description !== l.short_description)
        .map((x) => x.name),
    );
    add(
      {
        ...base,
        id: `${l.id}:B`,
        type: "Тип волосся та призначення",
        prompt: `Оберіть лінійку. Тип волосся: ${l.hair_types.join(", ").toLowerCase()}. Потреби: ${l.purposes.join(", ").toLowerCase()}.`,
        answer: l.name,
      },
      c.lines
        .filter(
          (x) => JSON.stringify(x.purposes) !== JSON.stringify(l.purposes),
        )
        .map((x) => x.name),
    );
    const truth = hash(seed + l.id) % 2 === 0;
    const alternative = c.lines.find(
      (x) => !l.purposes.includes(x.purposes[0]),
    );
    if (truth || alternative)
      add(
        {
          ...base,
          id: `${l.id}:G`,
          type: "Правда чи неправда",
          prompt: `Призначення лінійки ${l.name}: ${truth ? l.purposes[0].toLowerCase() : alternative!.purposes[0].toLowerCase()}.`,
          answer: truth ? "Правда" : "Неправда",
        },
        ["Правда", "Неправда"],
      );
  });
  products.forEach((p) => {
    const line = c.lines.find((l) => l.id === p.line_id)!;
    const base = {
      brandId: p.brand_id,
      lineId: p.line_id,
      productId: p.id,
      explanation: `${p.name} належить до лінійки ${line.name}. ${p.description} Основне призначення: ${p.purpose}.`,
    };
    if (difficulty === "hard") {
      if (p.image) {
        // The bottle carries the line name and product names are prefixed with it,
        // so same-line products must be offered first; otherwise the label alone
        // identifies the answer without recognising the product.
        const photographed = products.filter((x) => x.image && x.id !== p.id);
        const byLine = (sameLine: boolean) =>
          shuffle(
            photographed
              .filter((x) => (x.line_id === p.line_id) === sameLine)
              .map((x) => x.name),
            seed + p.id,
          );
        add(
          {
            ...base,
            id: `${p.id}:photo`,
            type: "Впізнайте за фото",
            image: p.image,
            prompt: "Який продукт зображено на фото?",
            answer: p.name,
          },
          [...byLine(true), ...byLine(false)],
          true,
        );
      }
      if (p.usage)
        add(
          {
            ...base,
            id: `${p.id}:usage`,
            type: "Спосіб застосування",
            prompt: `Яка інструкція наведена в каталозі для ${p.name}?`,
            answer: p.usage,
            explanation: `${p.name}: ${p.usage}`,
          },
          products.flatMap((x) => (x.usage ? [x.usage] : [])),
        );

      const benefits = [...new Set(p.benefits)].slice(0, 2);
      const others = shuffle(
        [...new Set(products.flatMap((x) => x.benefits))].filter(
          (x) => !p.benefits.includes(x),
        ),
        seed,
      ).slice(0, 2);
      if (benefits.length === 2 && others.length === 2)
        pool.push({
          ...base,
          id: `${p.id}:multiple`,
          type: "Кілька правильних відповідей",
          interaction: "multiple",
          prompt: `Оберіть дві переваги, прямо зазначені в картці ${p.name}.`,
          options: shuffle([...benefits, ...others], seed + p.id),
          answer: JSON.stringify([...benefits].sort()),
          explanation: `У картці ${p.name} зазначено: ${benefits.join("; ")}. Інші варіанти не наведено в цій картці — це не твердження про відсутність таких властивостей.`,
        });
      const otherCategory = products.find(
        (x) => x.category !== p.category,
      )?.category;
      if (otherCategory)
        add(
          {
            ...base,
            id: `${p.id}:error`,
            type: "Знайдіть помилку",
            prompt: `Консультант описує ${p.name}. Яке твердження суперечить картці продукту?`,
            answer: `Категорія: ${otherCategory}`,
            explanation: `${p.name}: правильна категорія — ${p.category}. ${base.explanation}`,
          },
          [
            `Лінійка: ${line.name}`,
            `Призначення: ${p.purpose}`,
            `Перевага: ${p.benefits[0]}`,
          ],
        );
      const alternatives = shuffle(
        [
          ...new Set(
            products
              .filter((x) => x.purpose !== p.purpose && x.name !== p.name)
              .map((x) => x.name),
          ),
        ],
        seed,
      ).slice(0, 2);
      const reasons = shuffle(
        [...new Set(products.flatMap((x) => x.benefits))].filter(
          (x) => !p.benefits.includes(x),
        ),
        seed,
      ).slice(0, 2);
      if (alternatives.length && reasons.length)
        pool.push({
          ...base,
          id: `${p.id}:reason`,
          type: "Вибір із поясненням",
          interaction: "reasoning",
          prompt: `Потреба клієнта: «${p.purpose}». Оберіть продукт, а потім перевагу, прямо зазначену в його картці, щоб пояснити рекомендацію.`,
          options: shuffle([p.name, ...alternatives], seed + p.id),
          reasons: shuffle([p.benefits[0], ...reasons], seed + p.id + "reason"),
          answer: JSON.stringify([p.name, p.benefits[0]]),
          explanation: `${base.explanation} Перевага з картки: ${p.benefits[0]}.`,
        });
    }
    add(
      {
        ...base,
        id: `${p.id}:C`,
        type: "Розпізнавання продукту",
        prompt: `Який продукт лінійки ${line.name} відповідає потребі «${p.purpose.toLowerCase()}»?`,
        answer: p.name,
      },
      products.filter((x) => x.purpose !== p.purpose).map((x) => x.name),
    );
    add(
      {
        ...base,
        id: `${p.id}:D`,
        type: "Розпізнавання переваг",
        prompt: `Яка перевага характерна для ${p.name}?`,
        answer: p.benefits[0],
      },
      products
        .flatMap((x) => x.benefits)
        .filter((x) => !p.benefits.includes(x)),
    );
    add(
      {
        ...base,
        id: `${p.id}:E`,
        type: "Зворотне пригадування",
        prompt: `Яке основне призначення ${p.name}?`,
        answer: p.purpose,
      },
      products.map((x) => x.purpose),
    );
    add(
      {
        ...base,
        id: `${p.id}:F`,
        type: "Клієнтська ситуація",
        prompt: `Клієнт шукає засіб для потреби «${p.purpose.toLowerCase()}». Тип волосся: ${p.hair_types.join(" / ").toLowerCase()}. Який продукт ви порекомендуєте?`,
        answer: p.name,
      },
      products.filter((x) => x.purpose !== p.purpose).map((x) => x.name),
    );
  });
  const rank = (q: Question) => {
    const related = progress.filter(
      (p) =>
        (p.entity_type === "product" && p.entity_id === q.productId) ||
        (p.entity_type === "line" && p.entity_id === q.lineId),
    );
    if (related.some((p) => p.next_review_at <= now.toISOString())) return 0;
    if (
      related.some((p) => p.entity_type === "product" && p.mastery_score < 60)
    )
      return 1;
    if (related.some((p) => p.entity_type === "line" && p.mastery_score < 60))
      return 2;
    if (!related.length) return 3;
    return 4;
  };
  // Rank and hash stay constant for the whole call, so resolve them before sorting.
  const ranks = new Map(pool.map((q) => [q, rank(q)]));
  const order = new Map(pool.map((q) => [q, hash(seed + q.id)]));
  const eligible = pool.filter(
    (q) =>
      (difficulty === "normal"
        ? /:[A-G]$/.test(q.id)
        : !/:[A-G]$/.test(q.id)) &&
      (mode !== "weak" || ranks.get(q)! <= 2),
  );
  const selected: Question[] = [];
  const typeCounts = new Map<string, number>();
  const entityCounts = new Map<string, number>();
  // Preserve review priority, then balance formats and topics within each tier.
  while (eligible.length && selected.length < 10) {
    eligible.sort(
      (a, b) =>
        ranks.get(a)! - ranks.get(b)! ||
        (typeCounts.get(a.type) ?? 0) - (typeCounts.get(b.type) ?? 0) ||
        (entityCounts.get(a.productId ?? a.lineId) ?? 0) -
          (entityCounts.get(b.productId ?? b.lineId) ?? 0) ||
        order.get(a)! - order.get(b)!,
    );
    const q = eligible.shift()!;
    selected.push(q);
    typeCounts.set(q.type, (typeCounts.get(q.type) ?? 0) + 1);
    const key = q.productId ?? q.lineId;
    entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
  }
  return selected;
}
