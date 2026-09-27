"""Build milk_shake line artwork from exact product cutouts embedded in a PDF.

Usage:
    py -3 scripts/import-milkshake-pdf.py "path/to/presentation.pdf"

Requires pypdf and Pillow. The PDF layout is not rasterized: product PNGs are
read directly from the Canva export and composed without recreating labels.
"""

from __future__ import annotations

import argparse
from io import BytesIO
import json
from pathlib import Path
import time

from PIL import Image, ImageChops
from pypdf import PdfReader


LINE_ASSETS: dict[str, tuple[int, tuple[str, ...]]] = {
    "make-my-day": (2, ("X7.png", "X9.png", "X11.png")),
    "incredible": (3, ("X15.png", "X17.png", "X19.png")),
    "leave-in": (4, ("X15.png",)),
    "color-care": (5, ("X15.png", "X17.png", "X19.png")),
    "flower-power": (6, ("X16.png", "X18.png", "X20.png", "X22.png", "X24.png")),
    "moisture-and-more": (7, ("X18.png", "X20.png", "X22.png", "X24.png", "X26.png")),
    "integrity-and-strength": (8, ("X17.png", "X19.png", "X21.png", "X23.png")),
    "silver-shine": (9, ("X17.png", "X19.png", "X21.png", "X23.png", "X25.png")),
    "icy-blond": (10, ("X17.png", "X19.png", "X21.png")),
    "cold-brunette": (11, ("X15.png", "X17.png", "X20.png")),
    "pink-lemonade": (12, ("X15.png", "X17.png")),
    "curl-passion": (13, ("X14.png", "X16.png", "X18.png", "X20.png", "X22.png")),
    "volume-solution": (15, ("X17.png", "X19.png", "X21.png")),
    "energizin-blend": (16, ("X17.png", "X19.png", "X21.png")),
    "purifying-blend": (17, ("X15.png",)),
    "normalizing-blend": (18, ("X17.png",)),
    "deep-detox": (19, ("X16.png",)),
    "argan": (20, ("X16.png", "X18.png", "X20.png")),
    "no-frizz-allowed": (21, ("X18.png", "X20.png", "X22.png", "X24.png")),
    "sun-and-more": (22, ("X17.png", "X19.png", "X21.png", "X23.png")),
    "insta-light": (23, ("X19.png", "X21.png", "X23.png")),
    "lifestyling": (24, ("X16.png", "X18.png", "X20.png", "X22.png")),
}

