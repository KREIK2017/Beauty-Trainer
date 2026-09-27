import { test, expect } from "./fixtures";

test("catalog artwork and readable copy never overlap", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/catalog");
    const sections = [
      { name: "Insight", count: 14 },
      { name: "milk_shake", count: 22 },
    ].map(({ name, count }) => ({
      count,
      section: page.locator("section").filter({
        has: page.getByRole("heading", { name, exact: true }),
      }),
    }));

    for (const { section, count } of sections) {
      await expect(section.locator(".line-card")).toHaveCount(count);
      await section.scrollIntoViewIfNeeded();
      for (const card of await section.locator(".line-card").all()) {
        await card.scrollIntoViewIfNeeded();
        const art = await card.locator(".line-art").boundingBox();
        const content = await card.locator(".line-content").boundingBox();
        expect(art!.y + art!.height).toBeLessThanOrEqual(content!.y + 1);
        const photoLocator = card.locator(".line-photo");
        await expect(photoLocator).toHaveJSProperty("complete", true);
        expect(
          await photoLocator.evaluate(
            (image: HTMLImageElement) => image.naturalWidth,
          ),
        ).toBeGreaterThan(0);
        const photo = await photoLocator.boundingBox();
        expect(photo).not.toBeNull();
        expect(photo!.x).toBeGreaterThanOrEqual(art!.x);
        expect(photo!.y).toBeGreaterThanOrEqual(art!.y);
        expect(photo!.x + photo!.width).toBeLessThanOrEqual(
          art!.x + art!.width,
        );
        expect(photo!.y + photo!.height).toBeLessThanOrEqual(
          art!.y + art!.height,
        );
        await expect(card.locator(".art-caption")).toHaveCount(0);
      }
    }
    const brokenImages = await page
      .locator(".line-photo")
      .evaluateAll((images) =>
        images
          .filter(
            (image) =>
              !(image instanceof HTMLImageElement) ||
              !image.complete ||
              image.naturalWidth === 0,
          )
          .map((image) => image.getAttribute("src")),
      );
    expect(brokenImages).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      sections[0].section.locator(".nested-products").first(),
    ).not.toContainText("Anti-frizz ");
    await page.screenshot({
      path: `test-results/catalog-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page.getByRole("button", { name: "Увімкнути темну тему" }).click();
      await sections[0].section
        .locator(".line-card")
        .first()
        .screenshot({ path: "test-results/catalog-dark.png" });
    }
  }
});

test("product thumbnails stay inside line cards for every source ratio", async ({
  page,
}) => {
  await page.goto("/lines/anti-frizz");
  await expect(page.locator(".product-card")).toHaveCount(3);

  for (const thumb of await page.locator(".product-thumb").all()) {
    const frame = await thumb.boundingBox();
    const image = await thumb.locator("img").boundingBox();
    expect(image).not.toBeNull();
    expect(image!.x).toBeGreaterThanOrEqual(frame!.x);
    expect(image!.y).toBeGreaterThanOrEqual(frame!.y);
    expect(image!.x + image!.width).toBeLessThanOrEqual(
      frame!.x + frame!.width,
    );
    expect(image!.y + image!.height).toBeLessThanOrEqual(
      frame!.y + frame!.height,
    );
  }
});
