import { test, expect } from "@playwright/test";

test("catalog artwork and readable copy never overlap", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/catalog");
    const section = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Insight", exact: true }),
      });
    await expect(section.locator(".line-card")).toHaveCount(14);
    await section.scrollIntoViewIfNeeded();
    for (const card of await section.locator(".line-card").all()) {
      const art = await card.locator(".line-art").boundingBox();
      const content = await card.locator(".line-content").boundingBox();
      expect(art!.y + art!.height).toBeLessThanOrEqual(content!.y + 1);
      await expect(card.locator(".art-caption")).toHaveCount(0);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(section.locator(".nested-products").first()).not.toContainText(
      "Anti-frizz ",
    );
    await page.screenshot({
      path: `test-results/catalog-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page.getByRole("button", { name: "Увімкнути темну тему" }).click();
      await section
        .locator(".line-card")
        .first()
        .screenshot({ path: "test-results/catalog-dark.png" });
    }
  }
});
