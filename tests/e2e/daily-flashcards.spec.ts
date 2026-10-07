import { test, expect } from "./fixtures";
import type { PublicQuestion } from "../../shared/learning";
import type { Catalog, Stats } from "../../shared/schema";

test("dashboard starts a seven-question daily training", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Тренування на сьогодні" }).click();
  await expect(page).toHaveURL(/training\?mode=daily$/);
  await expect(
    page.getByRole("heading", { name: "Ваше тренування на сьогодні" }),
  ).toBeVisible();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/sessions") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  const response = await responsePromise;
  expect(response.request().postDataJSON()).toMatchObject({ mode: "daily" });
  const session = (await response.json()) as {
    questions: PublicQuestion[];
  };
  expect(session.questions).toHaveLength(7);
  await expect(page.getByText("1 / 7", { exact: true })).toBeVisible();
});

test("flashcard confidence is saved without awarding XP", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const line = catalog.lines.find((item) =>
    catalog.products.some((product) => product.line_id === item.id),
  )!;
  const product = catalog.products.find((item) => item.line_id === line.id)!;
  const before = (await (await request.get("/api/progress")).json()) as Stats;
  await page.goto(`/lines/${line.id}/cards`);
  await page.getByRole("button", { name: "Відкрити відповідь" }).click();
  const savePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/flashcards/rate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Знаю", exact: true }).click();
  expect((await savePromise).ok()).toBe(true);
  await expect(page.getByText("Картка 2 із", { exact: false })).toBeVisible();

  const after = (await (await request.get("/api/progress")).json()) as Stats;
  const previous = before.progress.find(
    (item) => item.entity_type === "product" && item.entity_id === product.id,
  );
  const saved = after.progress.find(
    (item) => item.entity_type === "product" && item.entity_id === product.id,
  );
  expect(saved).toBeDefined();
  expect(saved!.correct_answers).toBe((previous?.correct_answers ?? 0) + 1);
  expect(saved!.mastery_score).toBe(
    Math.min(100, (previous?.mastery_score ?? 0) + 10),
  );
  expect(after.xp).toBe(before.xp);
  expect(after.history).toHaveLength(before.history.length);
});

test("flashcard endpoint rejects unknown products and ratings", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/flashcards/rate", {
        data: { productId: "missing-product", rating: "good" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/flashcards/rate", {
        data: { productId: "hq-beauty-daily-care-shampoo", rating: "perfect" },
      })
    ).status(),
  ).toBe(400);
});
