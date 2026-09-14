/**
 * Convert a Notion export folder into the catalog JSON used by data/products.json.
 *
 * Usage: npx tsx scripts/import-notion.ts <brand-folder> [--write]
 *   e.g. npx tsx scripts/import-notion.ts milk_shake --write
 *
 * Each exported line page looks like:
 *   # Line name
 *   Опис: ...            Підходить для: ...      Фото: image 3.png
 *   Product name: one-line description          (repeated)
 *   Ключові інгредієнти: ...
 *
 * The export has no per-product hair types, ingredients or benefits, so:
 *   - hair types and purposes come from the curated tables below (the source
 *     field is free prose and in places lists actions rather than hair types),
 *   - ingredients are inherited from the line they belong to,
 *   - benefits are split out of the product's own description, never invented.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { catalogSchema, type Catalog, type Line, type Product } from "../shared/schema";

const brandFolder = process.argv[2];
const write = process.argv.includes("--write");
if (!brandFolder) throw new Error("Вкажіть теку бренду, напр.: milk_shake");

const brands: Record<string, { id: string; name: string; description: string }> = {
  milk_shake: {
    id: "milk-shake",
    name: "milk_shake",
    description:
      "Професійна італійська косметика для волосся від Z.One Concept. Догляд, стайлінг і тонування на основі молочних протеїнів, фруктових екстрактів та комплексу Integrity 41®.",
  },
};

/** Normalized hair-type vocabulary, mapped per line from the free-text «Підходить для». */
const hairTypes: Record<string, string[]> = {
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
};

/** Short purposes and memory keywords condensed from each line's own «Опис». */
const linePurposes: Record<string, [string[], string[]]> = {
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
  "Integrity & strength": [["Відновлення", "Зміцнення"], ["Цілісність", "Сила", "Амаранту"]],
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
};

