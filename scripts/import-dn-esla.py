from __future__ import annotations

import io
import json
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / ".tmp" / "source-analysis"
PPTX = Path(r"D:\Загрузки\ESLA ITALY PRODUCT KNOWLEDGE 2026 UA (1) (1).pptx")
FORCE_IMAGES = False


def clean(value: str) -> str:
    value = value.replace("Cпрей", "Спрей").replace("Сиворотка", "Сироватка")
    value = value.replace("Лосьон", "Лосьйон")
    value = value.replace("очищує", "очищає")
    value = value.replace(
        "збагачена ферментованою зеленою кавою та глюконат натрію",
        "збагачена ферментованою зеленою кавою та глюконатом натрію",
    )
    value = value.replace("маслом ши", "олією ши")
    return re.sub(r"\s+", " ", value).strip()


def slug(value: str) -> str:
    value = value.lower().replace("’", "-").replace("'", "-")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def save_webp(content: bytes, output: Path, max_size: int = 1400) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and output.stat().st_size > 0 and not FORCE_IMAGES:
        return
    with Image.open(io.BytesIO(content)) as source:
        source.load()
        image = source.copy()
    rgba = image.convert("RGBA")
    alpha_box = rgba.getchannel("A").getbbox()
    if alpha_box and alpha_box != (0, 0, rgba.width, rgba.height):
        box = alpha_box
    else:
        rgb = rgba.convert("RGB")
        difference = ImageChops.difference(rgb, Image.new("RGB", rgb.size, "white"))
        mask = difference.convert("L").point(lambda value: 255 if value > 12 else 0)
        box = mask.getbbox()
    if box:
        left, top, right, bottom = box
        padding = max(12, int(max(right - left, bottom - top) * 0.05))
        expanded = (
            max(0, left - padding),
            max(0, top - padding),
            min(rgba.width, right + padding),
            min(rgba.height, bottom + padding),
        )
        if (expanded[2] - expanded[0]) * (expanded[3] - expanded[1]) < rgba.width * rgba.height * 0.9:
            image = rgba.crop(expanded)
    if image.width > max_size or image.height > max_size:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
    image.save(output, "WEBP", quality=92, method=6)


def category_lead(category: str) -> str:
    category = category.lower()
    if "шампун" in category:
        return "Делікатно очищає"
    if "кондиціон" in category:
        return "Полегшує розчісування"
    if "маск" in category:
        return "Забезпечує інтенсивний догляд"
    if "скраб" in category or "прешамп" in category:
        return "Готує шкіру голови до очищення"
    if "мус" in category:
        return "Забезпечує легке кондиціонування"
    if "спрей" in category or "флюїд" in category:
        return "Забезпечує незмивний догляд"
    if "сироват" in category or "еліксир" in category or "лосьйон" in category:
        return "Забезпечує концентрований догляд"
    if "крем" in category:
        return "Допомагає сформувати укладку"
    if "олія" in category:
        return "Живить і додає блиску"
    return "Доповнює професійний догляд"


def purpose_for(category: str, line: dict[str, object]) -> str:
    action = {
        "Шампунь": "Очищення",
        "Кондиціонер": "Кондиціонування",
        "Маска": "Інтенсивний догляд",
        "Спрей": "Незмивний догляд",
        "Сироватка": "Концентрований догляд",
        "Еліксир": "Незмивний догляд",
        "Лосьйон": "Концентрований догляд",
        "Флюїд": "Підготовчий догляд",
        "Скраб": "Глибоке очищення шкіри голови",
        "Мус": "Легке кондиціонування",
        "Крем": "Формування та контроль укладки",
        "Олія-сироватка": "Фінішний догляд",
    }.get(category, category)
    return f"{action}: {str(line['purposes'][0]).lower()}"


