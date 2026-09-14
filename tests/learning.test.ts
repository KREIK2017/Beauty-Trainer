import { describe, it, expect } from "vitest";
import { catalogSchema, type Progress } from "../shared/schema";
import { generateQuestions, nextProgress } from "../shared/learning";
import seed from "../data/products.json";
const catalog = catalogSchema.parse(seed);
describe("catalog validation", () => {
  it("validates seed and rejects missing parent references", () => {
    expect(catalog.products).toHaveLength(14);
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
  it("is deterministic, has unique questions and distinct valid options", () => {
    const first = generateQuestions(catalog, [], "all", "test");
    expect(first).toEqual(generateQuestions(catalog, [], "all", "test"));
    expect(first).toHaveLength(10);
    expect(new Set(first.map((q) => q.id)).size).toBe(10);
    for (const q of first) {
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.length).toBeGreaterThan(1);
    }
  });
  it("can generate all seven formats", () => {
    const types = new Set<string>();
    for (let i = 0; i < 50; i++)
      generateQuestions(catalog, [], "all", String(i)).forEach((q) =>
        types.add(q.type),
      );
    expect(types.size).toBe(7);
  });
  it("returns no weak-topic questions for a new learner and no questions for empty catalog", () => {
    expect(generateQuestions(catalog, [], "weak")).toEqual([]);
    expect(
      generateQuestions({ brands: [], lines: [], products: [] }, []),
    ).toEqual([]);
  });
  it("prioritizes overdue reviews", () => {
    const p: Progress = {
      entity_type: "product",
      entity_id: "thermo-protector",
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
