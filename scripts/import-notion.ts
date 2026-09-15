/**
 * Convert a Notion export folder into the catalog JSON used by data/products.json.
 *
 * Usage: npx tsx scripts/import-notion.ts <brand-folder> [--write]
 *   e.g. npx tsx scripts/import-notion.ts milk_shake --write
 *        npx tsx scripts/import-notion.ts Insight --write
 *
 * The two brands were exported from differently shaped Notion pages, so each has
 * its own parser. Both end up as { lines, products, artwork } for one brand and
 * are merged into the catalog without touching any other brand.
 *
 * Neither export carries hair types, purposes or benefits as structured fields:
 *   - hair types and purposes come from the curated tables below, because the
 *     source text is free prose (milk_shake's "Підходить для" lists actions
 *     rather than hair types for Curl Passion),
 *   - benefits are split out of each product's own description, never invented,
 *   - milk_shake lists ingredients per line, so its products inherit them;
 *     Insight lists them per product and keeps them.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { catalogSchema, type Catalog, type Line, type Product } from "../shared/schema";

const folder = process.argv[2];
const write = process.argv.includes("--write");
if (!folder) throw new Error("Вкажіть теку бренду, напр.: milk_shake або Insight");

interface Parsed {
  lines: Line[];
  products: Product[];
  /** [source file, published name] pairs converted to WebP on --write. */
  artwork: [string, string][];
}

const brands: Record<string, { id: string; name: string; description: string }> = {
  milk_shake: {
    id: "milk-shake",
    name: "milk_shake",
    description:
      "Професійна італійська косметика для волосся від Z.One Concept. Догляд, стайлінг і тонування на основі молочних протеїнів, фруктових екстрактів та комплексу Integrity 41®.",
  },
  Insight: {
    id: "insight",
    name: "Insight",
    description:
      "Італійський бренд органічної косметики для волосся з понад 70-річним досвідом виробництва. Ідея бренду — «свідома краса»: догляд на основі рослинних екстрактів та олій, частина ліній сертифікована Cosmos Natural. Представлений у 50+ країнах.",
  },
};

/** Normalized hair-type vocabulary, curated per line from each export's own copy. */
const hairTypes: Record<string, string[]> = {
  // milk_shake
  Argan: ["Сухе", "Пошкоджене", "Тьмяне"],
  "Cold Brunette": ["Темне", "Фарбоване"],
  "Color Care": ["Фарбоване", "Тоноване", "Освітлене"],
  "Curl Passion": ["Кучеряве", "Хвилясте"],
  "Deep detox": ["Усі типи волосся"],
  "Energizin blend": ["Усі типи волосся"],
  "Flower power": ["Усі типи волосся", "Фарбоване", "Сухе", "Тьмяне"],
  "Icy Blond": ["Блонд", "Освітлене", "Сиве"],
  Incredible: ["Сухе", "Пошкоджене", "Фарбоване", "Ослаблене"],
  "Insta.light": ["Усі типи волосся", "Тьмяне", "Неслухняне"],
  "Integrity & strength": ["Сухе", "Пошкоджене", "Ослаблене"],
  "Leave in": ["Усі типи волосся", "Сухе", "Пористе", "Пошкоджене"],
  Lifestyling: ["Усі типи волосся"],
  "Make my day": ["Нормальне", "Сухе", "Тьмяне", "Фарбоване"],
  "Moisture & more": ["Сухе"],
  "No frizz allowed": ["Сухе", "Пухнасте", "Неслухняне"],
  "Normalizing blend": ["Жирна шкіра голови", "Комбінована шкіра голови"],
  "Pink Lemonade": ["Блонд", "Освітлене"],
  "Purifying blend": ["Жирне", "Нормальне", "Змішане"],
  "Silver shine": ["Блонд", "Освітлене", "Сиве"],
  "Sun & More": ["Усі типи волосся", "Волосся після сонця"],
  "volume solution": ["Тонке", "Ослаблене", "Нормальне"],
  // Insight
  "Anti-frizz": ["Пухнасте", "Неслухняне", "Сухе"],
  Antioxidant: ["Усі типи волосся"],
  Blonde: ["Блонд", "Освітлене", "Фарбоване"],
  Clarifying: ["Усі типи волосся", "Чутлива шкіра голови"],
  "Colored Hair": ["Фарбоване", "Меліроване"],
  "Daily Use": ["Усі типи волосся"],
  "Damaged Hair": ["Пошкоджене", "Ослаблене"],
  Densifying: ["Ослаблене", "Тонке"],
  "Dry Hair": ["Сухе", "Тьмяне", "Ламке"],
  "Elasti-curl": ["Кучеряве", "Хвилясте"],
  Lenitive: ["Чутлива шкіра голови"],
  Rebalancing: ["Жирна шкіра голови", "Комбінована шкіра голови"],
  Sensitive: ["Чутлива шкіра голови", "Усі типи волосся"],
  Volumizing: ["Тонке"],
};

