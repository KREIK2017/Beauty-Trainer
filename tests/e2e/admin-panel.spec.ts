import { test, expect, ownerCredentials } from "./fixtures";
import { generateQuestions } from "../../shared/learning";
import type { Catalog } from "../../shared/schema";

test("owner sees accurate account progress without exposing credentials", async ({
  page,
  request,
  playwright,
}) => {
  const learner = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:8788",
  });
  try {
    const username = `panel-${Date.now()}`;
    const response = await learner.post("/api/auth/register", {
      data: { username, password: "Panel-password-12345" },
    });
    expect(response.ok()).toBe(true);
    const { user } = await response.json();
    for (const path of [
      "/api/admin/users",
      `/api/admin/users/${user.id}`,
      "/api/admin/settings",
    ])
      expect((await learner.get(path)).status()).toBe(403);
    expect(
      (
        await learner.patch("/api/admin/settings", {
          data: { registrationOpen: false },
        })
      ).status(),
    ).toBe(403);
    const catalog = (await (
      await learner.get("/api/catalog")
    ).json()) as Catalog;
    const session = await (
      await learner.post("/api/sessions", { data: {} })
    ).json();
    const question = generateQuestions(catalog, [], "all", session.id).find(
      (q) => q.productId,
    )!;
    expect(
      (
        await learner.post(`/api/sessions/${session.id}/answers`, {
          data: { questionId: question.id, answer: question.answer },
        })
      ).ok(),
    ).toBe(true);
    const list = await (
      await request.get(`/api/admin/users?search=${username}`)
    ).json();
    expect(list.total).toBe(1);
    expect(list.users[0]).toMatchObject({
      id: user.id,
      xp: 10,
      answers: 1,
      correct_answers: 1,
      sessions: 1,
      mastered_products: 0,
      weak_products: 1,
    });
    expect(list.users[0].last_login_at).toBeTruthy();
    expect(list.users[0].last_practice_at).toBeTruthy();
    const detail = await (
      await request.get(`/api/admin/users/${user.id}`)
    ).json();
    expect(detail.progress).toHaveLength(3);
    expect(detail.recentAnswers).toHaveLength(1);
    for (const data of [list, detail])
      for (const field of ["password_hash", "salt", "token_hash"])
        expect(JSON.stringify(data)).not.toContain(`"${field}"`);
    expect(
      (await request.get("/api/admin/users/unknown-account")).status(),
    ).toBe(404);
    expect((await request.get("/api/admin/users?page=0")).status()).toBe(400);
    const empty = await (
      await request.get(`/api/admin/users?search=${username}&page=2`)
    ).json();
    expect(empty.users).toEqual([]);
    await page.goto("/admin/users");
    await page.getByLabel("Пошук за логіном").fill(username);
    await page.getByRole("button", { name: "Знайти", exact: true }).click();
    await expect(page.locator(".admin-user-card")).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/admin-users-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("link", { name: `Переглянути прогрес ${username}` })
      .click();
    await expect(
      page.getByRole("heading", { name: username, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".admin-history li")).toHaveCount(1);
    await page.context().clearCookies();
    await page.context().addCookies((await learner.storageState()).cookies);
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "Керування доступне лише власнику" }),
    ).toBeVisible();
  } finally {
    await learner.dispose();
  }
});

test("registration settings affect new accounts but preserve existing access", async ({
  page,
  request,
  playwright,
}) => {
  const original = await (await request.get("/api/admin/settings")).json();
  const visitor = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:8788",
  });
  const credentials = {
    username: `settings-${Date.now()}`,
    password: "Settings-password-12345",
  };
  try {
    expect(
      (await visitor.post("/api/auth/register", { data: credentials })).ok(),
    ).toBe(true);
    await visitor.post("/api/auth/logout");
    await page.goto("/admin/settings");
    await page
      .getByRole("checkbox", { name: "Дозволити самостійну реєстрацію" })
      .uncheck();
    await page.getByRole("button", { name: "Зберегти налаштування" }).click();
    await expect(
      page.getByText("Налаштування реєстрації збережено."),
    ).toBeVisible();
    expect(
      (await (await visitor.get("/api/auth/me")).json()).registrationOpen,
    ).toBe(false);
    expect(
      (
        await visitor.post("/api/auth/register", {
          data: { ...credentials, username: `${credentials.username}-new` },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await visitor.post("/api/auth/login", { data: credentials })).ok(),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/admin-settings-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.context().clearCookies();
    await page.goto("/");
    await expect(
      page.getByText(/Реєстрацію нових учасників тимчасово закрито/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Створити акаунт", exact: true }),
    ).toHaveCount(0);
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Реєстрацію тимчасово закрито" }),
    ).toBeVisible();
  } finally {
    expect(
      (
        await request.patch("/api/admin/settings", {
          data: { registrationOpen: original.registrationOpen },
        })
      ).ok(),
    ).toBe(true);
    await visitor.dispose();
  }
});

test("owner changes their password and old sessions are revoked", async ({
  page,
  request,
  playwright,
}) => {
  const oldSession = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:8788",
  });
  expect(
    (await oldSession.post("/api/auth/login", { data: ownerCredentials })).ok(),
  ).toBe(true);
  const newPassword = "New-owner-password-123456";
  let changed = false;
  try {
    expect(
      (
        await request.post("/api/auth/password", {
          data: { currentPassword: "Wrong-password-123456", newPassword },
        })
      ).status(),
    ).toBe(400);
    await page.goto("/admin/settings");
    await page
      .getByLabel("Поточний пароль", { exact: true })
      .fill(ownerCredentials.password);
    await page.getByLabel("Новий пароль", { exact: true }).fill(newPassword);
    await page
      .getByLabel("Повторіть новий пароль", { exact: true })
      .fill(newPassword);
    const saved = page.waitForResponse((r) =>
      r.url().endsWith("/api/auth/password"),
    );
    await page
      .getByRole("button", { name: "Змінити пароль", exact: true })
      .click();
    expect((await saved).ok()).toBe(true);
    changed = true;
    await expect(
      page.getByText("Пароль змінено. Попередні сесії завершено."),
    ).toBeVisible();
    expect((await page.request.get("/api/admin/settings")).ok()).toBe(true);
    expect((await oldSession.get("/api/progress")).status()).toBe(401);
    expect(
      (
        await oldSession.post("/api/auth/login", { data: ownerCredentials })
      ).status(),
    ).toBe(401);
    expect(
      (
        await oldSession.post("/api/auth/login", {
          data: { ...ownerCredentials, password: newPassword },
        })
      ).ok(),
    ).toBe(true);
  } finally {
    if (changed)
      expect(
        (
          await page.request.post("/api/auth/password", {
            data: {
              currentPassword: newPassword,
              newPassword: ownerCredentials.password,
            },
          })
        ).ok(),
      ).toBe(true);
    await oldSession.dispose();
  }
});
