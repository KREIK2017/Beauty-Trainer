import { describe, it, expect } from "vitest";
import { catalogSchema, type Progress } from "../shared/schema";
import {
  generateQuestions,
  nextProgress,
  normalizeAnswer,
  formatAnswer,
  type PublicQuestion,
} from "../shared/learning";
import seed from "../data/products.json";
const catalog = catalogSchema.parse(seed);
describe("compound answer validation", () => {
  const base: PublicQuestion = {
    id: "test",
    type: "test",
    prompt: "test",
    options: ["a", "b", "c"],
  };
  it("compares sets independent of order but rejects duplicates, invalid values and malformed JSON", () => {
    const q = { ...base, interaction: "multiple" as const };
    expect(normalizeAnswer(q, '["b","a"]')).toBe('["a","b"]');
    for (const invalid of ["[]", '["a","a"]', '["unknown"]', "[1]", "{}", "a"])
      expect(normalizeAnswer(q, invalid)).toBeUndefined();
    expect(normalizeAnswer(q, '["a"]')).not.toBe('["a","b"]');
  });
  it("requires complete unique matching, preserves order and formats history", () => {
    const q = {
      ...base,
      interaction: "matching" as const,
      items: ["first", "second", "third"],
    };
    expect(normalizeAnswer(q, '["b","a","c"]')).toBe('["b","a","c"]');
    expect(normalizeAnswer(q, '["a","b"]')).toBeUndefined();
    expect(normalizeAnswer(q, '["a","a","c"]')).toBeUndefined();
    expect(formatAnswer(q, '["b","a","c"]')).toBe(
      "first → b; second → a; third → c",
    );
  });
  it("requires a product and an allowed explanation, and keeps legacy answers compatible", () => {
    const q = {
      ...base,
      interaction: "reasoning" as const,
      reasons: ["reason"],
    };
    expect(normalizeAnswer(q, '["a","reason"]')).toBe('["a","reason"]');
    expect(normalizeAnswer(q, '["a"]')).toBeUndefined();
    expect(normalizeAnswer(q, '["a","b"]')).toBeUndefined();
    expect(normalizeAnswer(base, "a")).toBe("a");
  });
});
describe("catalog validation", () => {
  it("validates seed and rejects missing parent references", () => {
    // Structural, so adding brands to the seed does not need a test edit.
    expect(catalog.products.length).toBeGreaterThan(20);
    for (const p of catalog.products)
      expect(
        catalog.lines.some(
          (l) => l.id === p.line_id && l.brand_id === p.brand_id,
        ),
      ).toBe(true);
    expect(() => catalogSchema.parse({ ...seed, brands: [] })).toThrow();
  });
  it("rejects duplicate IDs and unsafe image URLs", () => {
    expect(() =>
      catalogSchema.parse({
        ...seed,
        brands: [...seed.brands, seed.brands[0]],
      }),
    ).toThrow();
    expect(() =>
      catalogSchema.parse({
        ...seed,
        products: [{ ...seed.products[0], image: "javascript:alert(1)" }],
      }),
    ).toThrow();
  });
});
describe("question generation", () => {
  it("keeps line sessions and product distractors within the selected line", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    for (const line of catalog.lines) {
      const products = catalog.products.filter((p) => p.line_id === line.id);
      const questions = generateQuestions(
        catalog,
        [],
        "all",
        "line-test",
        now,
        line.id,
      );
      expect(questions.length).toBeLessThanOrEqual(10);
      expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
      for (const q of questions) {
        expect(q.lineId).toBe(line.id);
        expect(normalizeAnswer(q, q.answer)).toBe(q.answer);
        expect(q.options.length).toBeGreaterThan(1);
        expect(q.id).not.toMatch(/:[AB]$/);
        if (q.productId)
          expect(products.some((p) => p.id === q.productId)).toBe(true);
        if (/:[CF]$/.test(q.id))
          expect(
            q.options.every((name) => products.some((p) => p.name === name)),
          ).toBe(true);
      }
    }
    expect(
      generateQuestions(catalog, [], "all", "line-test", now, "curl-passion"),
    ).toHaveLength(10);
    expect(
      generateQuestions(catalog, [], "weak", "line-test", now, "curl-passion"),
    ).toEqual([]);
    expect(
      generateQuestions(catalog, [], "all", "line-test", now, "missing-line"),
    ).toEqual([]);
  });
  it("is deterministic, has unique questions and distinct valid options", () => {
    const first = generateQuestions(catalog, [], "all", "test");
    expect(first).toEqual(generateQuestions(catalog, [], "all", "test"));
    expect(first).toHaveLength(10);
    expect(new Set(first.map((q) => q.id)).size).toBe(10);
    for (const q of first) {
      expect(normalizeAnswer(q, q.answer)).toBe(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.length).toBeGreaterThan(1);
    }
  });
  it("can generate all thirteen formats without ingredient questions", () => {
    const types = new Set<string>();
    for (let i = 0; i < 50; i++)
      generateQuestions(catalog, [], "all", String(i)).forEach((q) =>
        types.add(q.type),
      );
    expect(types.size).toBe(13);
    expect([...types].some((t) => /складник/i.test(t))).toBe(false);
  }, 15000);
  it("returns no weak-topic questions for a new learner and no questions for empty catalog", () => {
    expect(generateQuestions(catalog, [], "weak")).toEqual([]);
    expect(
      generateQuestions({ brands: [], lines: [], products: [] }, []),
    ).toEqual([]);
  });
  it("prioritizes overdue reviews", () => {
    const p: Progress = {
      entity_type: "product",
      entity_id: "lifestyling-thermo-protector",
      correct_answers: 1,
      incorrect_answers: 2,
      mastery_score: 0,
      last_reviewed_at: "2025-01-01T00:00:00Z",
      next_review_at: "2025-01-02T00:00:00Z",
    };
    expect(generateQuestions(catalog, [p], "all", "fixed")[0].productId).toBe(
      p.entity_id,
    );
  });
});
describe("spaced repetition", () => {
  const now = new Date("2026-09-14T12:00:00Z");
  it("schedules wrong answers in ten minutes and floors mastery", () => {
    const next = nextProgress(undefined, false, now);
    expect(next.mastery_score).toBe(0);
    expect(next.next_review_at).toBe("2026-09-14T12:10:00.000Z");
    expect(next.incorrect_answers).toBe(1);
  });
  it("increases intervals and caps mastery", () => {
    const p = {
      mastery_score: 90,
      correct_answers: 6,
      incorrect_answers: 0,
    } as Progress;
    expect(nextProgress(p, true, now).mastery_score).toBe(100);
    expect(nextProgress(p, true, now).next_review_at).toBe(
      "2026-10-14T12:00:00.000Z",
    );
  });
});
