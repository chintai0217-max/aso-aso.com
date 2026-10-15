#!/usr/bin/env python3
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"

BLUE = (2, 132, 199)
BLUE_DARK = (3, 105, 161)
SKY = (56, 189, 248)
INK = (15, 23, 42)
MUTED = (71, 85, 105)
WHITE = (255, 255, 255)
PALE = (240, 249, 255)
ORANGE = (249, 115, 22)


def font(size):
    return ImageFont.truetype(FONT_BOLD, size=size)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rounded(d, (0, 0, size - 1, size - 1), max(10, size // 5), BLUE, None)
    d.ellipse((size * 0.08, size * 0.08, size * 0.72, size * 0.72), fill=SKY + (255,))
    d.rounded_rectangle(
        (size * 0.18, size * 0.18, size * 0.82, size * 0.82),
        radius=size * 0.16,
        fill=WHITE,
        outline=BLUE_DARK,
        width=max(2, size // 28),
    )
    text = "関"
    f = font(int(size * 0.5))
    bbox = d.textbbox((0, 0), text, font=f)
    x = (size - (bbox[2] - bbox[0])) / 2
    y = (size - (bbox[3] - bbox[1])) / 2 - size * 0.03
    d.text((x, y), text, fill=BLUE_DARK, font=f)
    return img


def make_og():
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), PALE)
    d = ImageDraw.Draw(img)

    for y in range(h):
        ratio = y / h
        r = int(3 + (56 - 3) * ratio)
        g = int(105 + (189 - 105) * ratio)
        b = int(161 + (248 - 161) * ratio)
        d.line((0, y, w, y), fill=(r, g, b))

    d.ellipse((-120, -160, 420, 380), fill=(125, 211, 252))
    d.ellipse((840, 330, 1320, 810), fill=(14, 165, 233))
    rounded(d, (64, 64, 1136, 566), 36, (255, 255, 255), None)

    icon = make_icon(156)
    img.paste(icon, (96, 104), icon)

    d.text((284, 118), "関東イベントナビ", fill=INK, font=font(64))
    d.text((288, 198), "イベント・遊び場をさがす", fill=BLUE_DARK, font=font(34))
    d.text(
        (96, 312),
        "群馬県を中心に、栃木県から関東各地へ公式情報をもとに拡大中。",
        fill=MUTED,
        font=font(30),
    )

    chip_y = 420
    chips = [("群馬県", BLUE), ("栃木県", ORANGE), ("関東各地へ拡大中", BLUE_DARK)]
    x = 96
    for label, color in chips:
        bbox = d.textbbox((0, 0), label, font=font(26))
        chip_w = bbox[2] - bbox[0] + 44
        rounded(d, (x, chip_y, x + chip_w, chip_y + 56), 28, color, None)
        d.text((x + 22, chip_y + 10), label, fill=WHITE, font=font(26))
        x += chip_w + 18

    d.text((96, 510), "aso-aso.com", fill=BLUE_DARK, font=font(26))
    return img


def write_svg():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0284c7"/>
  <circle cx="24" cy="22" r="18" fill="#38bdf8"/>
  <rect x="12" y="12" width="40" height="40" rx="10" fill="#fff" stroke="#0369a1" stroke-width="4"/>
  <text x="32" y="43" text-anchor="middle" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="34" font-weight="900" fill="#0369a1">関</text>
</svg>
"""
    (ROOT / "favicon.svg").write_text(svg, encoding="utf-8")


def write_manifest():
    manifest = """{
  "name": "関東イベントナビ",
  "short_name": "関東イベント",
  "description": "群馬県を中心に、栃木県から関東各地のイベントと子どもの遊び場を探せる地域情報ナビです。",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#0284c7",
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
"""
    (ROOT / "site.webmanifest").write_text(manifest, encoding="utf-8")


def main():
    make_icon(32).save(ROOT / "favicon-32x32.png")
    make_icon(32).save(ROOT / "favicon-32.png")
    make_icon(16).save(ROOT / "favicon-16.png")
    make_icon(180).save(ROOT / "apple-touch-icon.png")
    make_icon(192).save(ROOT / "android-chrome-192x192.png")
    make_icon(512).save(ROOT / "android-chrome-512x512.png")
    make_icon(256).save(
        ROOT / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    make_og().save(ROOT / "og-image.png", optimize=True)
    write_svg()
    write_manifest()
    print("generated favicon and social image assets")


if __name__ == "__main__":
    main()