LINE_DEFS = [
    ("lucent-color", "Lucent Color", "Збереження кольору та зволоження фарбованого волосся", ["Фарбоване", "Натуральне", "Сухе"], ["Збереження насиченості кольору", "Зволоження"], ["Підтримує колір", "Надає блиску", "Допомагає зберігати м’якість"], ["колір", "зелена кава", "зволоження"], ["Ферментована зелена кава", "Глюконат натрію", "Олія жожоба"]),
    ("hydra-special", "Hydra Special", "Тривале зволоження сухого та ламкого волосся", ["Нормальне", "Сухе", "Ламке", "Жорстке"], ["Тривале зволоження", "Пом’якшення"], ["Підтримує вологу", "Надає м’якості", "Підсилює блиск"], ["волога", "м’якість", "манна"], ["Фітокомплекс Манна з гір Мадоні", "Масло ши"]),
    ("repair-prestige", "Repair Prestige", "Відновлення та захист пошкодженого волосся", ["Пошкоджене", "Дуже пошкоджене", "Ламке"], ["Відновлення пошкодженого волосся", "Захист від зовнішніх факторів"], ["Сприяє відновленню", "Зміцнює полотно волосся", "Захищає від пошкоджень"], ["відновлення", "протеїни", "захист"], ["Repair-Care Tech", "Біотехнологічні компоненти грибів", "Веганські протеїни"]),
    ("frizz-dominator", "Frizz Dominator", "Розгладження та контроль пухнастого волосся", ["Пухнасте", "Жорстке", "Неслухняне"], ["Контроль пухнастості", "Захист від вологості"], ["Розгладжує", "Полегшує укладання", "Захищає від вологості"], ["гладкість", "фітокератин", "вологість"], ["Фітокератин із конопель і рису", "Рослинні полімери", "Олія жожоба"]),
    ("volume-supreme", "Volume Supreme", "Об’єм і густота для тонкого волосся", ["Тонке", "Позбавлене об’єму"], ["Надання об’єму", "Збільшення відчуття густоти"], ["Додає об’єму", "Надає щільності", "Не обтяжує"], ["об’єм", "густота", "липа"], ["Екстракт бруньок липи", "Катіонний кополімер протеїнів пшениці"]),
    ("curl-couture", "Curl Couture", "Пружні, окреслені локони без пухнастості", ["Кучеряве", "Хвилясте", "Пухнасте"], ["Формування локонів", "Контроль пухнастості"], ["Підкреслює форму локонів", "Надає м’якості", "Зменшує пухнастість"], ["локони", "пружність", "баобаб"], ["Колаген баобаба", "Гідролізована кіноа", "Екстракт бамбука"]),
    ("daily", "Daily", "Щоденний догляд, адаптований до товщини волосся", ["Тонке", "Середньої товщини", "Густе", "Усі типи волосся"], ["Щоденне очищення та догляд", "Підготовка до укладання"], ["Підтримує м’якість", "Надає природного блиску", "Допомагає контролювати пухнастість"], ["щодня", "товщина волосся", "блиск"], ["Екстракт лимона", "Олія жожоба", "Екстракт бурих водоростей", "Олія вечірньої примули", "Екстракт гороху"]),
    ("calming", "Calming", "Заспокійливий догляд для чутливої шкіри голови", ["Чутлива шкіра голови", "Подразнена шкіра голови"], ["Заспокоєння шкіри голови", "Зменшення відчуття дискомфорту"], ["Заспокоює", "Підтримує захисний бар’єр", "Допомагає зберігати зволоження"], ["комфорт", "чутливість", "albatrellus"], ["Компоненти гриба Albatrellus", "Фітостероли Brassica"]),
    ("sebum-controller", "Sebum Controller", "Контроль себуму та свіжість жирної шкіри голови", ["Жирна шкіра голови", "Схильне до жирності"], ["Контроль надмірної жирності", "Тривале відчуття чистоти"], ["Абсорбує надлишок себуму", "Не обтяжує", "Подовжує свіжість"], ["себум", "свіжість", "баланс"], ["Біотехнологічний компонент морського походження", "Абсорбувальні порошки"]),
    ("detox", "Detox", "Очищення шкіри голови, схильної до лущення", ["Схильна до лущення шкіра голови", "Суха лупа", "Жирна лупа"], ["Профілактика видимого лущення", "Глибоке очищення"], ["Очищає шкіру голови", "Допомагає зменшити лущення", "Надає відчуття свіжості"], ["детокс", "лущення", "свіжість"], ["Піроктон оламін", "Олія розмарину", "Гранули ліщини та мигдалю"]),
    ("energy", "Energy", "Зміцнювальний догляд для ослабленого волосся", ["Слабке", "Ламке", "Схильне до стоншення", "Чутлива шкіра голови"], ["Зміцнення ослабленого волосся", "Підтримка густоти"], ["Надає життєвої сили", "Допомагає протидіяти стоншенню", "Підтримує шкіру голови"], ["енергія", "густота", "грейпфрут"], ["Флавоноїд грейпфрута", "Метаболіт листя оливи", "Пептид", "Кофеїн", "Ніацинамід"]),
    ("blonde-care", "Blonde Care", "Нейтралізація жовтих і помаранчевих відтінків блонду", ["Освітлене", "Блонд", "Сиве", "Меліроване"], ["Нейтралізація небажаних відтінків", "Догляд за освітленим волоссям"], ["Коригує теплі відтінки", "Надає м’якості", "Підсилює блиск"], ["блонд", "пігмент", "нейтралізація"], ["Фруктові кислоти", "Екстракт чорниці", "Фіолетовий пігмент", "Синій пігмент"]),
]


