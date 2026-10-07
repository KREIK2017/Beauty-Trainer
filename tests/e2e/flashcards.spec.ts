import { test, expect } from "./fixtures";

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
    page.getByRole("button", { name: "Знаю", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Відкрити відповідь" }).click();
  await expect(
    page.getByRole("region", { name: "Відповідь", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Не пам’ятаю", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await expect(
      page.getByRole("region", { name: "Відповідь", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Відкрити відповідь" }).click();
    await page.getByRole("button", { name: "Знаю", exact: true }).click();
  }
  await expect(
    page.getByText("Не пам’ятаю: 1 · Важко: 0 · Знаю: 3 · Легко: 0"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Повторити складні картки" }).click();
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(firstName);
  await expect(page.getByText("Картка 1 із 1")).toBeVisible();
  await page.getByRole("button", { name: "Відкрити відповідь" }).click();
  await page.getByRole("button", { name: "Знаю", exact: true }).click();
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