/** Short purposes, and memory keywords for exports that carry none. */
const linePurposes: Record<string, [string[], string[]]> = {
  // milk_shake
  Argan: [["Живлення", "Відновлення"], ["Арган", "Живлення", "Блиск"]],
  "Cold Brunette": [["Нейтралізація теплих відтінків"], ["Брюнет", "Холодний тон", "Тонування"]],
  "Color Care": [["Збереження кольору"], ["Колір", "Захист", "Яскравість"]],
  "Curl Passion": [["Догляд за кучерями", "Підкреслення завитків"], ["Кучері", "Пружність", "Чіткість"]],
  "Deep detox": [["Глибоке очищення", "Детокс шкіри голови"], ["Детокс", "Очищення", "Метали"]],
  "Energizin blend": [["Зміцнення волосся", "Здоров’я шкіри голови"], ["Енергія", "Зміцнення", "Ефірні олії"]],
  "Flower power": [["Щоденний догляд", "Зволоження"], ["Веган", "Ніжність", "Колір"]],
  "Icy Blond": [["Нейтралізація жовтизни", "Холодний тон"], ["Блонд", "Крижаний", "Антижовтизна"]],
  Incredible: [["Живлення", "Захист"], ["12 ефектів", "Незмивний", "Блиск"]],
  "Insta.light": [["Дзеркальний блиск", "Гладкість"], ["Скляне волосся", "Блиск", "Легкість"]],
  "Integrity & strength": [["Відновлення", "Зміцнення"], ["Цілісність", "Сила", "Амарант"]],
  "Leave in": [["Незмивне зволоження", "Захист"], ["Незмивний", "Спрей", "Розчісування"]],
  Lifestyling: [["Стайлінг і фіксація", "Термозахист"], ["Стиль", "Фіксація", "Захист"]],
  "Make my day": [["Зволоження", "М’якість"], ["Щодня", "Легкість", "Блиск"]],
  "Moisture & more": [["Інтенсивне зволоження"], ["Зволоження", "Живлення", "Гіалурон"]],
  "No frizz allowed": [["Контроль пухнастості", "Розгладження"], ["Антифриз", "Гладкість", "Какаду"]],
  "Normalizing blend": [["Баланс шкіри голови"], ["Баланс", "Себорегуляція", "Коріандр"]],
  "Pink Lemonade": [["Рожеве тонування", "Підтримка кольору"], ["Рожевий", "Тонування", "Грейпфрут"]],
  "Purifying blend": [["Глибоке очищення", "Контроль лупи"], ["Лупа", "Очищення", "Водорості"]],
  "Silver shine": [["Нейтралізація жовтизни", "Холодний тон"], ["Срібло", "Антижовтизна", "Сяйво"]],
  "Sun & More": [["Захист після сонця", "Відновлення"], ["Сонце", "Після пляжу", "Гібіскус"]],
  "volume solution": [["Об’єм"], ["Об’єм", "Густота", "Цукрова тростина"]],
  // Insight — keywords come from the export's own «ключові слова» line.
  "Anti-frizz": [["Контроль пухнастості", "Розгладження"], []],
  Antioxidant: [["Антиоксидантний захист", "Захист від довкілля"], []],
  Blonde: [["Нейтралізація жовтизни", "Холодний тон"], []],
  Clarifying: [["Очищення шкіри голови", "Контроль лупи"], []],
  "Colored Hair": [["Захист кольору", "Збереження блиску"], []],
  "Daily Use": [["Щоденне очищення", "Зволоження"], []],
  "Damaged Hair": [["Відновлення структури", "Зміцнення"], []],
  Densifying: [["Проти випадіння", "Густота"], []],
  "Dry Hair": [["Глибоке живлення", "Еластичність"], []],
  "Elasti-curl": [["Чіткість завитка", "Еластичність"], []],
  Lenitive: [["Заспокоєння шкіри голови"], []],
  Rebalancing: [["Баланс шкіри голови", "Детокс"], []],
  Sensitive: [["Делікатне очищення", "Зволоження"], []],
  Volumizing: [["Об’єм", "Щільність"], []],
};