PRODUCT_DEFS = [
    (19, "lucent-color", "lucent-color-shampoo", "Lucent Color Шампунь", "Шампунь"),
    (20, "lucent-color", "lucent-color-conditioner", "Lucent Color Кондиціонер", "Кондиціонер"),
    (21, "lucent-color", "lucent-color-mask", "Lucent Color Маска", "Маска"),
    (31, "hydra-special", "hydra-special-shampoo", "Hydra Special Шампунь", "Шампунь"),
    (32, "hydra-special", "hydra-special-conditioner", "Hydra Special Кондиціонер", "Кондиціонер"),
    (33, "hydra-special", "hydra-special-mask", "Hydra Special Маска", "Маска"),
    (34, "hydra-special", "hydra-special-serum", "Hydra Special Сироватка", "Сироватка"),
    (50, "repair-prestige", "repair-prestige-shampoo", "Repair Prestige Шампунь", "Шампунь"),
    (51, "repair-prestige", "repair-prestige-spray", "Repair Prestige Відновлювальний спрей", "Спрей"),
    (52, "repair-prestige", "repair-prestige-conditioner", "Repair Prestige Кондиціонер", "Кондиціонер"),
    (53, "repair-prestige", "repair-prestige-mask", "Repair Prestige Маска", "Маска"),
    (54, "repair-prestige", "repair-prestige-thermal-spray", "Repair Prestige Термозахисний спрей", "Спрей"),
    (55, "repair-prestige", "repair-prestige-oil-serum", "Repair Prestige Олія-сироватка", "Олія-сироватка"),
    (72, "frizz-dominator", "frizz-dominator-shampoo", "Frizz Dominator Шампунь", "Шампунь"),
    (73, "frizz-dominator", "frizz-dominator-mask", "Frizz Dominator Маска", "Маска"),
    (74, "frizz-dominator", "frizz-dominator-spray", "Frizz Dominator Спрей", "Спрей"),
    (75, "frizz-dominator", "frizz-dominator-serum", "Frizz Dominator Сироватка", "Сироватка"),
    (85, "volume-supreme", "volume-supreme-shampoo", "Volume Supreme Шампунь", "Шампунь"),
    (86, "volume-supreme", "volume-supreme-elixir", "Volume Supreme Еліксир", "Еліксир"),
    (95, "curl-couture", "curl-couture-shampoo", "Curl Couture Shampoo", "Шампунь"),
    (96, "curl-couture", "curl-couture-conditioner", "Curl Couture Conditioner", "Кондиціонер"),
    (97, "curl-couture", "curl-couture-mask", "Curl Couture Mask", "Маска"),
    (98, "curl-couture", "curl-couture-perfecting-cream", "Curl Couture Perfecting Cream", "Крем"),
    (107, "daily", "daily-fine-hair-shampoo", "Daily Fine Hair Шампунь", "Шампунь"),
    (108, "daily", "daily-fine-hair-conditioner", "Daily Fine Hair Кондиціонер", "Кондиціонер"),
    (109, "daily", "style-elite-shine-lotion", "Style Elite Лосьйон для блиску", "Лосьйон"),
    (110, "daily", "style-elite-multifunctional-mousse", "Style Elite Багатофункціональний мус", "Мус"),
    (111, "daily", "style-elite-multifunctional-serum", "Style Elite Багатофункціональна сироватка", "Сироватка"),
    (112, "daily", "daily-thick-hair-shampoo", "Daily Thick Hair Шампунь", "Шампунь"),
    (113, "daily", "daily-thick-hair-mask", "Daily Thick Hair Маска", "Маска"),
    (114, "daily", "daily-multifunctional-spray-fluid", "Daily Багатофункціональний спрей-флюїд", "Спрей"),
    (121, "calming", "calming-pre-shampoo-fluid", "Calming Флюїд-прешампунь", "Флюїд"),
    (122, "calming", "calming-shampoo", "Calming Шампунь", "Шампунь"),
    (123, "calming", "calming-elixir", "Calming Заспокійливий еліксир", "Еліксир"),
    (133, "sebum-controller", "sebum-controller-pre-shampoo", "Sebum Controller Флюїд-прешампунь", "Флюїд"),
    (134, "sebum-controller", "sebum-controller-shampoo", "Sebum Controller Шампунь", "Шампунь"),
    (147, "detox", "detox-scalp-scrub", "Detox Скраб для шкіри голови", "Скраб"),
    (148, "detox", "detox-shampoo", "Detox Шампунь", "Шампунь"),
    (158, "energy", "energy-shampoo", "Energy Тонізувальний шампунь", "Шампунь"),
    (159, "energy", "energy-lotion", "Energy Тонізувальний лосьйон", "Лосьйон"),
    (169, "blonde-care", "blonde-care-purple-shampoo", "Purple Shampoo", "Шампунь"),
    (170, "blonde-care", "blonde-care-purple-mask", "Purple Hydrating Mask", "Маска"),
    (171, "blonde-care", "blonde-care-purple-mousse", "Purple Conditioning Mousse", "Мус"),
    (172, "blonde-care", "blonde-care-blue-mousse", "Blue Conditioning Mousse", "Мус"),
]


