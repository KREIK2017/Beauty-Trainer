import { expect, test } from "./fixtures";
import type { Catalog } from "../../shared/schema";

const brands = [
  { id: "daily-naturals", name: "Daily Naturals" },
  { id: "depot", name: "DEPOT" },
  { id: "esla", name: "ESLA Italy" },
  { id: "hq-beauty", name: "H.Q.Beauty" },
  { id: "insight", name: "Insight" },
  { id: "milk-shake", name: "milk_shake" },
];

test("brand encyclopedia explains every catalog brand", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;

  for (const brand of brands) {
    await page.goto(`/brands/${brand.id}`);
    await expect(
      page.getByRole("heading", { name: brand.name, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("КОРОТКО ПРО БРЕНД")).toBeVisible();
    await expect(page.getByText("Що варто запам’ятати")).toBeVisible();
    await expect(page.locator(".catalog-lines .line-card")).toHaveCount(
      catalog.lines.filter((line) => line.brand_id === brand.id).length,
    );
    await expect(page.locator(".brand-sources a").first()).toHaveAttribute(
      "href",
      /^https:\/\//,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("catalog opens a responsive brand guide", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/catalog");
  await page
    .getByRole("link", { name: /milk_shake/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/brands\/milk-shake$/);
  await expect(page.getByText("Країна бренду")).toBeVisible();
  await page.getByRole("link", { name: "Обрати лінійку" }).click();
  await expect(page).toHaveURL(/#brand-lines$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
