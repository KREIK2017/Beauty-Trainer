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

from PIL import Image
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

CANVAS = (1200, 675)
CONTENT_BOX = (1080, 570)


def trim_transparency(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bounds = rgba.getchannel("A").getbbox()
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/images/milk-shake"))
    args = parser.parse_args()

    reader = PdfReader(args.pdf)
    args.output.mkdir(parents=True, exist_ok=True)
    sources: list[dict[str, object]] = []

    for line_id, (page_number, names) in LINE_ASSETS.items():
        page = reader.pages[page_number - 1]
        available = {image.name: image.image for image in page.images}
        missing = [name for name in names if name not in available]
        if missing:
            raise ValueError(f"Page {page_number}, {line_id}: missing {missing}")
        result = compose([available[name] for name in names])
        target = args.output / f"{line_id}.webp"
        save_webp_with_retry(result, target)
        sources.append(
            {
                "brand": "milk_shake",
                "id": line_id,
                "page": f"{args.pdf.name}, page {page_number}",
                "image": ", ".join(names),
                "width": CANVAS[0],
                "height": CANVAS[1],
            }
        )
        print(f"milk_shake: {line_id} - {len(names)} exact product cutouts")

    manifest_path = Path("data/image-sources.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["sources"] = [
        source for source in manifest["sources"] if source.get("brand") != "milk_shake"
    ] + sources
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Updated {len(sources)} milk_shake line images from {args.pdf.name}.")


if __name__ == "__main__":
    main()