ENGLISH_OVERRIDES = {
    95: ("М’яко очищає, підкреслює природну форму хвиль і локонів та допомагає зменшити пухнастість.", "Нанести на вологе волосся, спінити масажними рухами та ретельно змити. За потреби повторити."),
    96: ("Кондиціонує кучеряве волосся, надає м’якості, полегшує розчісування та підтримує форму локонів.", "Нанести на чисте вологе волосся, залишити на кілька хвилин і ретельно змити."),
    97: ("Інтенсивно пом’якшує кучеряве волосся, робить локони слухнянішими та допомагає контролювати пухнастість.", "Нанести після шампуню на вологе волосся, залишити на 10–15 хвилин і змити. Використовувати 1–2 рази на тиждень."),
    98: ("Незмивний крем надає локонам чіткішої форми, м’якості та допомагає контролювати пухнастість.", "Нанести на чисте вологе волосся та виконати укладання. На сухому волоссі можна використовувати як фінішний засіб."),
    169: ("Фіолетовий шампунь із фруктовими кислотами й екстрактом чорниці нейтралізує небажані жовті відтінки та підтримує м’якість освітленого волосся.", "Нанести на вологе волосся, рівномірно розподілити й помасажувати. Залишити до бажаного рівня нейтралізації та ретельно змити."),
    170: ("Зволожувальна маска з фіолетовим пігментом нейтралізує жовті відтінки та залишає освітлене волосся м’яким і доглянутим.", "Нанести потрібну кількість, залишити до 5 хвилин, прочесати та ретельно змити. Після Purple Shampoo ефект нейтралізації посилюється."),
    171: ("Фіолетовий кондиціонувальний мус коригує жовті відтінки освітленого або мелірованого волосся, надає м’якості й блиску.", "Після миття нанести на довжину та кінчики, залишити на 1–5 хвилин залежно від бажаного результату й змити."),
    172: ("Синій кондиціонувальний мус нейтралізує небажані помаранчеві відтінки на волоссі середнього та світлого рівня тону.", "Після миття нанести на довжину та кінчики, залишити на 1–5 хвилин залежно від бажаного результату й змити."),
}


