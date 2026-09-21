import { test, expect } from "@playwright/test";

test("new visitors learn about the site before choosing login or registration", async ({
  page,
}) => {
  await page.context().clearCookies();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Знайте продукт. Радьте впевнено." }),
    ).toBeVisible();
    await expect(page.getByLabel("Пароль", { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/welcome-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "Як це працює" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await page
    .getByRole("link", { name: "Створити акаунт", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByLabel("Повторіть пароль", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Про Beauty Trainer" }).click();
  await page.getByRole("link", { name: "Увійти", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Увійти", exact: true }),
  ).toBeVisible();
});
