import { test, expect } from "./fixtures";
import type { Catalog } from "../../shared/schema";
import { catalogQuality, productIssueLabels } from "../../shared/quality";

test("owner reviews catalog gaps, filters them and opens product editing", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const report = catalogQuality(catalog);
  await page.goto("/admin/quality");
  await expect(
    page.getByRole("heading", { name: "Що потрібно доповнити" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Продуктів без зауважень із ${report.summary.products}`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Без окремого фото", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /milk_shake/ })).toHaveAttribute(
    "href",
    "https://alpenstore.com.ua/milk_shake",
  );

  const issue = (
    [
      "missing-image",
      "missing-usage",
      "short-description",
      "duplicate-description",
      "repeated-purpose",
      "repeated-benefit",
    ] as const
  ).find((value) => report.products.some((row) => row.issues.includes(value)))!;
  const matching = report.products.filter((row) => row.issues.includes(issue));
  await page.getByLabel("Тип проблеми").selectOption(issue);
  const productPanel = page
    .locator(".detail-panel")
    .filter({ has: page.getByRole("heading", { name: "Проблеми продуктів" }) });
  await expect(
    productPanel.getByText(`Знайдено продуктів: ${matching.length}`),
  ).toBeVisible();
  const first = matching[0];
  await expect(
    productPanel
      .locator(".quality-badges")
      .getByText(productIssueLabels[issue], { exact: true })
      .first(),
  ).toBeVisible();
  const source = productPanel
    .getByRole("link", { name: "Знайти на Alpenstore" })
    .first();
  await expect(source).toHaveAttribute(
    "href",
    /alpenstore\.com\.ua\/search\?search=/,
  );

  await page.getByLabel("Пошук").fill(first.product.name);
  await expect(productPanel.locator(".quality-row")).toHaveCount(1);
  await productPanel
    .getByRole("link", { name: "Редагувати", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Редагувати продукт" }),
  ).toBeVisible();
  await expect(page.getByLabel("Назва", { exact: true })).toHaveValue(
    first.product.name,
  );
  await page.getByRole("button", { name: "Закрити редактор" }).click();

  await page.goto("/admin/quality");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Тип проблеми").selectOption("missing-usage");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/quality-report-mobile.png",
    animations: "disabled",
  });
});
