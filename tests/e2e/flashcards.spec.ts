import { test, expect } from "@playwright/test";

test("cards hide answers, repeat difficult products and lead to the line test", async ({
  page,
}) => {
  await page.goto("/lines/lifestyling");
  await page.getByRole("link", { name: "Вивчити картки" }).click();
  const card = page.getByRole("region", { name: "Навчальна картка" });
  const firstName = await card.getByRole("heading", { level: 2 }).innerText();
  await expect(
    page.getByRole("region", { name: "Відповідь", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Пам’ятаю", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Відкрити відповідь" }).click();
  await expect(
    page.getByRole("region", { name: "Відповідь", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ще повторити", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await expect(
      page.getByRole("region", { name: "Відповідь", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Відкрити відповідь" }).click();
    await page.getByRole("button", { name: "Пам’ятаю", exact: true }).click();
  }
  await expect(page.getByText("Пам’ятаю: 3 · Ще повторити: 1")).toBeVisible();
  await page.getByRole("button", { name: "Повторити складні картки" }).click();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(firstName);
  await expect(page.getByText("Картка 1 із 1")).toBeVisible();
  await page.getByRole("button", { name: "Відкрити відповідь" }).click();
  await page.getByRole("button", { name: "Пам’ятаю", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Повторити складні картки" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Усі картки ще раз" }).click();
  await expect(page.getByText("Картка 1 із 4")).toBeVisible();
});

test("larger typography fits desktop and mobile pages", async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/catalog",
      "/lines/curl-passion",
      "/lines/curl-passion/cards",
      "/training?line=curl-passion",
      "/weak",
      "/progress",
      "/admin",
    ]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${width}px ${route} ${JSON.stringify(
          await page.locator("main *").evaluateAll((nodes) =>
            nodes
              .filter((n) => n.getBoundingClientRect().right > innerWidth)
              .slice(0, 6)
              .map((n) => ({
                tag: n.tagName,
                cls: n.className,
                width: n.getBoundingClientRect().width,
              })),
          ),
        )}`,
      ).toBe(true);
    }
    await page.goto("/lines/curl-passion/cards");
    await page.getByRole("button", { name: "Відкрити відповідь" }).click();
    await page.screenshot({
      path: `test-results/cards-${width}.png`,
      fullPage: true,
    });
  }
});