/** Product category, resolved by the first matching token in the product name. */
const categories: [RegExp, string][] = [
  [/hairspray|лак/i, "Лак для волосся"],
  [/сух[а-яіїєґ]*\s+шампун/i, "Сухий шампунь"],
  [/shampoo|шампун/i, "Шампунь"],
  [/leave[- ]?in|незмивн/i, "Незмивний догляд"],
  [/conditioner|кондиціонер/i, "Кондиціонер"],
  [/mask|маска/i, "Маска"],
  [/ексфоліант|пілінг/i, "Ексфоліант"],
  [/whipped cream|cream|крем/i, "Крем"],
  [/mousse|foam|пінка/i, "Пінка"],
  [/lotion|лосьйон/i, "Лосьйон"],
  [/spray|спрей/i, "Спрей"],
  [/fluid|флюїд/i, "Флюїд"],
  [/serum|сироватка|сиворотка/i, "Сироватка"],
  [/oil|олі[яй]/i, "Олія"],
  [/milk|молочко/i, "Молочко"],
  [/ампул/i, "Ампули"],
  [/кінчик/i, "Засіб для кінчиків"],
  [/gel|гель/i, "Гель"],
  [/primer/i, "Праймер"],
  [/protector|термозахист/i, "Термозахисний засіб"],
  [/shaper/i, "Стайлінговий засіб"],
  [/potion/i, "Засіб для блиску"],
  [/perfectionist/i, "Розгладжувальний засіб"],
  [/живлення/i, "Засіб для живлення"],
  [/догляд/i, "Засіб догляду"],
];

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia",
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[Ѐ-ӿ]/g, (c) => TRANSLIT[c] ?? "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const clean = (v: string) => v.replace(/\s+/g, " ").trim();
const upper = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : v);
const sentence = (v: string) => (/[.!?]$/.test(v) ? v : `${v}.`);

