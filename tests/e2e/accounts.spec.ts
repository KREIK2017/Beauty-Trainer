import { test, expect, ownerCredentials } from "./fixtures";
import { generateQuestions } from "../../shared/learning";
import type { Catalog, Stats } from "../../shared/schema";

test("setup validates login patterns and distinguishes an incorrect key", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.context().clearCookies();
  await page.goto("/setup");
  const login = page.getByLabel("Логін", { exact: true });
  await login.fill("bad!login");
  expect(
    await login.evaluate((el: HTMLInputElement) => el.validity.patternMismatch),
  ).toBe(true);
  await login.fill("Owner_test-21");
  expect(
    await login.evaluate((el: HTMLInputElement) => el.checkValidity()),
  ).toBe(true);
  expect(
    errors.filter((message) => /pattern|regular expression/i.test(message)),
  ).toEqual([]);
  const wrong = await request.post("/api/auth/setup", {
    data: { ...ownerCredentials, setupKey: "incorrect-key" },
  });
  expect(wrong.status()).toBe(403);
  expect((await wrong.json()).code).toBe("OWNER_SETUP_KEY_MISMATCH");
  const correct = await request.post("/api/auth/setup", {
    data: {
      ...ownerCredentials,
      setupKey: "  local-e2e-owner-key-not-for-production-123456\r\n",
    },
  });
  // The key passed validation; this isolated DB already has its owner.
  expect(correct.status()).toBe(409);
  expect((await correct.json()).error).toContain("вже створено");
});

test("mobile registration and expired sessions return to login", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Немає акаунта? Зареєструватися" })
    .click();
  await page.getByLabel("Логін", { exact: true }).fill(`mobile-${Date.now()}`);
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("Mobile-password-12345");
  await page
    .getByLabel("Повторіть пароль", { exact: true })
    .fill("Mobile-password-12345");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/register-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Створити акаунт", exact: true })
    .click();
  await expect(page.locator(".top-actions")).toContainText("0 XP");
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "Розпочати навчання" }),
  ).toBeVisible();
  await page.request.post("/api/auth/logout");
  await page.getByRole("button", { name: "Розпочати навчання" }).click();
  await expect(
    page.getByRole("button", { name: "Увійти", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".top-actions")).toHaveCount(0);
});

test("registration, private progress, session ownership, logout and owner permissions", async ({
  playwright,
  request,
  page,
}) => {
  const first = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:8788",
  });
  const second = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:8788",
  });
  try {
    expect((await first.get("/api/progress")).status()).toBe(401);
    const credentials = {
      username: `learner-${Date.now()}`,
      password: "Learner-password-12345",
    };
    const registration = await first.post("/api/auth/register", {
      data: { ...credentials, role: "admin", userId: "local" },
    });
    expect(registration.ok()).toBe(true);
    expect((await registration.json()).user.role).toBe("learner");
    expect(registration.headers()["set-cookie"]).toContain("HttpOnly");
    expect(registration.headers()["set-cookie"]).toContain("SameSite=Strict");
    expect((await first.get("/api/progress")).headers()["cache-control"]).toBe(
      "no-store",
    );
    expect((await (await first.get("/api/progress")).json()).xp).toBe(0);
    expect((await first.post("/api/import", { data: {} })).status()).toBe(403);
    expect((await first.delete("/api/brands/insight")).status()).toBe(403);
    const c = (await (await first.get("/api/catalog")).json()) as Catalog;
    const session = await (
      await first.post("/api/sessions", { data: {} })
    ).json();
    const q = generateQuestions(c, [], "all", session.id)[0];
    const answer = { questionId: q.id, answer: q.answer };
    expect(
      (
        await first.post(`/api/sessions/${session.id}/answers`, {
          data: answer,
        })
      ).ok(),
    ).toBe(true);
    await second.post("/api/auth/register", {
      data: { ...credentials, username: `${credentials.username}-b` },
    });
    expect((await (await second.get("/api/progress")).json()).xp).toBe(0);
    expect(
      (
        await second.post(`/api/sessions/${session.id}/answers`, {
          data: answer,
        })
      ).status(),
    ).toBe(404);
    const oldState = await first.storageState();
    await first.post("/api/auth/logout");
    expect((await first.get("/api/progress")).status()).toBe(401);
    const replay = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:8788",
      storageState: oldState,
    });
    expect((await replay.get("/api/progress")).status()).toBe(401);
    await replay.dispose();
    expect(
      (
        await first.post("/api/auth/login", {
          data: { ...credentials, password: "Wrong-password-12345" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (await first.post("/api/auth/login", { data: credentials })).ok(),
    ).toBe(true);
    expect((await (await first.get("/api/progress")).json()).xp).toBe(10);
    expect(
      (
        await second.post("/api/auth/setup", {
          data: { ...credentials, setupKey: "wrong-key" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await second.post("/api/auth/register", { data: credentials })).status(),
    ).toBe(409);
    const owner = await (await request.get("/api/auth/me")).json();
    expect(owner.user.id).toBe("owner");
    const before = (await (await request.get("/api/progress")).json()) as Stats;
    const repeat = await request.post("/api/auth/setup", {
      data: {
        ...ownerCredentials,
        setupKey: "local-e2e-owner-key-not-for-production-123456",
      },
    });
    expect(repeat.status()).toBe(409);
    expect(await (await request.get("/api/progress")).json()).toEqual(before);
    // Browser identity must be cleared together with its loaded learning state.
    await page.goto("/");
    await page.getByRole("button", { name: /Меню акаунта/ }).click();
    await page.getByRole("button", { name: "Вийти з акаунта" }).click();
    await page.getByRole("link", { name: "Увійти", exact: true }).click();
    await page.getByLabel("Логін", { exact: true }).fill(credentials.username);
    await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await expect(page.locator(".top-actions")).toContainText("10 XP");
    await expect(
      page.getByRole("link", { name: "Керування продуктами" }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".top-actions")).toContainText("10 XP");
  } finally {
    await first.dispose();
    await second.dispose();
  }
});

test("brand selection keeps line folders and narrows the line filter", async ({
  page,
}) => {
  await page.goto("/catalog");
  await page
    .getByRole("combobox", { name: "Бренд", exact: true })
    .selectOption({ label: "milk_shake" });
  await expect(page.locator(".brand-section")).toHaveCount(1);
  await expect(page.locator(".brand-title")).toHaveText("milk_shake");
  await expect(page.locator(".catalog-lines .line-card").first()).toBeVisible();
  await expect(page.getByText(/Знайдено продуктів:/)).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Лінійка", exact: true })
    .selectOption({ label: "Argan" });
  await expect(page.getByText(/Знайдено продуктів:/)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Бренд", exact: true })
    .selectOption({ label: "Insight" });
  await expect(
    page.getByRole("combobox", { name: "Лінійка", exact: true }),
  ).toHaveValue("");
  await expect(page.locator(".brand-title")).toHaveText("Insight");
  await expect(
    page
      .getByRole("combobox", { name: "Лінійка", exact: true })
      .locator("option")
      .filter({ hasText: /^Argan$/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Скинути фільтри" }).click();
  await expect(page.locator(".brand-section")).toHaveCount(2);
});
