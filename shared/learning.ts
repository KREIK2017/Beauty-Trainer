import type { Catalog, Progress, EntityType } from "./schema";
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
): Question[] {
  const pool: Question[] = [];
  // Hash each candidate once; recomputing inside a comparator dominates large catalogs.
  const shuffle = (values: string[], salt: string) =>
    values
      .map((value) => ({ value, key: hash(salt + value) }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.value);
  const add = (q: Omit<Question, "options">, distractors: string[]) => {
    const other = shuffle(
      [...new Set(distractors)].filter((x) => x !== q.answer),
      seed,
    ).slice(0, 3);
    if (!other.length) return;
    pool.push({ ...q, options: shuffle([q.answer, ...other], seed + q.id) });
  };
  c.lines.forEach((l) => {
    const base = {
      brandId: l.brand_id,
      lineId: l.id,
      explanation: `${l.name}: ${l.description}`,
    };
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
  c.products.forEach((p) => {
    const line = c.lines.find((l) => l.id === p.line_id)!;
    const base = {
      brandId: p.brand_id,
      lineId: p.line_id,
      productId: p.id,
      explanation: `${p.name} належить до лінійки ${line.name}. ${p.description} Основне призначення: ${p.purpose}.`,
    };
    add(
      {
        ...base,
        id: `${p.id}:C`,
        type: "Розпізнавання продукту",
        prompt: `Який продукт лінійки ${line.name} відповідає потребі «${p.purpose.toLowerCase()}»?`,
        answer: p.name,
      },
      c.products.filter((x) => x.purpose !== p.purpose).map((x) => x.name),
    );
    add(
      {
        ...base,
        id: `${p.id}:D`,
        type: "Розпізнавання переваг",
        prompt: `Яка перевага характерна для ${p.name}?`,
        answer: p.benefits[0],
      },
      c.products
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
      c.products.map((x) => x.purpose),
    );
    add(
      {
        ...base,
        id: `${p.id}:F`,
        type: "Клієнтська ситуація",
        prompt: `Клієнт шукає засіб для потреби «${p.purpose.toLowerCase()}». Тип волосся: ${p.hair_types.join(" / ").toLowerCase()}. Який продукт ви порекомендуєте?`,
        answer: p.name,
      },
      c.products.filter((x) => x.purpose !== p.purpose).map((x) => x.name),
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
  const eligible = pool.filter((q) => mode !== "weak" || ranks.get(q)! <= 2);
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
