import { anyAnswer, answerInBrowser } from "./quiz-helpers";
import { test, expect } from "./fixtures";
import type { Catalog } from "../../shared/schema";

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
