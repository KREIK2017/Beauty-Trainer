/**
 * Audit product artwork without changing it.
 *
 * Usage:
 *   npm run images:audit
 * Small source files must be replaced with larger originals. Artificially
 * enlarging them does not restore label detail and makes blur more visible.
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import sharp from "sharp";
import { catalogSchema } from "../shared/schema";

const imageRoot = join(process.cwd(), "public", "images");
const recommendedLongEdge = 600;
const recommendedShortEdge = 450;

const catalog = catalogSchema.parse(
  JSON.parse(
    readFileSync(join(process.cwd(), "data", "products.json"), "utf8"),
  ),
);
const files = [
  ...new Set(
    catalog.products
      .map((product) => product.image)
      .filter((image): image is string => Boolean(image?.endsWith(".webp")))
      .map((image) => join(imageRoot, image.replace(/^\/images\//, ""))),
  ),
];
let lowResolutionCount = 0;

for (const file of files) {
  const metadata = await sharp(file).metadata();
  if (!metadata.width || !metadata.height) continue;
  // Tall packshots need height; wide or square packshots need enough pixels on
  // their shorter side for the largest UI slot. Either condition is adequate.
  if (
    Math.max(metadata.width, metadata.height) >= recommendedLongEdge ||
    Math.min(metadata.width, metadata.height) >= recommendedShortEdge
  )
    continue;

  lowResolutionCount += 1;
  console.log(
    `${relative(process.cwd(), file)}: ${metadata.width}x${metadata.height} — потрібен більший оригінал`,
  );
}

console.log(
  lowResolutionCount > 0
    ? `${lowResolutionCount} із ${files.length} фото мають низьку роздільність. Скрипт їх не збільшує.`
    : `Усі ${files.length} фото продуктів мають достатню роздільність.`,
);