/** Notion writes some names in caps for emphasis; keep the wording, drop the shouting. */
const title = (v: string) =>
  upper(
    clean(v)
      .replace(/`/g, "’")
      .replace(/\p{Lu}{3,}/gu, (w) => w.toLowerCase()),
  );

/**
 * Split a description into distinct benefit phrases without inventing claims.
 * Insight writes full prose, so a clause still longer than a quiz option can
 * comfortably show is split again on its conjunctions.
 */
function benefitsOf(description: string): string[] {
  const parts = description
    .replace(/\.$/, "")
    .split(/[,;.]/)
    .flatMap((p) => (clean(p).length > 60 ? p.split(/\s(?:та|і|й)\s/) : [p]))
    .map((p) => upper(clean(p).replace(/^(та|і|й)\s+/i, "")))
    .filter((p) => p.length > 3 && p.length < 100);
  return parts.length
    ? [...new Set(parts)].slice(0, 5)
    : [upper(clean(description)).slice(0, 100)];
}

function splitList(raw: string): string[] {
  const segments = clean(raw).split(",");
  const last = segments.pop() ?? "";
  const all = [...segments, ...last.split(/\sта\s/)];
  return [...new Set(all.map((s) => upper(clean(s).replace(/\.$/, ""))).filter((s) => s.length > 2))];
}

const categoryOf = (name: string) =>
  categories.find(([re]) => re.test(name))?.[1] ?? "Засіб догляду";

function meta(name: string) {
  const hair = hairTypes[name];
  const purposes = linePurposes[name];
  if (!hair || !purposes)
    throw new Error(`${name}: додайте типи волосся та призначення у таблиці скрипта`);
  return { hair, purposes: purposes[0], keywords: purposes[1] };
}

const files = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
const heading = (raw: string) => raw.match(/^# (.+)$/m)?.[1].trim() ?? "";

// ---------------------------------------------------------------- milk_shake
/**
 * "Опис / Підходить для / Фото" header, then one "Name: description" paragraph per
 * product, then a single "Ключові інгредієнти" list shared by the whole line.
 */
function parseMilkShake(dir: string, brandId: string): Parsed {
  const out: Parsed = { lines: [], products: [], artwork: [] };
  const META = ["Опис", "Підходить для", "Фото", "Ключові інгредієнти"];

  for (const file of files(dir)) {
    const raw = readFileSync(join(dir, file), "utf8").replace(/\r/g, "");
    const name = heading(raw);
    if (!name) throw new Error(`${file}: немає заголовка`);

    const short = clean(raw.match(/^Опис:\s*([\s\S]*?)(?=\n(?:Підходить для|Фото):)/m)?.[1] ?? "");
    const photo = clean(raw.match(/^Фото:\s*(.+)$/m)?.[1] ?? "");
    const [head, ingredientsRaw = ""] = raw.split(/^Ключові інгредієнти:/m);
    const body = head.split(/^Фото:.*$/m)[1] ?? "";

    const paragraphs = body
      .split(/\n\s*\n/)
      .map(clean)
      .filter(Boolean)
      .filter((p) => !META.some((m) => p.startsWith(m + ":")));
    const prose = paragraphs.filter((p) => !/^[^:\n]{1,45}:/.test(p));
    const entries = paragraphs.filter((p) => /^[^:\n]{1,45}:/.test(p)).flatMap(entriesOf);

    const { hair, purposes, keywords } = meta(name);
    const lineId = slug(name);
    const ingredients = splitList(ingredientsRaw);
    if (!ingredients.length) throw new Error(`${name}: не знайдено інгредієнтів`);
    const lineBenefits = [...new Set(entries.flatMap((e) => benefitsOf(e.description)))].slice(0, 8);

    out.lines.push({
      id: lineId,
      brand_id: brandId,
      name,
      short_description: short,
      description: [short, ...prose].map(sentence).join(" "),
      hair_types: hair,
      purposes,
      benefits: lineBenefits.length ? lineBenefits : purposes,
      keywords,
      ...(photo ? { image: `/images/${brandId}/${lineId}.webp` } : {}),
    });

    for (const entry of entries) {
      const full = entry.name.toLowerCase().startsWith(name.toLowerCase())
        ? entry.name
        : `${name} ${entry.name}`;
      out.products.push({
        id: slug(`${lineId}-${entry.name}`),
        brand_id: brandId,
        line_id: lineId,
        name: full,
        category: categoryOf(entry.name),
        description: upper(entry.description),
        hair_types: hair,
        purpose: upper(entry.description.replace(/\.$/, "")),
        benefits: benefitsOf(entry.description),
        ingredients,
      });
    }
    if (photo) out.artwork.push([join(dir, decodeURIComponent(photo)), `${lineId}.webp`]);
  }
  return out;
}

/**
 * Read "Name: description" pairs out of one paragraph. Notion sometimes keeps two
 * products in a single block, so a second capitalised "Name:" that follows a real
 * description starts a new entry.
 */
function entriesOf(paragraph: string): { name: string; description: string }[] {
  const found: { name: string; description: string }[] = [];
  let remaining = paragraph;
  for (let guard = 0; guard < 10 && remaining; guard++) {
    const head = remaining.match(/^([^:\n]{1,45}):\s*([\s\S]*)$/);
    if (!head) break;
    const name = clean(head[1]);
    const rest = head[2];
    const next = rest.match(/\s([A-ZА-ЯЇІЄҐ][^:\n]{1,45}):\s/);
    if (next && next.index !== undefined && next.index > 15) {
      found.push({ name, description: clean(rest.slice(0, next.index)) });
      remaining = clean(rest.slice(next.index + 1));
    } else {
      found.push({ name, description: clean(rest) });
      break;
    }
  }
  return found.filter((e) => e.name && e.description);
}

// ------------------------------------------------------------------- Insight
/**
 * "Опис / Повний опис / Фото / ключові слова" header, then a numbered block per
 * product holding its own photo, description, active ingredients and sometimes
 * directions for use. Pages without any numbered product are brand copy, not lines.
 */
function parseInsight(dir: string, brandId: string): Parsed {
  const out: Parsed = { lines: [], products: [], artwork: [] };
  // The heading is misspelt "АКТИВНІІ" in Densifying and reads "КОМПОНЕНТИ" in Anti-frizz.
  // \w excludes Cyrillic, so the suffixes are spelled out explicitly.
  const INGREDIENTS =
    /^[ \t]*актив[а-яіїєґ]*[ \t]+(?:інгредієнт[а-яіїєґ]*|компонент[а-яіїєґ]*)[ \t]*:?[ \t]*$/im;
  const USAGE = /^[ \t]*спосіб\s+використання[ \t]*:?[ \t]*$/im;
  const PHOTO = /!\[[^\]]*\]\(([^)]+)\)/;

  for (const file of files(dir)) {
    const raw = readFileSync(join(dir, file), "utf8").replace(/\r/g, "");
    const name = heading(raw);
    const blocks = raw.split(/^1\. /m).slice(1);
    if (!name || !blocks.length) continue; // brand overview, instructions, empty page

    const header = raw.split(/^1\. /m)[0];
    const short = clean(header.match(/^Опис:\s*([\s\S]*?)(?=\n(?:Повний опис|Фото|ключові слова):)/mi)?.[1] ?? "");
    const long = clean(header.match(/^Повний опис:\s*([\s\S]*?)(?=\n(?:Фото|ключові слова):)/mi)?.[1] ?? "");
    const photo = clean(header.match(/^Фото:\s*(.+)$/mi)?.[1] ?? "");
    const keywordLine = clean(header.match(/^ключові слова:\s*([\s\S]*?)$/mi)?.[1] ?? "");

    const { hair, purposes, keywords } = meta(name);
    const lineId = slug(name);
    const fromExport = keywordLine
      .split("·")
      .map((k) => upper(clean(k).replace(/\.$/, "")))
      .filter((k) => k.length > 2)
      .slice(0, 12);

    out.lines.push({
      id: lineId,
      brand_id: brandId,
      name,
      short_description: short,
      description: [short, long].filter(Boolean).map(sentence).join(" "),
      hair_types: hair,
      purposes,
      benefits: benefitsOf(short),
      keywords: fromExport.length ? fromExport : keywords.length ? keywords : purposes,
      ...(photo ? { image: `/images/${brandId}/${lineId}.webp` } : {}),
    });
    if (photo) out.artwork.push([join(dir, decodeURIComponent(photo)), `${lineId}.webp`]);

    for (const block of blocks) {
      const [nameLine, ...bodyLines] = block.split("\n");
      const productName = title(nameLine);
      if (!productName) continue;
      const body = bodyLines.join("\n");
      const productPhoto = body.match(PHOTO)?.[1];

      const [beforeUsage, usageRaw = ""] = body.split(USAGE);
      const [descRaw, ingredientsRaw = ""] = beforeUsage.split(INGREDIENTS);
      const description = clean(descRaw.replace(PHOTO, "").replace(/!\[[^\]]*\]\([^)]+\)/g, ""));
      if (!description) continue;

      const ingredients = ingredientsRaw
        .split("\n")
        .map((l) => upper(clean(l.replace(/^[-*•]\s*/, "")).replace(/\.$/, "")))
        .filter((l) => l.length > 2);
      const productId = slug(`${lineId}-${productName}`);
      const usage = clean(usageRaw);

      out.products.push({
        id: productId,
        brand_id: brandId,
        line_id: lineId,
        name: `${name} ${productName}`,
        category: categoryOf(productName),
        description: sentence(upper(description)),
        hair_types: hair,
        purpose: upper(description.split(/(?<=[.!?])\s/)[0].replace(/\.$/, "")),
        benefits: benefitsOf(description),
        // Five lines list no ingredients per product; fall back to the line's own keywords.
        ingredients: ingredients.length ? ingredients : fromExport.slice(-1),
        ...(productPhoto ? { image: `/images/${brandId}/${productId}.webp` } : {}),
        ...(usage ? { usage } : {}),
      });
      if (productPhoto)
        out.artwork.push([join(dir, decodeURIComponent(productPhoto)), `${productId}.webp`]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------- main
const brand = brands[folder];
if (!brand) throw new Error(`Немає опису бренду для теки «${folder}»`);
const dir = join("notion-export", folder);
const parsed =
  folder === "Insight" ? parseInsight(dir, brand.id) : parseMilkShake(dir, brand.id);

const existing = JSON.parse(readFileSync("data/products.json", "utf8")) as Catalog;
const merged = catalogSchema.parse({
  brands: [...existing.brands.filter((b) => b.id !== brand.id), brand],
  lines: [...existing.lines.filter((l) => l.brand_id !== brand.id), ...parsed.lines],
  products: [...existing.products.filter((p) => p.brand_id !== brand.id), ...parsed.products],
} satisfies Catalog);

console.log(`${brand.name}: ${parsed.lines.length} лінійок, ${parsed.products.length} продуктів.`);
console.log(`Каталог разом: ${merged.brands.length} брендів, ${merged.lines.length} лінійок, ${merged.products.length} продуктів.`);
console.log(`Категорії: ${[...new Set(parsed.products.map((p) => p.category))].join(", ")}`);
console.log(`Унікальних інгредієнтів: ${new Set(parsed.products.flatMap((p) => p.ingredients)).size}`);
console.log(`Продуктів із фото: ${parsed.products.filter((p) => p.image).length}, зі способом застосування: ${parsed.products.filter((p) => p.usage).length}`);

if (write) {
  const target = join("public/images", brand.id);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  let bytes = 0;
  for (const [from, to] of parsed.artwork) {
    const result = await sharp(from)
      .resize({ width: 720, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(target, to));
    bytes += result.size;
  }
  writeFileSync("data/products.json", JSON.stringify(merged, null, 2) + "\n");
  console.log(`Зображень: ${parsed.artwork.length}, разом ${Math.round(bytes / 1024)} КБ у WebP.`);
  console.log("Записано data/products.json та public/images/.");
} else {
  console.log("Пробний запуск. Додайте --write, щоб зберегти.");
}
