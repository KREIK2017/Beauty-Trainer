import { anyAnswer, answerInBrowser } from "./quiz-helpers";
import { test, expect } from "./fixtures";
import { generateQuestions, type Question } from "../../shared/learning";
import type { Catalog, Stats } from "../../shared/schema";

test("line training creates a scoped session and saves an answer", async ({
  page,
  request,
}) => {
  await page.goto("/lines/curl-passion");
  await page.getByRole("link", { name: "Пройти тест лінійки" }).click();
  await expect(page).toHaveURL(/training\?line=curl-passion$/);
  await expect(
    page.getByRole("heading", { name: "Тест лінійки Curl Passion" }),
  ).toBeVisible();
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/sessions") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  const response = await responsePromise;
  expect(response.request().postDataJSON()).toMatchObject({
    lineId: "curl-passion",
  });
  expect(response.ok()).toBe(true);
  const session = await response.json();
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  // Progress can change ordering, but all questions must belong to this series.
  const products = new Set(
    catalog.products
      .filter((p) => p.line_id === "curl-passion")
      .map((p) => p.id),
  );
  expect(session.questions.length).toBeGreaterThan(0);
  for (const q of session.questions) {
    expect(q.answer).toBeUndefined();
    expect(
      products.has(q.id.split(":")[0]) || q.id.startsWith("curl-passion:"),
    ).toBe(true);
  }
  const answerPromise = page.waitForResponse((r) =>
    r.url().endsWith("/answers"),
  );
  await answerInBrowser(
    page,
    session.questions[0],
    anyAnswer(session.questions[0]),
  );
  const feedback = await (await answerPromise).json();
  expect(feedback.lineId).toBe("curl-passion");
  await expect(page.locator(".feedback")).toBeVisible();
  await page.getByRole("link", { name: "Тренування", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Розпочати навчання" }),
  ).toBeVisible();
  await expect(page.locator(".feedback")).toHaveCount(0);
});

test("unknown line never starts a general session", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/sessions", {
    data: { lineId: "missing-line" },
  });
  expect(response.status()).toBe(404);
  await page.goto("/training?line=missing-line");
  await expect(
    page.getByRole("heading", { name: "Лінійку не знайдено" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Розпочати навчання" }),
  ).toHaveCount(0);
});

test("line path separately tracks cards and a passed normal test", async ({
  page,
  request,
}) => {
  const lineId = "curl-passion";
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const products = catalog.products.filter(
    (product) => product.line_id === lineId,
  );
  for (const product of products) {
    const response = await request.post("/api/flashcards/rate", {
      data: { productId: product.id, rating: "good" },
    });
    expect(response.ok()).toBe(true);
  }

  const before = (await (await request.get("/api/progress")).json()) as Stats;
  const created = await request.post("/api/sessions", {
    data: { mode: "all", difficulty: "normal", lineId },
  });
  expect(created.ok()).toBe(true);
  const session = (await created.json()) as {
    id: string;
    questions: Question[];
  };
  const answers = new Map(
    generateQuestions(
      catalog,
      before.progress,
      "all",
      session.id,
      new Date(),
      lineId,
      "normal",
    ).map((question) => [question.id, question.answer]),
  );
  for (const question of session.questions) {
    const response = await request.post(`/api/sessions/${session.id}/answers`, {
      data: { questionId: question.id, answer: answers.get(question.id) },
    });
    expect(response.ok()).toBe(true);
    expect((await response.json()).correct).toBe(true);
  }

  const after = (await (await request.get("/api/progress")).json()) as Stats;
  expect(
    products.every((product) =>
      after.flashcardReviews.some((review) => review.product_id === product.id),
    ),
  ).toBe(true);
  expect(after.lineTestCompletions).toContainEqual(
    expect.objectContaining({ line_id: lineId, difficulty: "normal" }),
  );
  expect(after.lineTestCompletions).not.toContainEqual(
    expect.objectContaining({ line_id: lineId, difficulty: "hard" }),
  );

  await page.goto(`/lines/${lineId}`);
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await expect(
    page.getByText(`${products.length} із ${products.length} продуктів`),
  ).toBeVisible();
  await page.getByRole("link", { name: "Скласти складний тест" }).click();
  await expect(page).toHaveURL(
    new RegExp(`training\\?line=${lineId}&difficulty=hard`),
  );
  await expect(page.getByRole("radio", { name: /Складний/ })).toBeChecked();
});
