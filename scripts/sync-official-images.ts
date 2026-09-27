/**
 * Download catalog artwork from the brands' official product pages.
 *
 * Usage: npx tsx scripts/sync-official-images.ts --write
 * Without --write the script prints the planned updates without using network.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const insightBase = "https://insightprofessional.it/en/product";
const milkBase = "https://us.milkshakehair.com";
const write = process.argv.includes("--write");

const insightPages: Record<string, string> = {
  "anti-frizz-zvolozhuiuchyi-shampun": "hydrating-shampoo",
  "anti-frizz-zvolozhuiuchyi-kondytsioner": "hydrating-hair-conditioner",
  "anti-frizz-zvolozhuiucha-maska-dlia-volossia": "hydrating-hair-mask",
  "antioxidant-antyoksydantnyi-shampun": "antioxidant-shampoo",
  "antioxidant-antyoksydantnyi-kondytsioner": "antioxidant-hair-conditioner",
  "antioxidant-antyoksydantna-maska-dlia-volossia": "antioxidant-hair-mask",
  "antioxidant-sprei-dlia-zakhystu-volossia": "protective-hair-spray",
  "blonde-shampun-dlia-kholodnykh-vidtinkiv-blond-ta-siaiva":
    "cold-reflections-brightening-shampoo",
  "blonde-maska-dlia-volossia-shcho-pidsyliuie-kholodni-vidtinky-blond":
    "cold-reflections-hair-mask",
  "clarifying-ochyshchuiuchyi-dohliad": "purifying-shampoo",
  "clarifying-ochyshchuiuchyi-shampun": "purifying-scalp-treatment",
  "colored-hair-zakhysnyi-shampun": "protective-shampoo",
  "colored-hair-zakhysnyi-kondytsioner": "protective-hair-conditioner",
  "colored-hair-zakhysna-maska-dlia-volossia": "protective-hair-mask",
  "daily-use-enerhezuiuchyi-shampun": "energizing-shampoo",
  "daily-use-sukhyi-shampun-dlia-ob-iemu": "bodifying-dry-shampoo",
  "daily-use-enerhetychnyi-kondytsioner-dlia-volossia":
    "energizing-hair-conditioner",
  "daily-use-nezmyvnyi-kondytsioner-dlia-rozplutuvannia-volossia":
    "leave-in-hair-detangler",
  "daily-use-enerhetychna-maska-dlia-volossia": "energizing-hair-mask",
  "damaged-hair-vidnovliuvalnyi-shampun": "restructurizing-shampoo",
  "damaged-hair-vidnovliuvalnyi-kondytsioner":
    "restructurizing-hair-conditioner",
  "damaged-hair-vidnovliuvalna-maska-dlia-volossia":
    "restructurizing-hair-mask",
  "damaged-hair-vidnovliuvalnyi-sprei-dlia-volossia":
    "restructurizing-hair-spray",
  "densifying-zmitsniuiuchyi-shampun": "fortifying-shampoo",
  "densifying-zmitsniuiuchyi-dohliad": "fortifying-hair-treatment",
  "dry-hair-pozhyvnyi-shampun": "nourishing-shampoo",
  "dry-hair-pozhyvnyi-kondytsioner": "nourishing-hair-conditioner",
  "dry-hair-pozhyvna-maska-dlia-volossia": "nourishing-hair-mask",
  "elasti-curl-m-iakyi-ochyshchuiuchyi-shampun": "pure-mild-shampoo",
  "elasti-curl-krem-dlia-pidkreslennia-kucheriv": "curls-defining-hair-cream",
  "elasti-curl-oliia-dlia-pruzhnykh-kucheriv": "bouncy-curls-hair-oil",
  "elasti-curl-nezmyvne-molochko-dlia-rozplutuvannia-volossia":
    "leave-in-detangling-hair-milk",
  "elasti-curl-lak-dlia-volossia-z-lehkoiu-fiksatsiieiu":
    "light-hold-fixative-hair-spray",
  "elasti-curl-oliia-syvorotka-dlia-siaiva-volossia":
    "illuminating-hair-oil-serum",
  "elasti-curl-maska-dlia-rozplutuvannia-kocheriavoho-volossia":
    "curly-hair-detangling-mask",
  "lenitive-dermo-zaspokiilyvyi-shampun": "dermo-calming-shampoo",
  "lenitive-krem-dlia-komfortu-shkiry-holovy": "scalp-comfort-cream",
  "rebalancing-rebalansin-shampun": "rebalancing-shampoo",
  "rebalancing-krem-eksfoliant-dlia-shkiry-holovy": "scalp-exfoliating-cream",
  "sensitive-shampun-dlia-chutlyvoi-shkiry-holovy": "sensitive-scalp-shampoo",
  "sensitive-kondytsioner-dlia-chutlyvoi-shkiry-holovy":
    "sensitive-scalp-hair-conditioner",
  "sensitive-maska-dlia-chutlyvoi-shkiry-holovy": "sensitive-scalp-hair-mask",
  "volumizing-volume-up-shampoo": "volume-up-shampoo",
  "volumizing-volume-up-root-lotion": "volume-up-root-lotion",
  "volumizing-volume-up-hydrating-spray": "volume-up-hydrating-hair-spray",
};

const milkPages: Record<string, string> = {
  argan: `${milkBase}/products/milk_shake-argan-oil`,
  "cold-brunette": `${milkBase}/collections/cold-brunette`,
  "color-care": `${milkBase}/collections/colour-care`,
  "curl-passion": `${milkBase}/collections/curl-passion`,
  "deep-detox":
    "https://cdn.shopify.com/s/files/1/0607/5865/5194/files/milk-shake-deep-detox-shampoo-300-ml.jpg?v=1713331180",
  "energizin-blend": `${milkBase}/collections/scalp-care-collection`,
  "flower-power": `${milkBase}/products/colour-care-flower-shine-trio`,
  "icy-blond": `${milkBase}/collections/icy-blond`,
  incredible: `${milkBase}/products/milk-shake-incredible-milk`,
  "insta-light": `${milkBase}/products/milk_shake-insta-light-shampoo`,
  "integrity-and-strength": `${milkBase}/collections/integrity-strength`,
  "leave-in": `${milkBase}/products/milk-shake-leave-in-conditioner`,
  lifestyling: `${milkBase}/products/milk_shake-lifestyling-thermo-protector`,
  "make-my-day": `${milkBase}/products/milk_shake-make-my-day-shampoo`,
  "moisture-and-more": `${milkBase}/collections/dry-1`,
  "no-frizz-allowed": `${milkBase}/products/no-frizz-allowed-perfecting-shampoo-300ml`,
  "normalizing-blend": `${milkBase}/products/milk_shake-normalizing-blend-shampoo`,
  "pink-lemonade":
    "https://www.z-oneconcept.com/en/milk-shake/pink-lemonade-summer-colour/",
  "purifying-blend": `${milkBase}/products/milk_shake-purifying-blend-shampoo`,
  "silver-shine": `${milkBase}/collections/silver-shine-collection`,
  "sun-and-more":
    "https://cdn.shopify.com/s/files/1/0912/9020/6474/files/IMG_5551_collection_sun_moreV2.jpg?v=1782979305",
  "volume-solution": `${milkBase}/products/volume-solution-volumizing-shampoo`,
};

function decodeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&#038;", "&");
}

async function officialImage(pageUrl: string) {
  if (/\.(?:avif|jpe?g|png|webp)(?:\?|$)/i.test(pageUrl)) return pageUrl;
  const response = await fetch(pageUrl, {
    headers: { "user-agent": "BeautyTrainer image sync" },
  });
  if (!response.ok) throw new Error(`${pageUrl}: HTTP ${response.status}`);
  const html = await response.text();
  const match = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
  );
  if (!match) throw new Error(`${pageUrl}: og:image не знайдено`);
  return decodeHtml(match[1]);
}

async function download(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "BeautyTrainer image sync" },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function writeWithRetry(target: string, data: Buffer) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await writeFile(target, data);
      return;
    } catch (error) {
      if (attempt === 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
    }
  }
}

async function writeInsight(id: string, pageUrl: string, imageUrl: string) {
  const target = join("public", "images", "insight", `${id}.webp`);
  const source = await download(imageUrl);
  const metadata = await sharp(source).metadata();
  let pipeline = sharp(source).rotate();
  if (metadata.hasAlpha) pipeline = pipeline.trim({ threshold: 5 });
  const result = await pipeline
    .resize({
      width: 1000,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 95, alphaQuality: 100, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  await writeWithRetry(target, result.data);
  return {
    id,
    page: pageUrl,
    image: imageUrl,
    width: result.info.width,
    height: result.info.height,
  };
}

async function writeMilkLine(id: string, pageUrl: string, imageUrl: string) {
  const target = join("public", "images", "milk-shake", `${id}.webp`);
  const source = await download(imageUrl);
  const metadata = await sharp(source).metadata();
  const ratio = (metadata.width ?? 1) / (metadata.height ?? 1);
  let prepared: Buffer;

  if (ratio >= 1.35) {
    prepared = await sharp(source)
      .rotate()
      .resize({ width: 1200, height: 675, fit: "cover", position: "centre" })
      .webp({ quality: 92, smartSubsample: true })
      .toBuffer();
  } else {
    const foreground = await sharp(source)
      .rotate()
      .resize({
        width: 920,
        height: 575,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();
    prepared = await sharp({
      create: { width: 1200, height: 675, channels: 3, background: "#f6f4ef" },
    })
      .composite([{ input: foreground, gravity: "centre" }])
      .webp({ quality: 92, smartSubsample: true })
      .toBuffer();
  }

  mkdirSync(dirname(target), { recursive: true });
  await writeWithRetry(target, prepared);
  return { id, page: pageUrl, image: imageUrl, width: 1200, height: 675 };
}

const planned =
  Object.keys(insightPages).length + Object.keys(milkPages).length;
if (!write) {
  console.log(
    `Буде оновлено ${planned} зображень. Додайте --write для завантаження.`,
  );
  process.exit(0);
}

const sources: Array<Record<string, string | number>> = [];
for (const [id, slug] of Object.entries(insightPages)) {
  const pageUrl = `${insightBase}/${slug}/`;
  const imageUrl = await officialImage(pageUrl);
  const result = await writeInsight(id, pageUrl, imageUrl);
  sources.push({ brand: "Insight", ...result });
  console.log(`Insight: ${id} — ${result.width}x${result.height}`);
}
for (const [id, pageUrl] of Object.entries(milkPages)) {
  const imageUrl = await officialImage(pageUrl);
  const result = await writeMilkLine(id, pageUrl, imageUrl);
  sources.push({ brand: "milk_shake", ...result });
  console.log(`milk_shake: ${id} — ${result.width}x${result.height}`);
}

writeFileSync(
  join("data", "image-sources.json"),
  `${JSON.stringify({ checked_on: "2026-09-27", sources }, null, 2)}\n`,
);
console.log(`Оновлено ${sources.length} з ${planned} зображень.`);