SUMMARY_SLIDES = {"lucent-color": 24, "hydra-special": 37, "repair-prestige": 64, "frizz-dominator": 78, "volume-supreme": 89, "curl-couture": 100, "daily": 116, "calming": 127, "sebum-controller": 138, "detox": 152, "energy": 163, "blonde-care": 175}


def parse_slide(shape: str, number: int) -> tuple[str, str]:
    if number in ENGLISH_OVERRIDES:
        return ENGLISH_OVERRIDES[number]
    marker = "СПОСІБ ЗАСТОСУВАННЯ:"
    before, _, usage = shape.partition(marker)
    parts = [clean(part) for part in before.splitlines() if clean(part)]
    description = clean(" ".join(parts[3:]))
    if not description and parts:
        description = parts[-1]
    if number == 34:
        usage = "Нанести на чисте вологе волосся по довжині та на кінчики, залишити на кілька хвилин, після чого ретельно змити."
    usage = clean(usage)
    return description, usage[:1].upper() + usage[1:]


def build_esla() -> dict[str, list[dict[str, object]]]:
    presentation = json.loads((ANALYSIS / "presentation.json").read_text(encoding="utf-8"))
    slides = {slide["number"]: slide for slide in presentation["slides"]}
    lines = []
    line_map = {}
    for item in LINE_DEFS:
        key, name, short, hair, purposes, benefits, keywords, ingredients = item
        line = {
            "id": f"esla-{key}", "brand_id": "esla", "name": name,
            "short_description": short,
            "description": f"Професійна лінійка ESLA Italy для потреби «{purposes[0].lower()}». Формули поєднують цілеспрямований догляд, сучасні активні компоненти та комфортне застосування.",
            "hair_types": hair, "purposes": purposes, "benefits": benefits,
            "keywords": keywords, "image": f"/images/esla/esla-{key}.webp",
        }
        lines.append(line)
        line_map[key] = (line, ingredients)
    products = []
    with zipfile.ZipFile(PPTX) as archive:
        for number, line_key, product_key, name, category in PRODUCT_DEFS:
            slide = slides[number]
            shape = max(slide["shapes"], key=len)
            description, usage = parse_slide(shape, number)
            line, ingredients = line_map[line_key]
            media = next(value for value in slide["media"] if value != "ppt/media/image4.png")
            output = ROOT / "public" / "images" / "esla" / f"esla-{product_key}.webp"
            save_webp(archive.read(media), output)
            products.append({
                "id": f"esla-{product_key}", "brand_id": "esla", "line_id": line["id"],
                "name": name, "category": category, "description": description,
                "hair_types": line["hair_types"], "purpose": purpose_for(category, line),
                "benefits": [category_lead(category), *line["benefits"][:2]],
                "ingredients": ingredients, "image": f"/images/esla/esla-{product_key}.webp",
                "usage": usage,
            })
        for key, slide_number in SUMMARY_SLIDES.items():
            slide = slides[slide_number]
            media = next(value for value in slide["media"] if value != "ppt/media/image4.png")
            save_webp(archive.read(media), ROOT / "public" / "images" / "esla" / f"esla-{key}.webp")
    return {
        "brands": [{"id": "esla", "name": "ESLA Italy", "description": "Італійський професійний бренд догляду за волоссям, що поєднує сучасні дослідження, високоефективні веганські формули та відповідальний підхід до виробництва. Продукти розроблено й виготовлено в Італії."}],
        "lines": lines, "products": products,
    }


