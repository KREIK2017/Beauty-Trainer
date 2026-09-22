import { test, expect } from "./fixtures";
import { generateQuestions } from "../../shared/learning";
import type { Catalog } from "../../shared/schema";

test("avatar opens account navigation on desktop and mobile with keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Меню акаунта/ });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = page.getByRole("navigation", { name: "Дії акаунта" });
    await expect(
      menu.getByRole("link", { name: "Панель адміна", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("link", { name: "Керування продуктами", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/account-menu-${width}.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
  await trigger.click();
  await page.getByRole("link", { name: "Налаштування", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Налаштування", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#account-dropdown")).toHaveCount(0);
  await trigger.click();
  await page.mouse.click(5, 450);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("owner assigns brands and lines, preserves progress and deletes only learner accounts", async ({
  page,
  request,
  playwright,
}) => {
  const learner = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:8788",
  });
  const credentials = {
    username: `access-${Date.now()}`,
    password: "Learning-password-12345",
  };
  let id = "";
  try {
    expect((await learner.get("/api/catalog")).status()).toBe(401);
    const signup = await learner.post("/api/auth/register", {
      data: credentials,
    });
    expect(signup.ok()).toBe(true);
    id = (await signup.json()).user.id;
    const catalog: Catalog = await (await learner.get("/api/catalog")).json();
    const old = await (
      await learner.post("/api/sessions", { data: {} })
    ).json();
    const q = generateQuestions(catalog, [], "all", old.id)[0];
    expect(
      (
        await learner.post(`/api/sessions/${old.id}/answers`, {
          data: { questionId: q.id, answer: q.answer },
        })
      ).ok(),
    ).toBe(true);
    const unrestricted = { allMaterials: true, brandIds: [], lineIds: [] };
    expect(
      (
        await learner.put(`/api/admin/users/${id}/access`, {
          data: unrestricted,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await learner.delete(`/api/admin/users/${id}`, {
          data: { username: credentials.username },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.delete("/api/admin/users/owner", {
          data: { username: "e2e-owner" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put("/api/admin/users/owner/access", {
          data: unrestricted,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put(`/api/admin/users/${id}/access`, {
          data: { ...unrestricted, lineIds: ["unknown-line"] },
        })
      ).status(),
    ).toBe(400);
    const brand = catalog.brands[0];
    const line = catalog.lines.find((l) => l.brand_id !== brand.id)!;
    const blocked = catalog.lines.find(
      (l) => l.brand_id !== brand.id && l.id !== line.id,
    )!;
    await page.goto(`/admin/users/${id}`);
    await page.getByLabel("Дозволити весь каталог", { exact: true }).uncheck();
    await page.getByLabel(`Увесь бренд ${brand.name}`, { exact: true }).check();
    await page.getByLabel(line.name, { exact: true }).check();
    await page
      .getByRole("button", { name: "Зберегти доступ", exact: true })
      .click();
    await expect(page.getByText("Доступ до навчання збережено.")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/account-access-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    const allowed: Catalog = await (await learner.get("/api/catalog")).json();
    expect(allowed.lines.map((l) => l.id).sort()).toEqual(
      catalog.lines
        .filter((l) => l.brand_id === brand.id || l.id === line.id)
        .map((l) => l.id)
        .sort(),
    );
    expect(
      allowed.products.every((p) =>
        allowed.lines.some((l) => l.id === p.line_id),
      ),
    ).toBe(true);
    expect(
      (
        await learner.post(`/api/sessions/${old.id}/answers`, {
          data: { questionId: q.id, answer: q.answer },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await learner.post("/api/sessions", { data: { lineId: blocked.id } })
      ).status(),
    ).toBe(404);
    for (const difficulty of ["normal", "hard"])
      expect(
        (
          await learner.post("/api/sessions", {
            data: { lineId: line.id, difficulty },
          })
        ).ok(),
      ).toBe(true);
    const detail = await (await request.get(`/api/admin/users/${id}`)).json();
    expect(detail.account.xp).toBe(10);
    expect(detail.recentAnswers).toHaveLength(1);
    await request.put(`/api/admin/users/${id}/access`, {
      data: { allMaterials: false, brandIds: [], lineIds: [] },
    });
    expect(
      (await (await learner.get("/api/catalog")).json()).products,
    ).toHaveLength(0);
    expect((await learner.post("/api/sessions", { data: {} })).status()).toBe(
      403,
    );
    const hidden = await (await learner.get("/api/progress")).json();
    expect(hidden.xp).toBe(10);
    expect(hidden.history).toHaveLength(0);
    expect(hidden.progress).toHaveLength(0);
    await page.context().clearCookies();
    await page.context().addCookies((await learner.storageState()).cookies);
    await page.goto("/");
    await expect(page.getByRole("status")).toContainText(
      "ще немає доступних продуктів",
    );
    await page.getByRole("button", { name: /Меню акаунта/ }).click();
    await expect(
      page.getByRole("link", { name: "Панель адміна", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Керування продуктами", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Налаштування", exact: true }).click();
    await page
      .getByLabel("Поточний пароль", { exact: true })
      .fill(credentials.password);
    await page
      .getByLabel("Новий пароль", { exact: true })
      .fill("Changed-password-12345");
    await page
      .getByLabel("Повторіть новий пароль", { exact: true })
      .fill("Changed-password-12345");
    await page
      .getByRole("button", { name: "Змінити пароль", exact: true })
      .click();
    await expect(
      page.getByText("Пароль змінено. Попередні сесії завершено."),
    ).toBeVisible();
    expect((await learner.get("/api/progress")).status()).toBe(401);
    expect(
      (await learner.post("/api/auth/login", { data: credentials })).status(),
    ).toBe(401);
    expect(
      (
        await learner.post("/api/auth/login", {
          data: { ...credentials, password: "Changed-password-12345" },
        })
      ).ok(),
    ).toBe(true);
    await request.put(`/api/admin/users/${id}/access`, { data: unrestricted });
    expect(
      (await (await learner.get("/api/progress")).json()).history,
    ).toHaveLength(1);
    await page.context().clearCookies();
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto(`/admin/users/${id}`);
    await page
      .getByText(`Видалити акаунт ${credentials.username}`, { exact: true })
      .click();
    const confirmation = page.getByLabel(
      `Введіть логін для підтвердження: ${credentials.username}`,
      { exact: true },
    );
    await confirmation.fill("wrong");
    await expect(
      page.getByRole("button", { name: "Видалити назавжди", exact: true }),
    ).toBeDisabled();
    expect(
      (
        await request.delete(`/api/admin/users/${id}`, {
          data: { username: "wrong" },
        })
      ).status(),
    ).toBe(400);
    await confirmation.fill(credentials.username);
    await page
      .getByRole("button", { name: "Видалити назавжди", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    expect((await learner.get("/api/progress")).status()).toBe(401);
    expect((await request.get(`/api/admin/users/${id}`)).status()).toBe(404);
    expect(
      (
        await learner.post("/api/auth/login", {
          data: { ...credentials, password: "Changed-password-12345" },
        })
      ).status(),
    ).toBe(401);
  } finally {
    if (id)
      await request.delete(`/api/admin/users/${id}`, {
        data: { username: credentials.username },
      });
    await learner.dispose();
  }
});
