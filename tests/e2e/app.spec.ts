import { wrongAnswer, answerInBrowser } from "./quiz-helpers";
import type { PublicQuestion } from "../../shared/learning";
import { fieldLabels } from "../../shared/uk";
import { test, expect } from "./fixtures";
import { generateQuestions, nextProgress } from "../../shared/learning";
import type { Catalog, Stats } from "../../shared/schema";

test("dashboard, catalog, details, mobile layout, and persistent theme", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(
    page.getByRole("heading", {
      name: "Ваша впевненість починається зі знань.",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Каталог продуктів", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Пошук у каталозі" }).fill("Thermo");
  await expect(page.getByText("Знайдено продуктів: 1")).toBeVisible();
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: "Thermo Protector" }) })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ключові складники" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Lifestyling", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Продукти цієї лінійки" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Увімкнути темну тему" }).click();
  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Увімкнути світлу тему" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Ваша впевненість починається зі знань.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Відкрити або закрити меню" }).click();
  await page.getByRole("link", { name: "Мій прогрес", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Прогрес — запитання за запитанням." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("complete ten-question browser session with feedback and persisted progress", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const before = (await (await request.get("/api/progress")).json()) as Stats;
  await page.goto("/training");
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/sessions") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const session = (await response.json()) as {
    id: string;
    questions: PublicQuestion[];
  };
  const questions = generateQuestions(
    catalog,
    before.progress,
    "all",
    session.id,
  );
  expect(session.questions).toHaveLength(10);
  let xp = 0;
  for (let i = 0; i < session.questions.length; i++) {
    const q = session.questions[i];
    const generated = questions.find((x) => x.id === q.id)!;
    const answer =
      i === 0 ? wrongAnswer(q, generated.answer) : generated.answer;
    await answerInBrowser(page, q, answer);
    await expect(page.locator(".feedback")).toBeVisible();
    if (i !== 0) xp += 10;
    await page
      .getByRole("button", {
        name: i === 9 ? "Переглянути результати" : "Наступне запитання",
      })
      .click();
  }
  await expect(page.getByText("9 / 10", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Продукти для повторення" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/training-summary.png",
    fullPage: true,
  });
  const after = (await (await request.get("/api/progress")).json()) as Stats;
  expect(after.xp - before.xp).toBe(xp);
  expect(after.history.length - before.history.length).toBe(10);
  expect(after.streak).toBeGreaterThan(0);
  await page.goto("/weak");
  await expect(
    page.getByRole("heading", { name: "Продукти для повторення" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Повторити слабкі теми" }).click();
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  await expect(page.locator(".question-card")).toBeVisible();
});

test("admin forms create, edit, and cascade-delete a catalog hierarchy; invalid JSON is clear", async ({
  page,
  request,
}) => {
  const existing = (await (
    await request.get("/api/catalog")
  ).json()) as Catalog;
  for (const brand of existing.brands.filter((b) =>
    b.id.startsWith("browser-"),
  )) {
    await request.delete(`/api/brands/${brand.id}`);
  }
  const id = `browser-${Date.now()}`;
  await page.goto("/admin");
  await page.getByRole("button", { name: /^Бренди/ }).click();
  await page.getByRole("button", { name: "Додати бренд", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ID", { exact: true }).fill(id);
  await dialog.getByLabel("Назва", { exact: true }).fill("Browser test brand");
  await dialog
    .getByLabel("Опис", { exact: true })
    .fill("Temporary integration test");
  await dialog.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Редагувати Browser test brand" })
    .click();
  await dialog
    .getByLabel("Назва", { exact: true })
    .fill("Edited browser brand");
  await dialog.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(
    page.getByText("Edited browser brand", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Лінійки/ }).click();
  await page
    .getByRole("button", { name: "Додати лінійку", exact: true })
    .click();
  for (const [key, value] of Object.entries({
    id: `${id}-line`,
    name: "Browser line",
    "short description": "A distinct line",
    description: "Browser test line",
    "hair types": "Fine",
    purposes: "Testing purpose",
    benefits: "Testing benefit",
    keywords: "Test",
  }))
    await dialog
      .getByLabel(fieldLabels[key.replaceAll(" ", "_")], { exact: true })
      .fill(value);
  await dialog.getByLabel("Бренд", { exact: true }).selectOption(id);
  await dialog.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /^Продукти/ }).click();
  await page
    .getByRole("button", { name: "Додати продукт", exact: true })
    .click();
  for (const [key, value] of Object.entries({
    id: `${id}-product`,
    name: "Browser product",
    category: "Treatment",
    description: "Browser test product",
    "hair types": "Fine",
    purpose: "Testing purpose",
    benefits: "Testing benefit",
    ingredients: "Water",
  }))
    await dialog
      .getByLabel(fieldLabels[key.replaceAll(" ", "_")], { exact: true })
      .fill(value);
  await dialog.getByLabel("Бренд", { exact: true }).selectOption(id);
  await dialog
    .getByLabel("Лінійка", { exact: true })
    .selectOption(`${id}-line`);
  await dialog.getByRole("button", { name: "Зберегти зміни" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("textbox", { name: "Дані JSON для імпорту" })
    .fill('{"brands":[]}');
  await page.getByRole("button", { name: "Перевірити JSON" }).click();
  await expect(page.getByRole("alert")).toContainText("Обов’язкове поле");
  await page.getByRole("button", { name: /^Бренди/ }).click();
  await page
    .getByRole("button", { name: "Видалити Edited browser brand" })
    .click();
  await dialog.getByRole("button", { name: "Видалити", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  expect(catalog.brands.some((b) => b.id === id)).toBe(false);
  expect(catalog.lines.some((l) => l.id === `${id}-line`)).toBe(false);
  expect(catalog.products.some((p) => p.id === `${id}-product`)).toBe(false);
});

test("API rejects invalid import, preserves data, and makes answer retries idempotent", async ({
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const bad = await request.post("/api/import", {
    data: { brands: [], lines: [], products: [catalog.products[0]] },
  });
  expect(bad.status()).toBe(400);
  expect(await (await request.get("/api/catalog")).json()).toEqual(catalog);
  const before = (await (await request.get("/api/progress")).json()) as Stats;
  const session = (await (
    await request.post("/api/sessions", { data: { mode: "all" } })
  ).json()) as { id: string; questions: PublicQuestion[] };
  expect(session.questions[0]).not.toHaveProperty("answer");
  const q = generateQuestions(catalog, before.progress, "all", session.id)[0];
  const payload = { questionId: q.id, answer: q.answer };
  const responses = await Promise.all([
    request.post(`/api/sessions/${session.id}/answers`, { data: payload }),
    request.post(`/api/sessions/${session.id}/answers`, { data: payload }),
  ]);
  for (const r of responses) {
    expect(r.status()).toBe(200);
    expect((await r.json()).correct).toBe(true);
  }
  const replay = await request.post(`/api/sessions/${session.id}/answers`, {
    data: { questionId: q.id, answer: wrongAnswer(q, q.answer) },
  });
  expect((await replay.json()).correct).toBe(true);
  const after = (await (await request.get("/api/progress")).json()) as Stats;
  expect(after.xp - before.xp).toBe(10);
  expect(after.history.length - before.history.length).toBe(1);
  for (const [type, id] of [
    ["brand", q.brandId],
    ["line", q.lineId],
    ...(q.productId ? [["product", q.productId]] : []),
  ]) {
    const old = before.progress.find(
      (p) => p.entity_type === type && p.entity_id === id,
    );
    const updated = after.progress.find(
      (p) => p.entity_type === type && p.entity_id === id,
    )!;
    expect(updated.correct_answers - (old?.correct_answers ?? 0)).toBe(1);
    expect(updated.mastery_score).toBe(
      Math.min(100, (old?.mastery_score ?? 0) + 15),
    );
    const expected = nextProgress(
      old,
      true,
      new Date(updated.last_reviewed_at),
    );
    expect(updated.next_review_at).toBe(expected.next_review_at);
  }
  expect(
    (
      await request.post(`/api/sessions/${session.id}/answers`, {
        data: { questionId: q.id, answer: "invalid" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/sessions", {
        headers: { Origin: "https://unrelated.example" },
        data: { mode: "all" },
      })
    ).status(),
  ).toBe(403);
  const second = generateQuestions(
    catalog,
    before.progress,
    "all",
    session.id,
  )[1];
  const wrong = await request.post(`/api/sessions/${session.id}/answers`, {
    data: {
      questionId: second.id,
      answer: wrongAnswer(second, second.answer),
    },
  });
  expect((await wrong.json()).correct).toBe(false);
  const afterWrong = (await (
    await request.get("/api/progress")
  ).json()) as Stats;
  expect(afterWrong.xp).toBe(after.xp);
  const oldLine = after.progress.find(
    (p) => p.entity_type === "line" && p.entity_id === second.lineId,
  );
  const newLine = afterWrong.progress.find(
    (p) => p.entity_type === "line" && p.entity_id === second.lineId,
  )!;
  const expectedWrong = nextProgress(
    oldLine,
    false,
    new Date(newLine.last_reviewed_at),
  );
  expect(newLine.mastery_score).toBe(expectedWrong.mastery_score);
  expect(newLine.next_review_at).toBe(expectedWrong.next_review_at);
});

test("validated JSON upload round-trips arrays and updates existing IDs", async ({
  page,
  request,
}) => {
  const c = (await (await request.get("/api/catalog")).json()) as Catalog;
  const id = `import-${Date.now()}`;
  const brand = { ...c.brands[0], id, name: "Imported brand" };
  const line = { ...c.lines[0], id: `${id}-line`, brand_id: id };
  const product = {
    ...c.products[0],
    id: `${id}-product`,
    brand_id: id,
    line_id: line.id,
    ingredients: ["Water", "Glycerin"],
    benefits: ["Softness", "Shine"],
  };
  const imported = { brands: [brand], lines: [line], products: [product] };
  try {
    await page.goto("/admin");
    await page.locator("input[type=file]").setInputFiles({
      name: "products.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(imported)),
    });
    await expect(
      page.getByText("Готово: брендів — 1, лінійок — 1, продуктів — 1."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Імпортувати перевірені дані" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Імпортовано продуктів: 1.",
    );
    const saved = (await (await request.get("/api/catalog")).json()) as Catalog;
    expect(saved.products.find((p) => p.id === product.id)).toEqual(product);
    imported.products[0].benefits = ["Updated benefit"];
    expect(
      (await request.post("/api/import", { data: imported })).status(),
    ).toBe(200);
    const updated = (await (
      await request.get("/api/catalog")
    ).json()) as Catalog;
    expect(updated.products.filter((p) => p.id === product.id)).toHaveLength(1);
    expect(updated.products.find((p) => p.id === product.id)!.benefits).toEqual(
      ["Updated benefit"],
    );
    expect(
      (await request.post("/api/products", { data: product })).status(),
    ).toBe(409);
  } finally {
    await request.delete(`/api/brands/${id}`);
  }
});