DN_LINES = [
    ("everyday-balancing", "Everyday Balancing", "Щоденне очищення, зволоження та свіжість", ["Усі типи волосся"], ["Щоденний збалансований догляд", "Зволоження"], ["М’яко очищає", "Підтримує життєву силу", "Надає свіжості"], ["баланс", "щодня", "свіжість"], 8, ["Олія авокадо", "Олія лугового пінника", "7 Fusion complex"]),
    ("intense-hydrating", "Intense Hydrating", "Інтенсивне зволоження сухого та пошкодженого волосся", ["Сухе", "Пошкоджене", "Ламке"], ["Глибоке зволоження", "Відновлення м’якості"], ["Насичує вологою", "Робить волосся гладеньким", "Повертає доглянутий вигляд"], ["волога", "м’якість", "відновлення"], 9, ["Олія авокадо", "Олія лугового пінника", "Гідролізований рослинний протеїн"]),
    ("full-bodied-volumising", "Full-Bodied Volumising", "Об’єм і пружність для тонкого волосся", ["Тонке", "Позбавлене об’єму"], ["Надання об’єму", "Візуальна густота"], ["Додає пишності", "Підтримує пружність", "Не обтяжує"], ["об’єм", "густота", "пружність"], 10, ["Гідролізований рослинний протеїн", "Олія авокадо", "7 Fusion complex"]),
    ("anti-frizz-smoothing", "Anti-Frizz Smoothing", "Розгладження та контроль пухнастого волосся", ["Пухнасте", "Неслухняне", "Сухе"], ["Контроль пухнастості", "Розгладження"], ["Пом’якшує", "Надає блиску", "Робить волосся слухнянішим"], ["гладкість", "контроль", "блиск"], 11, ["Олія авокадо", "Естери жожоба", "Олія лугового пінника"]),
    ("blonde-toning", "Blonde Toning", "Нейтралізація жовтих відтінків світлого волосся", ["Блонд", "Освітлене", "Сиве"], ["Нейтралізація жовтизни", "Підтримка холодного відтінку"], ["Освіжає блонд", "Зволожує", "Надає сяйва"], ["блонд", "фіолетовий пігмент", "холодний відтінок"], 13, ["Фіолетовий пігмент", "Олія авокадо", "Олія лугового пінника"]),
    ("scalp-clearing", "Scalp Clearing", "Заспокоєння сухої та схильної до лущення шкіри голови", ["Суха шкіра голови", "Схильна до лущення шкіра голови", "Чутлива шкіра голови"], ["Зменшення дискомфорту шкіри голови", "Очищення від лущення"], ["Допомагає усунути лупу", "Заспокоює свербіж", "Підтримує баланс"], ["шкіра голови", "лущення", "комфорт"], 12, ["Піроктон оламін", "Олія авокадо", "7 Fusion complex"]),
    ("care-collection", "Care Collection", "Додатковий зволожувальний, захисний і незмивний догляд", ["Сухе", "Пошкоджене", "Сплутане", "Усі типи волосся"], ["Додатковий догляд", "Захист і полегшення розчісування"], ["Зволожує", "Полегшує розчісування", "Захищає довжину"], ["догляд", "захист", "м’якість"], 14, ["Олія авокадо", "Олія лугового пінника", "7 Fusion complex"]),
    ("styling", "Styling", "Формування текстури, локонів і контроль укладки", ["Кучеряве", "Хвилясте", "Усі типи волосся"], ["Створення укладки", "Формування локонів і текстури"], ["Допомагає контролювати форму", "Підкреслює текстуру", "Зберігає природний рух"], ["стайлінг", "текстура", "локони"], 20, ["Олія авокадо", "Рослинні протеїни", "7 Fusion complex"]),
]


