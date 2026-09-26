import { test, expect } from "./fixtures";

test("product page separates learning cues from details on desktop and mobile", async ({
  page,
}) => {
  await page.goto(
    "/products/anti-frizz-zvolozhuiucha-maska-dlia-volossia",
  );
  await expect(
    page.getByRole("heading", {
      name: "Anti-frizz Зволожуюча маска для волосся",
    }),
  ).toBeVisible();
  await expect(page.getByText("ЩО РОБИТЬ ПРОДУКТ")).toBeVisible();
  await expect(page.getByText("ЗАПАМ’ЯТАЙТЕ")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Коли рекомендувати" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Глибоке живлення й розгладження сухого та пухнастого волосся",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Спосіб застосування" }),
  ).toBeVisible();

  const ingredients = page.locator(".ingredients-details");
  await expect(ingredients).not.toHaveAttribute("open", "");
  await ingredients.getByText("Ключові складники", { exact: true }).click();
  await expect(ingredients).toHaveAttribute("open", "");
  await page.screenshot({
    path: "test-results/product-learning-desktop.png",
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Anti-frizz Зволожуюча маска для волосся",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/product-learning-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
