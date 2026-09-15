import { test, expect } from "@playwright/test";
import { generateQuestions, type Question } from "../../shared/learning";
import type { Catalog, Stats } from "../../shared/schema";

test("three mistakes end the quiz, retries preserve lives, and restart resets them", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const stats = (await (await request.get("/api/progress")).json()) as Stats;
  await page.goto("/training");
  const created = page.waitForResponse((r) =>
    r.url().endsWith("/api/sessions"),
  );
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  const session = (await (await created).json()) as {
    id: string;
    questions: Question[];
  };
  const answers = new Map(
    generateQuestions(catalog, stats.progress, "all", session.id).map((q) => [
      q.id,
      q.answer,
    ]),
  );
  await expect(page.getByLabel("Життя: 3 із 3")).toBeVisible();
  await expect(page.locator(".lives-desktop svg")).toHaveCount(3);
  await expect(page.locator(".lives-desktop")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".lives-desktop")).toBeHidden();
  await expect(page.locator(".lives-mobile")).toBeVisible();
  await expect(page.locator(".lives-mobile")).toHaveText("3");
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/lives-mobile.png",
    fullPage: true,
  });
  for (let i = 0; i < 3; i++) {
    const q = session.questions[i];
    const wrong = q.options.find((o) => o !== answers.get(q.id))!;
    const saved = page.waitForResponse((r) => r.url().endsWith("/answers"));
    await page.locator(".answer").nth(q.options.indexOf(wrong)).click();
    expect((await saved).ok()).toBe(true);
    if (i < 2)
      await expect(page.getByLabel(`Життя: ${2 - i} із 3`)).toBeVisible();
    const retry = await request.post(`/api/sessions/${session.id}/answers`, {
      data: { questionId: q.id, answer: wrong },
    });
    expect(retry.ok()).toBe(true);
    if (i < 2) {
      await expect(page.locator(".feedback")).toBeVisible();
      await page
        .getByRole("button", {
          name: i === 2 ? "Переглянути результати" : "Наступне запитання",
        })
        .click();
    }
  }
  await expect(
    page.getByRole("heading", { name: "Життя закінчилися — тест не складено" }),
  ).toBeVisible();
  const blocked = await request.post(`/api/sessions/${session.id}/answers`, {
    data: {
      questionId: session.questions[3].id,
      answer: session.questions[3].options[0],
    },
  });
  expect(blocked.status()).toBe(409);
  const after = (await (await request.get("/api/progress")).json()) as Stats;
  expect(after.history.filter((h) => h.session_id === session.id)).toHaveLength(
    3,
  );
  await page.getByRole("button", { name: "Тренуватися ще" }).click();
  await expect(page.getByLabel("Життя: 3 із 3")).toBeVisible();
});

test("server-exhausted session opens its saved results instead of an error", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const stats = (await (await request.get("/api/progress")).json()) as Stats;
  await page.goto("/training");
  const created = page.waitForResponse((r) =>
    r.url().endsWith("/api/sessions"),
  );
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  const session = (await (await created).json()) as {
    id: string;
    questions: Question[];
  };
  const answers = new Map(
    generateQuestions(catalog, stats.progress, "all", session.id).map((q) => [
      q.id,
      q.answer,
    ]),
  );
  for (const q of session.questions.slice(1, 4)) {
    const r = await request.post(`/api/sessions/${session.id}/answers`, {
      data: {
        questionId: q.id,
        answer: q.options.find((o) => o !== answers.get(q.id))!,
      },
    });
    expect(r.ok()).toBe(true);
  }
  await page.locator(".answer").first().click();
  await expect(
    page.getByRole("heading", { name: "Життя закінчилися — тест не складено" }),
  ).toBeVisible();
  await expect(
    page.getByText("Відповідей: 3 із 10. Життя: 0 із 3."),
  ).toBeVisible();
  await expect(page.locator(".error")).toHaveCount(0);
  await expect(page.locator(".question-card")).toHaveCount(0);
});

test("simultaneous submissions cannot spend more than three lives", async ({
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const stats = (await (await request.get("/api/progress")).json()) as Stats;
  const session = (await (
    await request.post("/api/sessions", { data: { mode: "all" } })
  ).json()) as { id: string; questions: Question[] };
  const answers = new Map(
    generateQuestions(catalog, stats.progress, "all", session.id).map((q) => [
      q.id,
      q.answer,
    ]),
  );
  const submit = (q: Question) =>
    request.post(`/api/sessions/${session.id}/answers`, {
      data: {
        questionId: q.id,
        answer: q.options.find((o) => o !== answers.get(q.id))!,
      },
    });
  for (const q of session.questions.slice(0, 2))
    expect((await submit(q)).ok()).toBe(true);
  const responses = await Promise.all(
    session.questions.slice(2, 4).map(submit),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([200, 409]);
  const after = (await (await request.get("/api/progress")).json()) as Stats;
  expect(after.history.filter((h) => h.session_id === session.id)).toHaveLength(
    3,
  );
});

test("correct answers retain all lives and finish with a pass", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const stats = (await (await request.get("/api/progress")).json()) as Stats;
  await page.goto("/training");
  const created = page.waitForResponse((r) =>
    r.url().endsWith("/api/sessions"),
  );
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  const session = (await (await created).json()) as {
    id: string;
    questions: Question[];
  };
  const answers = new Map(
    generateQuestions(catalog, stats.progress, "all", session.id).map((q) => [
      q.id,
      q.answer,
    ]),
  );
  for (let i = 0; i < session.questions.length; i++) {
    await page
      .locator(".answer")
      .nth(
        session.questions[i].options.indexOf(
          answers.get(session.questions[i].id)!,
        ),
      )
      .click();
    await expect(page.locator(".feedback.success")).toBeVisible();
    await expect(page.getByLabel("Життя: 3 із 3")).toBeVisible();
    await page
      .getByRole("button", {
        name:
          i + 1 === session.questions.length
            ? "Переглянути результати"
            : "Наступне запитання",
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Тест складено!" }),
  ).toBeVisible();
});