DN_PRODUCTS = [
    (2, "everyday-balancing", "everyday-balancing-shampoo", "Everyday Balancing Shampoo", "Шампунь", 8, 3),
    (4, "everyday-balancing", "everyday-balancing-conditioner", "Everyday Balancing Conditioner", "Кондиціонер", 8, 2),
    (6, "intense-hydrating", "intense-hydrating-shampoo", "Intense Hydrating Shampoo", "Шампунь", 9, 3),
    (7, "intense-hydrating", "intense-hydrating-conditioner", "Intense Hydrating Conditioner", "Кондиціонер", 9, 2),
    (8, "full-bodied-volumising", "full-bodied-volumising-shampoo", "Full-Bodied Volumising Shampoo", "Шампунь", 10, 3),
    (9, "full-bodied-volumising", "full-bodied-volumising-conditioner", "Full-Bodied Volumising Conditioner", "Кондиціонер", 10, 2),
    (10, "anti-frizz-smoothing", "anti-frizz-smoothing-shampoo", "Anti-Frizz Smoothing Shampoo", "Шампунь", 11, 3),
    (11, "anti-frizz-smoothing", "anti-frizz-smoothing-conditioner", "Anti-Frizz Smoothing Conditioner", "Кондиціонер", 11, 2),
    (12, "blonde-toning", "blonde-toning-shampoo", "Blonde Toning Shampoo", "Шампунь", 13, 3),
    (13, "blonde-toning", "blonde-toning-conditioner", "Blonde Toning Conditioner", "Кондиціонер", 13, 2),
    (14, "scalp-clearing", "scalp-clearing-shampoo", "Scalp Clearing Shampoo", "Шампунь", 12, 3),
    (15, "care-collection", "moisture-mask", "Moisture Mask", "Маска", 15, 2),
    (17, "care-collection", "detangler-thermal-protection", "Detangler with Thermal Protection", "Спрей", 18, 3),
    (18, "care-collection", "defender-leave-in-conditioner", "Defender Leave In Conditioner", "Кондиціонер", 16, 2),
    (19, "care-collection", "ends-sealer-leave-in-treatment", "Ends Sealer Leave In Treatment", "Крем", 17, 3),
    (20, "styling", "form-hybrid-styling-lotion", "Form Hybrid Styling Lotion", "Лосьйон", 22, 4),
    (21, "styling", "curl-cream", "Curl Cream", "Крем", 21, 3),
]


def build_dn() -> dict[str, list[dict[str, object]]]:
    rows = json.loads((ANALYSIS / "specification.json").read_text(encoding="utf-8"))["Лист1"]
    rows = {row["row"]: row["values"] for row in rows}
    line_map = {}
    lines = []
    images_dir = ANALYSIS / "brochure-images"
    for key, name, short, hair, purposes, benefits, keywords, page, ingredients in DN_LINES:
        line = {
            "id": f"daily-naturals-{key}", "brand_id": "daily-naturals", "name": name,
            "short_description": short,
            "description": f"Лінійка Daily Naturals для потреби «{purposes[0].lower()}». Професійні формули Clean Beauty підтримують здоровий вигляд волосся та поєднують ефективність із комфортним щоденним доглядом.",
            "hair_types": hair, "purposes": purposes, "benefits": benefits,
            "keywords": keywords, "image": f"/images/daily-naturals/daily-naturals-{key}.webp",
        }
        source = next(images_dir.glob(f"page-{page:02d}-0.*"))
        save_webp(source.read_bytes(), ROOT / "public" / "images" / "daily-naturals" / f"daily-naturals-{key}.webp")
        lines.append(line)
        line_map[key] = (line, ingredients)
    products = []
    for row_number, line_key, product_key, name, category, page, image_index in DN_PRODUCTS:
        values = rows[row_number]
        line, ingredients = line_map[line_key]
        usage = clean(str(values[5])).capitalize()
        line_result = line["benefits"][0].lower()
        description = f"{category_lead(category)} та {line_result}. Формула підтримує доглянутий вигляд волосся й доповнює систему {line['name']}."
        source = next(images_dir.glob(f"page-{page:02d}-{image_index}.*"))
        output = ROOT / "public" / "images" / "daily-naturals" / f"daily-naturals-{product_key}.webp"
        save_webp(source.read_bytes(), output)
        products.append({
            "id": f"daily-naturals-{product_key}", "brand_id": "daily-naturals", "line_id": line["id"],
            "name": name, "category": category, "description": description,
            "hair_types": line["hair_types"], "purpose": purpose_for(category, line),
            "benefits": [category_lead(category), *line["benefits"][:2]],
            "ingredients": ingredients, "image": f"/images/daily-naturals/daily-naturals-{product_key}.webp",
            "usage": usage,
        })
    return {
        "brands": [{"id": "daily-naturals", "name": "Daily Naturals", "description": "Австралійський професійний бренд Clean Beauty із веганськими формулами салонної якості. Засоби орієнтовані на результативний догляд, турботу про здоров’я волосся та відповідальніший вплив на довкілля."}],
        "lines": lines, "products": products,
    }


