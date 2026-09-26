/**
 * Audit and gently optimize catalog artwork.
 *
 * Usage:
 *   npm run images:audit
 *   npm run images:optimize
 *
 * Optimization enlarges only small images and never beyond 2x. This improves
 * browser scaling and edge clarity, but cannot restore detail absent from the
 * source file. Replacing a small source with a larger original remains the best
 * way to improve labels and fine print.
 */
import { readFileSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import sharp from "sharp";
import { catalogSchema } from "../shared/schema";

const imageRoot = join(process.cwd(), "public", "images");
const shouldWrite = process.argv.includes("--write");
const targetLongEdge = 560;
const minimumLongEdge = 500;
const maximumScale = 2;

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
let smallCount = 0;
let optimizedCount = 0;

for (const file of files) {
  const source = readFileSync(file);
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) continue;

  const longEdge = Math.max(metadata.width, metadata.height);
  if (longEdge >= minimumLongEdge) continue;

  smallCount += 1;
  const scale = Math.min(maximumScale, targetLongEdge / longEdge);
  const width = Math.round(metadata.width * scale);
  const height = Math.round(metadata.height * scale);
  const label = relative(process.cwd(), file);

  if (!shouldWrite) {
    console.log(
      `${label}: ${metadata.width}x${metadata.height} → ${width}x${height}`,
    );
    continue;
  }

  const optimized = await sharp(source)
    .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 0.7, m1: 0.5, m2: 0.2 })
    .webp({ quality: 90, alphaQuality: 100, smartSubsample: true })
    .toBuffer();

  await writeFile(file, optimized);
  optimizedCount += 1;
  console.log(
    `${label}: ${metadata.width}x${metadata.height} → ${width}x${height}`,
  );
}

const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(
  shouldWrite
    ? `Оптимізовано ${optimizedCount} зображень. Загальний розмір: ${Math.round(totalBytes / 1024)} КБ.`
    : smallCount > 0
      ? `Знайдено ${smallCount} малих зображень із ${files.length}. Запустіть npm run images:optimize для обробки.`
      : `Усі ${files.length} фото продуктів мають достатній розмір.`,
);