PRODUCT_ASSETS: dict[str, tuple[int, str]] = {
    "argan-shampoo": (20, "X16.png"),
    "argan-zasib-dlia-zhyvlennia-volossia": (20, "X20.png"),
    "argan-oliia": (20, "X18.png"),
    "cold-brunette-shampoo": (11, "X15.png"),
    "cold-brunette-conditioner": (11, "X17.png"),
    "cold-brunette-sprei": (11, "X20.png"),
    "color-care-color-care-shampoo": (5, "X15.png"),
    "color-care-color-care-conditioner": (5, "X17.png"),
    "color-care-color-care-mask": (5, "X19.png"),
    "curl-passion-shampoo": (13, "X20.png"),
    "curl-passion-conditioner": (13, "X14.png"),
    "curl-passion-mask": (13, "X22.png"),
    "curl-passion-shaper": (13, "X16.png"),
    "curl-passion-defining-gel": (13, "X18.png"),
    "curl-passion-perfectionist": (14, "X20.png"),
    "curl-passion-fluid": (14, "X14.png"),
    "curl-passion-primer": (14, "X18.png"),
    "curl-passion-leave-in": (14, "X16.png"),
    "deep-detox-shampoo": (19, "X16.png"),
    "energizin-blend-shampoo": (16, "X17.png"),
    "energizin-blend-conditioner": (16, "X19.png"),
    "energizin-blend-sprei-dlia-koreniv": (16, "X21.png"),
    "flower-power-shampoo": (6, "X20.png"),
    "flower-power-conditioner": (6, "X24.png"),
    "flower-power-leave-in-conditioner": (6, "X22.png"),
    "flower-power-incredible-milk-12-effects": (6, "X16.png"),
    "flower-power-whipped-cream": (6, "X18.png"),
    "icy-blond-shampoo": (10, "X17.png"),
    "icy-blond-conditioner": (10, "X19.png"),
    "icy-blond-sprei": (10, "X21.png"),
    "incredible-incredible-milk-12-effects": (3, "X15.png"),
    "incredible-syrovatka-skalp-koreni": (3, "X17.png"),
    "incredible-incredible-oil": (3, "X19.png"),
    "insta-light-shampoo": (23, "X19.png"),
    "insta-light-lotion": (23, "X21.png"),
    "insta-light-potion": (23, "X23.png"),
    "integrity-and-strength-shampoo": (8, "X17.png"),
    "integrity-and-strength-conditioner": (8, "X19.png"),
    "integrity-and-strength-mask": (8, "X21.png"),
    "integrity-and-strength-zasib-dlia-vidnovlennia-kinchykiv": (8, "X16.jpg"),
    "integrity-and-strength-ampuly": (8, "X23.png"),
    "leave-in-leave-in-conditioner": (4, "X15.png"),
    "lifestyling-thermo-protector": (24, "X22.png"),
    "lifestyling-eco-strong-hairspray": (24, "X18.png"),
    "lifestyling-shaping-foam": (24, "X20.png"),
    "lifestyling-volumizing-foam": (24, "X16.png"),
    "make-my-day-shampoo": (2, "X7.png"),
    "make-my-day-conditioner": (2, "X9.png"),
    "make-my-day-whipped-cream-leave-in": (2, "X11.png"),
    "moisture-and-more-shampoo": (7, "X18.png"),
    "moisture-and-more-conditioner": (7, "X24.png"),
    "moisture-and-more-zvolozhuiucha-syrovatka": (7, "X20.png"),
    "moisture-and-more-whipped-cream": (7, "X26.png"),
    "moisture-and-more-losion": (7, "X22.png"),
    "no-frizz-allowed-shampoo": (21, "X20.png"),
    "no-frizz-allowed-conditioner": (21, "X22.png"),
    "no-frizz-allowed-syrovatka": (21, "X18.png"),
    "no-frizz-allowed-molochko": (21, "X24.png"),
    "normalizing-blend-shampoo": (18, "X17.png"),
    "pink-lemonade-shampoo": (12, "X15.png"),
    "pink-lemonade-conditioner": (12, "X17.png"),
    "purifying-blend-shampoo": (17, "X15.png"),
    "silver-shine-shampoo": (9, "X25.png"),
    "silver-shine-light-shampoo": (9, "X19.png"),
    "silver-shine-conditioner": (9, "X23.png"),
    "silver-shine-pinka": (9, "X21.png"),
    "silver-shine-sprei": (9, "X17.png"),
    "sun-and-more-all-over-shampoo": (22, "X23.png"),
    "sun-and-more-intensive-mask": (22, "X17.png"),
    "sun-and-more-leave-in-milk-12-effects": (22, "X21.png"),
    "sun-and-more-after-sun-mousse": (22, "X19.png"),
    "volume-solution-shampoo": (15, "X17.png"),
    "volume-solution-conditioner": (15, "X19.png"),
    "volume-solution-sprei": (15, "X21.png"),
}

CANVAS = (1200, 675)
CONTENT_BOX = (1080, 570)