def update_image_sources() -> None:
    path = ROOT / "data" / "image-sources.json"
    registry = json.loads(path.read_text(encoding="utf-8"))
    registry["checked_on"] = "2026-10-12"
    registry["sources"] = [
        source
        for source in registry["sources"]
        if source.get("brand") not in ("Daily Naturals", "ESLA Italy")
    ]

    def add(brand: str, kind: str, item_id: str, source: str, image_path: str) -> None:
        local = ROOT / "public" / image_path.lstrip("/")
        with Image.open(local) as image:
            width, height = image.size
        registry["sources"].append(
            {
                "brand": brand,
                "type": kind,
                "id": item_id,
                "page": source,
                "image": image_path,
                "width": width,
                "height": height,
            }
        )

    for key, _, _, _, _, _, _, page, _ in DN_LINES:
        add(
            "Daily Naturals",
            "line",
            f"daily-naturals-{key}",
            f"DN -брошура 0826.pdf, page {page}",
            f"/images/daily-naturals/daily-naturals-{key}.webp",
        )
    for row, _, key, _, _, page, _ in DN_PRODUCTS:
        add(
            "Daily Naturals",
            "product",
            f"daily-naturals-{key}",
            f"специфікація.xlsx, row {row}; DN -брошура 0826.pdf, page {page}",
            f"/images/daily-naturals/daily-naturals-{key}.webp",
        )
    for key, slide in SUMMARY_SLIDES.items():
        add(
            "ESLA Italy",
            "line",
            f"esla-{key}",
            f"ESLA ITALY PRODUCT KNOWLEDGE 2026 UA.pptx, slide {slide}",
            f"/images/esla/esla-{key}.webp",
        )
    for slide, _, key, _, _ in PRODUCT_DEFS:
        add(
            "ESLA Italy",
            "product",
            f"esla-{key}",
            f"ESLA ITALY PRODUCT KNOWLEDGE 2026 UA.pptx, slide {slide}",
            f"/images/esla/esla-{key}.webp",
        )
    path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    global PPTX, FORCE_IMAGES
    arguments = [argument for argument in sys.argv[1:] if argument != "--force"]
    FORCE_IMAGES = "--force" in sys.argv[1:]
    if arguments:
        PPTX = Path(arguments[0])
    if not PPTX.exists():
        raise SystemExit(f"PPTX not found: {PPTX}")
    dn = build_dn()
    esla = build_esla()
    for name, catalog in (("daily-naturals", dn), ("esla", esla)):
        output = ROOT / "deliverables" / name
        output.mkdir(parents=True, exist_ok=True)
        (output / "catalog-update.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        manifest = [{"id": product["id"], "image": product["image"]} for product in catalog["products"]]
        (output / "image-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    current = json.loads((ROOT / "data" / "products.json").read_text(encoding="utf-8"))
    incoming = {key: [*dn[key], *esla[key]] for key in ("brands", "lines", "products")}
    for key in incoming:
        ids = {item["id"] for item in incoming[key]}
        current[key] = [item for item in current[key] if item["id"] not in ids] + incoming[key]
    (ROOT / "data" / "products.json").write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    update_image_sources()
    print(f"Imported {len(incoming['brands'])} brands, {len(incoming['lines'])} lines and {len(incoming['products'])} products.")


if __name__ == "__main__":
    main()
