import { expect, test } from "./fixtures";

const screens = [
  { path: "/training", heading: "Кожне тренування — крок уперед." },
  { path: "/weak", heading: "Що повторити сьогодні" },
  { path: "/settings", heading: "Налаштування" },
  { path: "/admin/users", heading: "Акаунти та навчання" },
  { path: "/admin/quality", heading: "Що потрібно доповнити" },
] as const;

test("P1 learning and account screens remain readable on desktop and mobile", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const screen of screens) {
      await page.goto(screen.path);
      await expect(
        page.getByRole("heading", { name: screen.heading, exact: true }),
      ).toBeVisible();
      await page.waitForTimeout(220);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/training");
    await expect(
      page.getByRole("heading", {
        name: "Кожне тренування — крок уперед.",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/p1-training-${width}.png`,
      fullPage: true,
    });
    await page.goto("/weak");
    await expect(
      page.getByRole("heading", { name: "Що повторити сьогодні", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/p1-review-${width}.png`,
      fullPage: true,
    });
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Налаштування", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/p1-settings-${width}.png`,
      fullPage: true,
    });
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", {
        name: "Акаунти та навчання",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/p1-admin-users-${width}.png`,
      fullPage: true,
    });
  }
});
