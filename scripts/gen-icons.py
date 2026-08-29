#!/usr/bin/env python3
"""
Растрові іконки зі знака tatetUI.

Запускається РУКАМИ після зміни знака, у збірку не входить:

    python3 scripts/gen-icons.py

Джерело істини — public/favicon.svg. Геометрія тут повторює його один в
один (див. GEOMETRY нижче), бо в системі немає растеризатора SVG, а тягти
його в залежності заради чотирьох файлів, які змінюються раз на рік,
дорожче за двадцять рядків малювання.

Потрібен лише Pillow. Усе малюється в 8× і зменшується — rounded_rectangle
не має згладжування, і на 32px без цього кроку кути виходять драбинкою.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# Геометрія знака у системі координат 32×32 — та сама, що у favicon.svg.
GEOMETRY = {
    "tile_radius": 7,
    "cell": 9,
    "cell_radius": 2.5,
    "offset": 5.5,
    "gap": 3,
}
ACCENT = (37, 99, 235)          # --accent-solid
CONTRAST = (255, 255, 255)      # --accent-contrast
DIM_ALPHA = 115                 # 0.45 × 255, як opacity у SVG

SS = 8  # супersampling


def draw_mark(size: int, rounded: bool = True) -> Image.Image:
    """Малює знак розміром size×size з прозорим тлом."""
    px = size * SS
    scale = px / 32
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    radius = GEOMETRY["tile_radius"] * scale if rounded else 0
    draw.rounded_rectangle([0, 0, px - 1, px - 1], radius=radius, fill=(*ACCENT, 255))

    cell = GEOMETRY["cell"] * scale
    step = (GEOMETRY["cell"] + GEOMETRY["gap"]) * scale
    origin = GEOMETRY["offset"] * scale
    cell_radius = GEOMETRY["cell_radius"] * scale

    for row in range(2):
        for column in range(2):
            # Верхня ліва плитка непрозора, решта — приглушені.
            alpha = 255 if row == 0 and column == 0 else DIM_ALPHA
            left = origin + column * step
            top = origin + row * step
            # Плитки малюються на окремому шарі: інакше напівпрозорий
            # прямокутник, покладений просто на синє тло, дав би не
            # приглушений білий, а змішаний колір із власною альфою 255.
            layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            ImageDraw.Draw(layer).rounded_rectangle(
                [left, top, left + cell, top + cell],
                radius=cell_radius,
                fill=(*CONTRAST, alpha),
            )
            canvas = Image.alpha_composite(canvas, layer)

    return canvas.resize((size, size), Image.LANCZOS)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    name = "NotoSans-Bold.ttf" if bold else "NotoSans-Regular.ttf"
    return ImageFont.truetype(f"/usr/share/fonts/truetype/noto/{name}", size)


def write_favicon_ico() -> None:
    # 48 у комплекті: саме його бере Windows для ярликів і панелі завдань.
    base = draw_mark(256)
    base.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


def write_apple_touch_icon() -> None:
    # Прозорості бути не може: iOS підкладає під неї чорне. Кути теж не
    # скругляємо — це робить сама система, і подвійне скруглення помітне.
    icon = Image.new("RGBA", (180, 180), (*ACCENT, 255))
    icon.alpha_composite(draw_mark(180, rounded=False))
    icon.convert("RGB").save(PUBLIC / "apple-touch-icon.png")


def write_og_image() -> None:
    width, height = 1200, 630
    canvas = Image.new("RGB", (width, height), (247, 248, 250))  # --bg-main
    draw = ImageDraw.Draw(canvas)

    # Акцентна смуга зверху — щоб картинка читалася брендом навіть у
    # стрічці, де прев'ю обрізається до першої третини.
    draw.rectangle([0, 0, width, 8], fill=ACCENT)

    # Знак-водяний знак, що виходить за правий край. Права половина інакше
    # лишається порожньою: текст притиснутий ліворуч, бо в стрічці прев'ю
    # часто обрізають саме праворуч.
    watermark = draw_mark(560)
    watermark.putalpha(watermark.getchannel("A").point(lambda value: value * 7 // 100))
    canvas.paste(watermark, (width - 300, height - 300), watermark)

    mark = draw_mark(120)
    canvas.paste(mark, (96, 128), mark)

    draw.text((96, 286), "tatetUI", font=font(104), fill=(26, 29, 33))      # --ink
    draw.rectangle([96, 420, 96 + 132, 425], fill=ACCENT)
    draw.text((96, 452), "Бібліотека UI-компонентів для Vue 3 і Nuxt",
              font=font(38, bold=False), fill=(91, 100, 114))              # --ink-muted
    draw.text((96, 508), "Копіюй код, а не став пакет",
              font=font(38, bold=False), fill=(29, 78, 216))               # --accent

    canvas.save(PUBLIC / "og-image.png", optimize=True)


if __name__ == "__main__":
    write_favicon_ico()
    write_apple_touch_icon()
    write_og_image()
    for name in ("favicon.ico", "apple-touch-icon.png", "og-image.png"):
        path = PUBLIC / name
        print(f"  {name:24} {path.stat().st_size:>8,} B")