/** Product category, resolved by the first matching token in the product name. */
const categories: [RegExp, string][] = [
  [/hairspray|лак/i, "Лак для волосся"],
  [/light shampoo/i, "Шампунь"],
  [/shampoo|шампун/i, "Шампунь"],
  [/leave[- ]?in|незмивн/i, "Незмивний догляд"],
  [/conditioner|кондиціонер/i, "Кондиціонер"],
  [/mask|маска/i, "Маска"],
  [/whipped cream|cream|крем/i, "Крем"],
  [/mousse|foam|пінка/i, "Пінка"],
  [/spray|спрей/i, "Спрей"],
  [/lotion|лосьйон/i, "Лосьйон"],
  [/fluid|флюїд/i, "Флюїд"],
  [/serum|сироватка/i, "Сироватка"],
  [/oil|олі[яй]/i, "Олія"],
  [/milk|молочко/i, "Молочко"],
  [/ампул/i, "Ампули"],
  [/кінчик/i, "Засіб для кінчиків"],
  [/живлення/i, "Засіб для живлення"],
  [/gel|гель/i, "Гель"],
  [/primer/i, "Праймер"],
  [/protector|термозахист/i, "Термозахисний засіб"],
  [/shaper/i, "Стайлінговий засіб"],
  [/potion/i, "Засіб для блиску"],
  [/perfectionist/i, "Розгладжувальний засіб"],
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

/** Split a description into distinct benefit phrases without inventing claims. */
function benefitsOf(description: string): string[] {
  const parts = description
    .replace(/\.$/, "")
    .split(/[,;]/)
    .map((p) => upper(clean(p).replace(/^та\s+/i, "")))
    .filter((p) => p.length > 3);
  return parts.length ? [...new Set(parts)].slice(0, 6) : [upper(clean(description))];
}

function ingredientsOf(raw: string): string[] {
  const segments = clean(raw).split(",");
  const last = segments.pop() ?? "";
  const all = [...segments, ...last.split(/\sта\s/)];
  return [...new Set(all.map((s) => upper(clean(s).replace(/\.$/, ""))).filter((s) => s.length > 2))];
}

function categoryOf(name: string): string {
  return categories.find(([re]) => re.test(name))?.[1] ?? "Засіб догляду";
}

/**
 * Read "Name: description" pairs out of one paragraph. Notion sometimes keeps two
 * products in a single block, so a second capitalised "Name:" that follows a real
 * description starts a new entry. A name containing no inner colon stays intact.
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

const dir = join("notion-export", brandFolder);
const brand = brands[brandFolder];
if (!brand) throw new Error(`Немає опису бренду для теки «${brandFolder}»`);

const lines: Line[] = [];
const products: Product[] = [];
const artwork: [string, string][] = [];
const META = ["Опис", "Підходить для", "Фото", "Ключові інгредієнти"];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
  const raw = readFileSync(join(dir, file), "utf8").replace(/\r/g, "");
  const title = raw.match(/^# (.+)$/m)?.[1].trim();
  if (!title) throw new Error(`${file}: немає заголовка`);

  const short = clean(raw.match(/^Опис:\s*([\s\S]*?)(?=\n(?:Підходить для|Фото):)/m)?.[1] ?? "");
  const photo = clean(raw.match(/^Фото:\s*(.+)$/m)?.[1] ?? "");
  // Ingredients close the page and can wrap onto later paragraphs, so split there first.
  const [head, ingredientsRaw = ""] = raw.split(/^Ключові інгредієнти:/m);
  const body = head.split(/^Фото:.*$/m)[1] ?? "";

  const paragraphs = body
    .split(/\n\s*\n/)
    .map(clean)
    .filter(Boolean)
    .filter((p) => !META.some((m) => p.startsWith(m + ":")));

  // Prose without a "Name:" prefix is line-level copy worth keeping in the description.
  const prose = paragraphs.filter((p) => !/^[^:\n]{1,45}:/.test(p));
  const entries = paragraphs
    .filter((p) => /^[^:\n]{1,45}:/.test(p))
    .flatMap(entriesOf);

  const hair = hairTypes[title];
  const meta = linePurposes[title];
  if (!hair || !meta) throw new Error(`${title}: додайте типи волосся та призначення у таблиці скрипта`);

  const lineId = slug(title);
  const lineBenefits = [
    ...new Set(entries.flatMap((e) => benefitsOf(e.description))),
  ].slice(0, 8);
  const ingredients = ingredientsOf(ingredientsRaw);
  if (!ingredients.length) throw new Error(`${title}: не знайдено інгредієнтів`);

  lines.push({
    id: lineId,
    brand_id: brand.id,
    name: title,
    short_description: short,
    description: [short, ...prose]
      .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`))
      .join(" "),
    hair_types: hair,
    purposes: meta[0],
    benefits: lineBenefits.length ? lineBenefits : meta[0],
    keywords: meta[1],
    ...(photo ? { image: `/images/${lineId}.webp` } : {}),
  });

  for (const { name, description } of entries) {
    const full = name.toLowerCase().startsWith(title.toLowerCase())
      ? name
      : `${title} ${name}`;
    products.push({
      id: slug(`${lineId}-${name}`),
      brand_id: brand.id,
      line_id: lineId,
      name: full,
      category: categoryOf(name),
      description: upper(description),
      hair_types: hair,
      purpose: upper(description.replace(/\.$/, "")),
      benefits: benefitsOf(description),
      ingredients,
    });
  }

  if (photo) artwork.push([join(dir, decodeURIComponent(photo)), `${lineId}.webp`]);
}

// Lineup shots arrive as ~400 KB PNGs; the catalog renders every line at once.
if (write && artwork.length) {
  mkdirSync("public/images", { recursive: true });
  let bytes = 0;
  for (const [from, to] of artwork) {
    const out = await sharp(from)
      .resize({ width: 720, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join("public/images", to));
    bytes += out.size;
  }
  console.log(`Зображень: ${artwork.length}, разом ${Math.round(bytes / 1024)} КБ у WebP.`);
}

// Keep every other brand already in the catalog untouched.
const existing = JSON.parse(readFileSync("data/products.json", "utf8")) as Catalog;
const merged = catalogSchema.parse({
  brands: [...existing.brands.filter((b) => b.id !== brand.id), brand],
  lines: [...existing.lines.filter((l) => l.brand_id !== brand.id), ...lines],
  products: [...existing.products.filter((p) => p.brand_id !== brand.id), ...products],
} satisfies Catalog);

console.log(`${brand.name}: ${lines.length} лінійок, ${products.length} продуктів.`);
console.log(`Каталог разом: ${merged.brands.length} брендів, ${merged.lines.length} лінійок, ${merged.products.length} продуктів.`);
console.log(`Категорії: ${[...new Set(products.map((p) => p.category))].join(", ")}`);
console.log(`Типи волосся: ${[...new Set(products.flatMap((p) => p.hair_types))].join(", ")}`);
console.log(`Унікальних інгредієнтів: ${new Set(products.flatMap((p) => p.ingredients)).size}`);

if (write) {
  writeFileSync("data/products.json", JSON.stringify(merged, null, 2) + "\n");
  console.log("Записано data/products.json та public/images/.");
} else {
  console.log("Пробний запуск. Додайте --write, щоб зберегти.");
}