def trim_transparency(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bounds = alpha.getbbox()
    if bounds == (0, 0, rgba.width, rgba.height):
        difference = ImageChops.difference(rgba.convert("RGB"), Image.new("RGB", rgba.size, "white"))
        bounds = difference.convert("L").point(lambda pixel: 255 if pixel > 12 else 0).getbbox()
    return rgba.crop(bounds) if bounds else rgba


def compose(products: list[Image.Image]) -> Image.Image:
    count = len(products)
    target_height = 535 if count <= 3 else 485 if count == 4 else 445
    gap = 22 if count <= 3 else 14
    prepared: list[Image.Image] = []

    for product in products:
        product = trim_transparency(product)
        scale = min(target_height / product.height, 1.0)
        size = (max(1, round(product.width * scale)), max(1, round(product.height * scale)))
        prepared.append(product.resize(size, Image.Resampling.LANCZOS))

    total_width = sum(image.width for image in prepared) + gap * (count - 1)
    if total_width > CONTENT_BOX[0]:
        scale = (CONTENT_BOX[0] - gap * (count - 1)) / sum(
            image.width for image in prepared
        )
        prepared = [
            image.resize(
                (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                Image.Resampling.LANCZOS,
            )
            for image in prepared
        ]
        total_width = sum(image.width for image in prepared) + gap * (count - 1)

    canvas = Image.new("RGB", CANVAS, "white")
    x = round((CANVAS[0] - total_width) / 2)
    baseline = round((CANVAS[1] + max(image.height for image in prepared)) / 2)
    for image in prepared:
        y = baseline - image.height
        canvas.paste(image, (x, y), image)
        x += image.width + gap
    return canvas


def save_webp_with_retry(image: Image.Image, target: Path) -> None:
    buffer = BytesIO()
    image.save(buffer, "WEBP", quality=95, method=6)
    payload = buffer.getvalue()
    for attempt in range(1, 7):
        try:
            target.write_bytes(payload)
            return
        except OSError:
            if attempt == 6:
                raise
            time.sleep(attempt * 0.15)


def product_image(image: Image.Image) -> Image.Image:
    product = trim_transparency(image)
    scale = min(1000 / product.width, 1000 / product.height, 1.0)
    if scale < 1.0:
        product = product.resize(
            (max(1, round(product.width * scale)), max(1, round(product.height * scale))),
            Image.Resampling.LANCZOS,
        )
    return product


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/images/milk-shake"))
    args = parser.parse_args()

    reader = PdfReader(args.pdf)
    args.output.mkdir(parents=True, exist_ok=True)
    product_output = args.output / "products"
    product_output.mkdir(parents=True, exist_ok=True)
    line_sources: list[dict[str, object]] = []
    product_sources: list[dict[str, object]] = []

    for line_id, (page_number, names) in LINE_ASSETS.items():
        page = reader.pages[page_number - 1]
        available = {image.name: image.image for image in page.images}
        missing = [name for name in names if name not in available]
        if missing:
            raise ValueError(f"Page {page_number}, {line_id}: missing {missing}")
        result = compose([available[name] for name in names])
        target = args.output / f"{line_id}.webp"
        save_webp_with_retry(result, target)
        line_sources.append(
            {
                "brand": "milk_shake",
                "type": "line",
                "id": line_id,
                "page": f"{args.pdf.name}, page {page_number}",
                "image": ", ".join(names),
                "width": CANVAS[0],
                "height": CANVAS[1],
            }
        )
        print(f"milk_shake: {line_id} - {len(names)} exact product cutouts")

    page_images: dict[int, dict[str, Image.Image]] = {}
    for product_id, (page_number, name) in PRODUCT_ASSETS.items():
        if page_number not in page_images:
            page_images[page_number] = {
                image.name: image.image for image in reader.pages[page_number - 1].images
            }
        if name not in page_images[page_number]:
            raise ValueError(f"Page {page_number}, {product_id}: missing {name}")
        result = product_image(page_images[page_number][name])
        target = product_output / f"{product_id}.webp"
        save_webp_with_retry(result, target)
        product_sources.append(
            {
                "brand": "milk_shake",
                "type": "product",
                "id": product_id,
                "page": f"{args.pdf.name}, page {page_number}",
                "image": name,
                "width": result.width,
                "height": result.height,
            }
        )

    catalog_path = Path("data/products.json")
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    milk_products = [
        product for product in catalog["products"] if product["brand_id"] == "milk-shake"
    ]
    catalog_ids = {product["id"] for product in milk_products}
    if catalog_ids != set(PRODUCT_ASSETS):
        raise ValueError(
            f"Product mapping mismatch: missing={sorted(catalog_ids - set(PRODUCT_ASSETS))}, "
            f"extra={sorted(set(PRODUCT_ASSETS) - catalog_ids)}"
        )
    for product in milk_products:
        product["image"] = f"/images/milk-shake/products/{product['id']}.webp"
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    migration = Path("migrations/0009_milkshake_product_images.sql")
    migration.write_text(
        "\n".join(
            f"UPDATE products SET image='/images/milk-shake/products/{product_id}.webp' "
            f"WHERE id='{product_id}' AND brand_id='milk-shake';"
            for product_id in PRODUCT_ASSETS
        )
        + "\n",
        encoding="utf-8",
    )

    manifest_path = Path("data/image-sources.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["sources"] = [
        source for source in manifest["sources"] if source.get("brand") != "milk_shake"
    ] + line_sources + product_sources
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Updated {len(line_sources)} line and {len(product_sources)} product images "
        f"from {args.pdf.name}."
    )


if __name__ == "__main__":
    main()
