import { test, expect } from "@playwright/test";
import { generateQuestions, type PublicQuestion } from "../../shared/learning";
import type { Catalog, Stats } from "../../shared/schema";
import { answerInBrowser } from "./quiz-helpers";

test("normal is the default and hard is an independent server-validated mode", async ({
  page,
  request,
}) => {
  for (const difficulty of ["normal", "hard"] as const) {
    await page.goto("/training?line=elasti-curl");
    await expect(page.getByRole("radio", { name: /^Звичайний/ })).toBeChecked();
    if (difficulty === "hard")
      await page.getByRole("radio", { name: /^Складний/ }).check();
    if (difficulty === "hard")
      await page.screenshot({
        path: "test-results/difficulty-picker-desktop.png",
        fullPage: true,
      });
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/sessions") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Розпочати навчання" }).click();
    const response = await created;
    expect(response.request().postDataJSON()).toMatchObject({
      difficulty,
      lineId: "elasti-curl",
    });
    const session = (await response.json()) as { questions: PublicQuestion[] };
    expect(session.questions.length).toBeGreaterThan(0);
    expect(
      session.questions.every(
        (q) => /:[A-G]$/.test(q.id) === (difficulty === "normal"),
      ),
    ).toBe(true);
    await expect(page.getByLabel("Життя: 3 із 3")).toBeVisible();
  }
  expect(
    (
      await request.post("/api/sessions", { data: { difficulty: "invalid" } })
    ).status(),
  ).toBe(400);
  const legacy = (await (
    await request.post("/api/sessions", { data: { mode: "all" } })
  ).json()) as { questions: PublicQuestion[] };
  expect(legacy.questions.every((q) => /:[A-G]$/.test(q.id))).toBe(true);
});

test("compound questions validate on the server and remain usable on mobile", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const before = (await (await request.get("/api/progress")).json()) as Stats;
  // A line offers more formats than the ten slots in a session, so the three
  // compound ones do not always land together. Ask again instead of relying on
  // chance; answering nothing leaves the unused sessions empty.
  let session!: { id: string; questions: PublicQuestion[] };
  let questions: PublicQuestion[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    session = (await (
      await request.post("/api/sessions", {
        data: { lineId: "elasti-curl", difficulty: "hard" },
      })
    ).json()) as { id: string; questions: PublicQuestion[] };
    questions = session.questions.filter((q) => q.interaction);
    if (new Set(questions.map((q) => q.interaction)).size === 3) break;
  }
  expect(new Set(questions.map((q) => q.interaction)).size).toBe(3);
  const generated = generateQuestions(
    catalog,
    before.progress,
    "all",
    session.id,
    new Date(),
    "elasti-curl",
    "hard",
  );
  for (const q of session.questions) {
    expect(q).not.toHaveProperty("answer");
    expect(q).not.toHaveProperty("explanation");
  }
  // Present a real saved session in a focused order; grading still uses real D1.
  await page.route("**/api/sessions", (route) =>
    route.fulfill({ json: { id: session.id, questions } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/training?line=elasti-curl");
  await page.getByRole("radio", { name: /^Складний/ }).check();
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  for (const [i, q] of questions.entries()) {
    await expect(
      page.getByRole("button", { name: "Перевірити", exact: true }),
    ).toBeDisabled();
    const invalid = await request.post(`/api/sessions/${session.id}/answers`, {
      data: { questionId: q.id, answer: '["unknown"]' },
    });
    expect(invalid.status()).toBe(400);
    const correct = generated.find((x) => x.id === q.id)!.answer;
    if (q.interaction === "matching") {
      await expect(page.getByRole("combobox")).toHaveCount(0);
      await page.locator("[data-match-product]").nth(0).click();
      await page.locator("[data-match-option]").nth(0).click();
      await page.locator("[data-match-product]").nth(1).click();
      await page.locator("[data-match-option]").nth(0).click();
      await expect(page.locator("[data-match-product]").nth(0)).toContainText(
        "Пару ще не обрано",
      );
      await expect(
        page.getByText("Поєднано: 1 із 3", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Перевірити", exact: true }),
      ).toBeDisabled();
      const pending = (await (
        await request.get("/api/progress")
      ).json()) as Stats;
      expect(
        pending.history.filter((h) => h.session_id === session.id),
      ).toHaveLength(i);
      await page.getByRole("button", { name: "Скинути пари" }).click();
      await expect(
        page.getByText("Поєднано: 0 із 3", { exact: true }),
      ).toBeVisible();
    }
    const answer =
      q.interaction === "multiple"
        ? JSON.stringify((JSON.parse(correct) as string[]).reverse())
        : correct;
    await answerInBrowser(page, q, answer);
    await expect(page.locator(".feedback.success")).toBeVisible();
    await expect(page.getByLabel("Життя: 3 із 3")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/question-${q.interaction}-mobile.png`,
      fullPage: true,
    });
    const replay = await request.post(`/api/sessions/${session.id}/answers`, {
      data: { questionId: q.id, answer: correct },
    });
    expect((await replay.json()).correct).toBe(true);
    await page
      .getByRole("button", {
        name:
          i === questions.length - 1
            ? "Переглянути результати"
            : "Наступне запитання",
      })
      .click();
  }
  const after = (await (await request.get("/api/progress")).json()) as Stats;
  expect(after.history.filter((h) => h.session_id === session.id)).toHaveLength(
    questions.length,
  );
  expect(after.xp - before.xp).toBe(questions.length * 10);
});
