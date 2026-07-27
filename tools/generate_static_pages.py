#!/usr/bin/env python3
import base64
import json
import re
import shutil
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import quote as url_quote


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://aso-aso.com"
TODAY = date.today().isoformat()
TODAY_JA = f"{date.today().year}年{date.today().month}月{date.today().day}日"
GA_MEASUREMENT_ID = "G-ZWE0042E90"
ADSENSE_CLIENT_ID = "ca-pub-7927260139193410"
CONTACT_FORM_URL = "https://forms.gle/dvMZU7xV8vetDgLHA"
LISTING_FORM_URL = "https://forms.gle/2fLgxWBXKD75u6Kx5"

CATEGORY_LABELS = {
    "contest": "コンテスト",
    "craft": "クラフト",
    "entertainment": "エンタメ",
    "esports": "eスポーツ",
    "exhibition": "展示",
    "experience": "体験",
    "festival": "祭り",
    "fireworks": "花火",
    "flower": "花・自然",
    "food": "食",
    "food_festival": "食フェス",
    "illumination": "ライトアップ",
    "international_exchange": "国際交流",
    "kids": "子ども",
    "lecture": "講演",
    "market": "マルシェ",
    "nature": "自然",
    "performance": "公演",
    "seasonal_display": "季節展示",
    "shopping": "買い物",
    "sports": "スポーツ",
    "stamp_rally": "スタンプラリー",
    "tour": "ツアー",
    "traditional_performance": "伝統芸能",
    "transport": "交通",
    "workshop": "講習",
}

PLACE_TYPE_LABELS = {
    "amusement_park": "遊園地",
    "animal_cafe": "動物ふれあい",
    "animal_indoor_play": "動物・屋内遊び",
    "childcare_support": "子育て支援",
    "child_center": "児童館",
    "craft_workshop": "ものづくり",
    "dinosaur_museum": "恐竜・博物館",
    "indoor_play": "屋内遊び場",
    "indoor_sports": "屋内スポーツ",
    "museum": "博物館",
    "museum_workshop": "博物館・体験",
    "nature_museum": "自然・資料館",
    "park": "公園",
    "park_indoor_play": "公園・屋内遊び",
    "park_science": "公園・科学",
    "playground": "遊具広場",
    "pool": "プール",
    "railway_museum": "鉄道・博物館",
    "safari_park": "サファリ",
    "science_museum": "科学館",
    "theme_park": "テーマパーク",
    "water_play_park": "水遊び公園",
}

INDOOR_OUTDOOR_LABELS = {
    "indoor": "屋内",
    "outdoor": "屋外",
    "both": "屋内・屋外",
}


def html(value):
    return escape(str(value or ""), quote=True)


def compact(value, limit=150):
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def json_ld(obj):
    return json.dumps(clean_json(obj), ensure_ascii=False, separators=(",", ":"))


def clean_json(value):
    if isinstance(value, dict):
        return {key: clean_json(item) for key, item in value.items() if item not in (None, "", [], {})}
    if isinstance(value, list):
        return [clean_json(item) for item in value if item not in (None, "", [], {})]
    return value


def clean_dir(name):
    path = ROOT / name
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def event_url(event):
    return f"{BASE_URL}/events/{event['id']}.html"


def place_url(place):
    return f"{BASE_URL}/places/{place['id']}.html"


def date_text(event):
    start = event.get("start_date")
    end = event.get("end_date")
    if not start:
        return ""
    start_label = format_date_long(start)
    if end and end != start:
        return f"{start_label} 〜 {format_date_long(end)}"
    return start_label


def date_text_compact(event):
    start = event.get("start_date")
    end = event.get("end_date")
    if not start:
        return ""
    start_label = format_date_compact(start)
    if end and end != start:
        same_year = str(start)[:4] == str(end)[:4]
        return f"{start_label} 〜 {format_date_compact(end, include_year=not same_year)}"
    return start_label


def format_date_long(value):
    try:
        year, month, day = [int(part) for part in str(value).split("-")]
        weekdays = ["月", "火", "水", "木", "金", "土", "日"]
        label = weekdays[date(year, month, day).weekday()]
        return f"{year}年{month}月{day}日（{label}）"
    except Exception:
        return str(value or "")


def format_date_compact(value, include_year=True):
    try:
        year, month, day = [int(part) for part in str(value).split("-")]
        weekdays = ["月", "火", "水", "木", "金", "土", "日"]
        label = weekdays[date(year, month, day).weekday()]
        if not include_year:
            return f"{month}/{day}（{label}）"
        return f"{year}/{month}/{day}（{label}）"
    except Exception:
        return str(value or "")


def compact_text(value, limit=42):
    text = " ".join(str(value or "").split())
    if not text:
        return ""
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def format_verified_date(value):
    raw = str(value or "")[:10]
    if len(raw) != 10 or raw[4] != "-" or raw[7] != "-":
        return ""
    month = int(raw[5:7])
    day = int(raw[8:10])
    return f"{month}/{day}確認"


def time_text(event):
    values = [event.get("start_time"), event.get("end_time")]
    return " - ".join([value for value in values if value]) or ""


def maps_url(record):
    name = record.get("venue_name") or record.get("name") or ""
    query = record.get("address") or " ".join(
        [part for part in [name, record.get("municipality"), record.get("prefecture")] if part]
    )
    if not query:
        return ""
    return f"https://www.google.com/maps/search/?api=1&query={url_quote(query)}"


def upgrade_image_url(url):
    if not url:
        return ""
    match = re.search(
        r"-(\d{2,4})x(\d{2,4})(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))",
        url,
        flags=re.I,
    )
    if not match:
        return url
    # すでに十分大きい派生画像はそのまま使う
    if max(int(match.group(1)), int(match.group(2))) >= 800:
        return url
    return re.sub(
        r"-(\d{2,4})x(\d{2,4})(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))",
        "",
        url,
        flags=re.I,
    )


def image_basename(url):
    if not url:
        return ""
    path = re.sub(r"[?#].*$", "", str(url))
    return path.rstrip("/").rsplit("/", 1)[-1].lower()


def is_junk_image_url(url):
    """Exclude site chrome, ranking badges, SNS icons, nav art, maps UI, etc."""
    if not url:
        return True
    base = image_basename(url)
    stem = base.rsplit(".", 1)[0] if "." in base else base
    if not stem:
        return True
    # Single-letter / ultra-short assets (x.png, 1.gif)
    if len(stem) <= 2:
        return True
    # Ranking / medal badges like no1.png
    if re.fullmatch(r"no\d{1,2}", stem):
        return True
    junk_stems = {
        "access",
        "koutuu",
        "koutsuu",
        "kotu",
        "traffic",
        "favicon",
        "spacer",
        "blank",
        "dummy",
        "pixel",
        "1x1",
        "arrow",
        "pagetop",
        "totop",
        "share",
        "sns",
        "facebook",
        "instagram",
        "twitter",
        "line",
        "line_btn",
        "qr",
        "qrcode",
        "logo",
        "icon",
        "badge",
        "medal",
        "ranking",
        "banner",
        "btn",
        "button",
        "nav",
        "menu",
        "header",
        "footer",
        "gnav",
        "gnav_img1",
        "gnav_img2",
        "gnav_img3",
        "netsunoyu01",
        "netsunoyu02",
        "netsunoyu",
        "main_visual_ttl",
        "skids-price",
        "no_thumb_330_220-7e11cfa6fb99748a3c98138fa90f5bfac1b4c79ae7c",
    }
    if stem in junk_stems:
        return True
    if re.search(
        r"(?:^|[-_])(?:logo|icon|btn|button|banner|arrow|qr|sns|share|favicon|gnav|nav|header|footer|badge|medal|ranking|price|ttl)(?:[-_]|$)",
        stem,
    ):
        return True
    if re.search(
        r"(?:ogp|noimage|s100x100|capture\.jpg|rsrc\.php|main_visual_ttl|skids-price|"
        r"ポスチラ|page-\d+|掲示用|/common/(?:img|images?)/|/themes?/.*/(?:common|assets)/.*gnav|"
        r"nav-(?:sight|ski|foods|spa)|skids-price)",
        url,
        re.I,
    ):
        return True
    return False


def image_pixel_hint(url):
    if not url:
        return 0
    if is_junk_image_url(url):
        return -10_000
    score = 0
    wp = re.search(r"-(\d{2,4})x(\d{2,4})(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))", url, re.I)
    if wp:
        score = max(int(wp.group(1)), int(wp.group(2)))
    keep = re.search(r"/keep/(\d+)", url)
    if keep:
        score = max(score, int(keep.group(1)))
    for seg in url.split("/"):
        if "eyJ" not in seg:
            continue
        raw = seg.split("--", 1)[0]
        pad = "=" * ((4 - len(raw) % 4) % 4)
        try:
            decoded = base64.urlsafe_b64decode(raw + pad).decode("utf-8", "ignore")
        except Exception:
            continue
        m = re.search(r"resize_to_fit[^0-9]*(\d+)", decoded)
        if m:
            score = max(score, int(m.group(1)))
        if '"format":"webp"' in decoded or '"format":"png"' in decoded:
            score += 40
        if '"format":"jpeg"' in decoded or '"format":"jpg"' in decoded:
            score -= 20
    if score == 0:
        score = 700
    if re.search(r"(?:[-_](?:150|176|225|250|300)x|s100x100|capture\.jpg|ogp|noimage|header|logo|qr)", url, re.I):
        score -= 250
    # Live cams are usable fallbacks but should never beat event photos
    if re.search(r"(?:livecamera|webcam)", url, re.I):
        score -= 320
    # Prefer real photos over UI chrome PNGs
    if re.search(r"\.(?:jpe?g)(?:\?|$)", url, re.I):
        score += 40
    elif re.search(r"\.(?:webp)(?:\?|$)", url, re.I):
        score += 20
    return score


def candidate_image_urls(record):
    urls = []
    primary = record.get("primary_image_url")
    if primary:
        urls.append(primary)
    for image in record.get("images") or []:
        if isinstance(image, dict) and image.get("image_url"):
            urls.append(image["image_url"])
        elif isinstance(image, str):
            urls.append(image)
    return urls


def best_display_image(record):
    urls = candidate_image_urls(record)
    if not urls:
        return ""
    primary = record.get("primary_image_url") or ""
    primary_upgraded = upgrade_image_url(primary) or primary
    if primary_upgraded and not is_junk_image_url(primary_upgraded):
        return primary_upgraded

    best = ""
    best_score = -10_000
    for url in urls:
        upgraded = upgrade_image_url(url) or url
        for candidate in ((upgraded, url) if upgraded != url else (url,)):
            if is_junk_image_url(candidate):
                continue
            score = image_pixel_hint(candidate)
            if score > best_score:
                best_score = score
                best = candidate
    return best


def image_tag(url, alt):
    if not url:
        return ""
    return (
        '<div class="static-detail-image">'
        f'<img src="{html(url)}" alt="{html(alt)}" loading="eager" decoding="async" referrerpolicy="no-referrer" '
        'onload="if(this.naturalWidth&lt;640)this.classList.add(\'is-lowres\')" '
        'onerror="this.closest(\'.static-detail-image\').hidden=true">'
        "</div>"
    )


def collect_gallery_images(record, alt, limit=8):
    items = []
    seen = set()
    primary = record.get("primary_image_url")
    raw_list = []
    if primary:
        raw_list.append({"image_url": primary, "alt_text": alt})
    for image in record.get("images") or []:
        if isinstance(image, dict) and image.get("image_url"):
            raw_list.append(image)
        elif isinstance(image, str):
            raw_list.append({"image_url": image, "alt_text": alt})
    for image in raw_list:
        url = image.get("image_url")
        if not url:
            continue
        display_url = upgrade_image_url(url) or url
        if is_junk_image_url(display_url) or display_url in seen:
            continue
        seen.add(display_url)
        entry = dict(image) if isinstance(image, dict) else {"image_url": display_url, "alt_text": alt}
        entry["image_url"] = display_url
        items.append(entry)
    items = filter_relevant_images(items, alt)
    best = best_display_image(record)
    if best and items:
        rest = [item for item in items if item.get("image_url") != best]
        best_item = next(
            (item for item in items if item.get("image_url") == best),
            {"image_url": best, "alt_text": alt},
        )
        # Prefer higher-scoring real photos after the lead image
        rest.sort(key=lambda item: image_pixel_hint(item.get("image_url") or ""), reverse=True)
        items = [best_item] + rest
    return items[:limit]


def detail_hero_html(record, alt):
    images = collect_gallery_images(record, alt)
    if not images:
        return ""
    if len(images) == 1:
        return image_tag(images[0].get("image_url"), images[0].get("alt_text") or alt)
    slides = []
    dots = []
    total = len(images)
    for index, image in enumerate(images):
        url = image.get("image_url")
        slide_alt = image.get("alt_text") or alt
        loading = "eager" if index == 0 else "lazy"
        slides.append(
            '<div class="detail-carousel__slide" role="group" '
            f'aria-label="{index + 1} / {total}">'
            f'<img src="{html(url)}" alt="{html(slide_alt)}" loading="{loading}" decoding="async" '
            'referrerpolicy="no-referrer" '
            'onload="if(this.naturalWidth&lt;640)this.classList.add(\'is-lowres\')" '
            'onerror="this.closest(\'.detail-carousel__slide\').classList.add(\'is-broken\')">'
            "</div>"
        )
        dots.append(
            f'<button type="button" class="detail-carousel__dot{" is-active" if index == 0 else ""}" '
            f'data-carousel-dot="{index}" aria-label="写真 {index + 1}"></button>'
        )
    return (
        '<div class="detail-carousel" data-carousel>'
        '<div class="detail-carousel__viewport" tabindex="0" aria-label="写真ギャラリー">'
        f'<div class="detail-carousel__track">{"".join(slides)}</div>'
        "</div>"
        f'<button type="button" class="detail-carousel__nav is-prev" data-carousel-prev aria-label="前の写真">'
        f'{ui_icon("arrow-left")}</button>'
        f'<button type="button" class="detail-carousel__nav is-next" data-carousel-next aria-label="次の写真">'
        f'<i class="ui-icon ui-icon--arrow-left is-flip" aria-hidden="true"></i></button>'
        '<div class="detail-carousel__meta">'
        f'<div class="detail-carousel__dots" role="tablist" aria-label="写真選択">{"".join(dots)}</div>'
        f'<span class="detail-carousel__count" data-carousel-count>1 / {total}</span>'
        "</div>"
        "</div>"
    )


def gallery_html(images, alt):
    # kept for compatibility; hero carousel now shows all photos
    return ""


def filter_relevant_images(images, title):
    if len(images) <= 1:
        return images
    key = "".join(str(title or "").split())
    for ch in "！？!?0123456789０１２３４５６７８９":
        key = key.replace(ch, "")
    if len(key) < 4:
        return images[:2]
    needle = key[: min(10, len(key))]
    matched = []
    for index, image in enumerate(images):
        if index == 0:
            matched.append(image)
            continue
        alt = "".join(str(image.get("alt_text") or "").split())
        if not alt:
            continue
        if needle in alt or alt[: min(6, len(alt))] in needle:
            matched.append(image)
    return matched if len(matched) > 1 else images


def fact_or_confirm(value, fallback="公式で確認"):
    text = str(value or "").strip()
    return text or fallback


def ui_icon(name: str) -> str:
    return f'<i class="ui-icon ui-icon--{html(name)}" aria-hidden="true"></i>'


FACT_ICONS = {
    "開催日": "calendar",
    "時間": "clock",
    "会場": "building",
    "料金": "yen",
    "対象": "users",
    "屋内/屋外": "home",
    "イベント": "ticket",
    "遊び場": "play",
}


def fact_strip(items):
    cells = []
    for item in items:
        if len(item) == 3:
            label, value, _fallback = item
        else:
            label, value = item
        raw = str(value or "").strip()
        # 「公式で確認」だけの空カードは出さない
        if not raw:
            continue
        icon_name = FACT_ICONS.get(label, "tag")
        if label == "屋内/屋外":
            icon_name = "sun" if "屋外" in raw and "屋内" not in raw else "home"
        cells.append(
            f"<span><b>{ui_icon(icon_name)}{html(label)}</b>{html(raw)}</span>"
        )
    if not cells:
        return ""
    return f'<div class="detail-fact-strip">{"".join(cells)}</div>'


def details(items):
    rows = []
    for label, value in items:
        text = str(value or "").strip()
        if not text or text == "公式で確認":
            continue
        rows.append(f"<dt>{html(label)}</dt><dd>{html(text)}</dd>")
    if not rows:
        return ""
    return '<dl class="detail-grid static-detail-grid">' + "".join(rows) + "</dl>"


def section_paragraph(title, text):
    if not text:
        return ""
    return (
        f'<section class="static-detail-section detail-section"><h2>{html(title)}</h2>'
        f'<p class="detail-copy">{html(text)}</p></section>'
    )


def ga_snippet():
    return f"""    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id={GA_MEASUREMENT_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){{dataLayer.push(arguments);}}
      gtag('js', new Date());
      gtag('config', '{GA_MEASUREMENT_ID}');
    </script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT_ID}"
     crossorigin="anonymous"></script>
    <meta name="google-adsense-account" content="{ADSENSE_CLIENT_ID}">"""


def footer_html(asset_prefix="../"):
    return f"""    <footer class="site-footer">
      <div class="site-footer-inner">
        <p class="site-footer-brand">群馬イベントナビ</p>
        <nav class="site-footer-nav" aria-label="フッター">
          <a href="{asset_prefix}guides/">おでかけガイド</a>
          <a href="{asset_prefix}about.html">運営について</a>
          <a href="{asset_prefix}privacy.html">プライバシーポリシー</a>
          <a href="{CONTACT_FORM_URL}" target="_blank" rel="noopener noreferrer">お問い合わせ</a>
          <a href="{LISTING_FORM_URL}" target="_blank" rel="noopener noreferrer">サイト掲載について</a>
        </nav>
      </div>
    </footer>"""


def list_return_script():
    return """    <script>
      (function () {
        try {
          var url = sessionStorage.getItem("aso:listUrl");
          if (!url) return;
          document.querySelectorAll("[data-list-return]").forEach(function (link) {
            link.setAttribute("href", url);
          });
        } catch (e) {}
      })();
    </script>
    <script>
      (function () {
        function initCarousel(root) {
          var viewport = root.querySelector(".detail-carousel__viewport");
          var track = root.querySelector(".detail-carousel__track");
          var slides = Array.prototype.slice.call(root.querySelectorAll(".detail-carousel__slide"));
          var dots = Array.prototype.slice.call(root.querySelectorAll("[data-carousel-dot]"));
          var countEl = root.querySelector("[data-carousel-count]");
          var prev = root.querySelector("[data-carousel-prev]");
          var next = root.querySelector("[data-carousel-next]");
          if (!viewport || !track || slides.length < 2) return;

          var index = 0;
          var total = slides.length;

          function slideWidth() {
            return viewport.clientWidth || 1;
          }

          function goTo(nextIndex, smooth) {
            index = (nextIndex + total) % total;
            viewport.scrollTo({ left: slideWidth() * index, behavior: smooth === false ? "auto" : "smooth" });
            updateUI();
          }

          function updateUI() {
            if (countEl) countEl.textContent = (index + 1) + " / " + total;
            dots.forEach(function (dot, i) {
              dot.classList.toggle("is-active", i === index);
            });
            slides.forEach(function (slide, i) {
              slide.setAttribute("aria-hidden", i === index ? "false" : "true");
            });
          }

          function syncFromScroll() {
            var nextIndex = Math.round(viewport.scrollLeft / slideWidth());
            if (nextIndex !== index && nextIndex >= 0 && nextIndex < total) {
              index = nextIndex;
              updateUI();
            }
          }

          if (prev) prev.addEventListener("click", function () { goTo(index - 1); });
          if (next) next.addEventListener("click", function () { goTo(index + 1); });
          dots.forEach(function (dot) {
            dot.addEventListener("click", function () {
              goTo(Number(dot.getAttribute("data-carousel-dot")) || 0);
            });
          });
          viewport.addEventListener("scroll", function () {
            window.clearTimeout(viewport._carouselTimer);
            viewport._carouselTimer = window.setTimeout(syncFromScroll, 60);
          }, { passive: true });
          viewport.addEventListener("keydown", function (event) {
            if (event.key === "ArrowLeft") { event.preventDefault(); goTo(index - 1); }
            if (event.key === "ArrowRight") { event.preventDefault(); goTo(index + 1); }
          });
          window.addEventListener("resize", function () { goTo(index, false); });
          updateUI();
        }

        document.querySelectorAll("[data-carousel]").forEach(initCarousel);
      })();
    </script>"""


def list_search_href(mode="", municipality="", asset_prefix="../"):
    params = []
    if mode == "places":
        params.append("mode=places")
    elif mode and mode not in ("events", "event"):
        params.append(f"mode={url_quote(mode)}")
    if municipality:
        params.append(f"municipality={url_quote(municipality)}")
    query = ("?" + "&".join(params)) if params else ""
    home = asset_prefix if asset_prefix.endswith("/") else f"{asset_prefix}/"
    if asset_prefix in ("./", "."):
        home = "./"
    return f"{home}{query}#eventList"


def layout(
    title,
    description,
    canonical,
    image,
    kind_label,
    h1,
    kicker,
    body,
    structured_data,
    body_class="static-detail-page",
    asset_prefix="../",
):
    og_image = image or f"{BASE_URL}/og-image.png"
    home = asset_prefix if asset_prefix.endswith("/") else f"{asset_prefix}/"
    if asset_prefix in ("./", "."):
        home = "./"
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
{ga_snippet()}
    <title>{html(title)}</title>
    <meta name="description" content="{html(description)}">
    <meta name="robots" content="index,follow">
    <link rel="canonical" href="{html(canonical)}">
    <link rel="icon" href="{asset_prefix}favicon.ico" sizes="any">
    <link rel="icon" href="{asset_prefix}favicon.svg" type="image/svg+xml">
    <link rel="icon" href="{asset_prefix}favicon-32.png" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="{asset_prefix}apple-touch-icon.png" sizes="180x180">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="群馬イベントナビ">
    <meta property="og:title" content="{html(title)}">
    <meta property="og:description" content="{html(description)}">
    <meta property="og:url" content="{html(canonical)}">
    <meta property="og:image" content="{html(og_image)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="{html(og_image)}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{asset_prefix}styles.css?v=20260727i">
    <script type="application/ld+json">{json_ld(structured_data)}</script>
  </head>
  <body class="{html(body_class)}">
    <nav class="topbar" aria-label="サイト内ナビゲーション">
      <div class="topbar-inner">
        <a class="brand" href="{home}">
          <span class="brand-mark">群</span>
          <span>
            <strong>群馬イベントナビ</strong>
            <small>イベント・遊び場データベース</small>
          </span>
        </a>
        <div class="topbar-links">
          <a data-list-return href="{home}#eventList">{ui_icon("arrow-left")}一覧へ戻る</a>
          <a href="{home}areas/">{ui_icon("map")}地域</a>
          <a href="{home}themes/">{ui_icon("layers")}テーマ</a>
          <a href="{home}guides/">{ui_icon("book")}ガイド</a>
        </div>
      </div>
    </nav>
    <main class="static-detail-shell">
      <article class="static-detail">
        {body}
      </article>
    </main>
{footer_html(asset_prefix)}
{list_return_script()}
  </body>
</html>
"""


def detail_section(title, items):
    grid = details(items)
    if not grid:
        return ""
    return f'<section class="static-detail-section detail-section"><h2>{html(title)}</h2>{grid}</section>'


def action_links(primary_url, primary_label, mode, municipality="", map_link=""):
    links = []
    if primary_url:
        links.append(
            f'<a class="primary-button" href="{html(primary_url)}" target="_blank" rel="noreferrer">{ui_icon("external")}{html(primary_label)}</a>'
        )
    if map_link:
        links.append(
            f'<a class="secondary-button" href="{html(map_link)}" target="_blank" rel="noreferrer">{ui_icon("map")}地図で見る</a>'
        )
    list_href = list_search_href(mode=mode, municipality=municipality or "")
    links.append(
        f'<a class="secondary-button" data-list-return href="{html(list_href)}">{ui_icon("list")}一覧で探す</a>'
    )
    return '<div class="dialog-actions static-detail-actions">' + "".join(links) + "</div>"


def event_structured_data(event, canonical):
    location_name = event.get("venue_name") or event.get("area_label") or event.get("municipality") or "群馬県"
    event_schema = {
        "@type": "Event",
        "@id": f"{canonical}#event",
        "name": event.get("title"),
        "description": event.get("summary") or event.get("venue_name") or event.get("title"),
        "url": canonical,
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "eventStatus": "https://schema.org/EventScheduled",
        "location": {
            "@type": "Place",
            "name": location_name,
            "address": {
                "@type": "PostalAddress",
                "addressRegion": event.get("prefecture") or "群馬県",
                "addressLocality": event.get("municipality"),
                "streetAddress": event.get("address"),
            },
        },
    }
    if event.get("start_date"):
        event_schema["startDate"] = event["start_date"]
    if event.get("end_date"):
        event_schema["endDate"] = event["end_date"]
    if event.get("primary_image_url") or (event.get("images") or []):
        image = best_display_image(event)
        if image:
            event_schema["image"] = [image]
    if event.get("organizer"):
        event_schema["organizer"] = {"@type": "Organization", "name": event["organizer"]}
    return graph(canonical, event.get("title"), event.get("summary"), event_schema)


def place_structured_data(place, canonical):
    place_schema = {
        "@type": "Place",
        "@id": f"{canonical}#place",
        "name": place.get("name"),
        "description": place.get("features") or place.get("target_age_note") or place.get("name"),
        "url": canonical,
        "address": {
            "@type": "PostalAddress",
            "addressRegion": place.get("prefecture") or "群馬県",
            "addressLocality": place.get("municipality"),
            "streetAddress": place.get("address"),
        },
    }
    if place.get("primary_image_url") or (place.get("images") or []):
        image = best_display_image(place)
        if image:
            place_schema["image"] = [image]
    if place.get("official_url"):
        place_schema["sameAs"] = [place["official_url"]]
    return graph(canonical, place.get("name"), place.get("features"), place_schema)


def graph(canonical, name, description, main_entity):
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{BASE_URL}/#website",
                "name": "群馬イベントナビ",
                "url": f"{BASE_URL}/",
                "inLanguage": "ja",
            },
            {
                "@type": "WebPage",
                "@id": f"{canonical}#webpage",
                "url": canonical,
                "name": name,
                "description": description,
                "isPartOf": {"@id": f"{BASE_URL}/#website"},
                "inLanguage": "ja",
                "mainEntity": {"@id": main_entity["@id"]},
            },
            main_entity,
        ],
    }


def render_event(event):
    canonical = event_url(event)
    category = CATEGORY_LABELS.get(event.get("category"), event.get("category") or "イベント")
    title = f"{event.get('title')}｜{event.get('municipality') or '群馬県'}のイベント｜群馬イベントナビ"
    description = compact(
        f"{event.get('municipality') or '群馬県'}の{category}「{event.get('title')}」。"
        f"{date_text(event)}、{event.get('venue_name') or event.get('area_label') or ''}。"
        f"{event.get('summary') or ''}",
        155,
    )
    location = " / ".join([x for x in [event.get("prefecture"), event.get("municipality")] if x])
    kicker_parts = [event.get("municipality") or "群馬県", category, event.get("area_label")]
    kicker = " · ".join([part for part in kicker_parts if part])
    date_long = date_text(event)
    date_short = date_text_compact(event)
    display_image = best_display_image(event)
    body = (
        detail_hero_html(event, event.get("title"))
        + '<div class="static-detail-head">'
        + f'<p class="eyebrow">群馬のイベント</p><h1>{html(event.get("title"))}</h1>'
        + f'<p class="lead">{html(kicker)}</p>'
        + fact_strip(
            [
                ("開催日", date_short),
                ("時間", time_text(event)),
                ("会場", event.get("venue_name")),
                ("料金", event.get("price_note")),
            ]
        )
        + "</div><div class=\"static-detail-body\">"
        + section_paragraph("概要", event.get("summary"))
        + section_paragraph("補足", event.get("notes"))
        + detail_section(
            "会場・アクセス",
            [
                ("住所", event.get("address")),
                ("地域", location),
                ("エリア", event.get("area_label")),
                ("駐車場", event.get("parking_note")),
                ("予約", event.get("reservation_note")),
            ],
        )
        + detail_section(
            "主催・情報元",
            [
                ("主催", event.get("organizer")),
                ("カテゴリ", category),
                ("開催期間", date_long if date_long != date_short else ""),
                ("ソース", event.get("source_names")),
                ("最終確認", format_verified_date(event.get("last_verified_at")) or event.get("last_verified_at")),
            ],
        )
        + action_links(
            event.get("canonical_url"),
            "公式ページで最新を確認",
            "events",
            event.get("municipality") or "",
            maps_url(event),
        )
        + "</div>"
    )
    return layout(
        title,
        description,
        canonical,
        display_image,
        "群馬のイベント",
        event.get("title"),
        kicker,
        body,
        event_structured_data(event, canonical),
    )


def render_place(place):
    canonical = place_url(place)
    place_type = PLACE_TYPE_LABELS.get(place.get("place_type"), place.get("place_type") or "遊び場")
    indoor = INDOOR_OUTDOOR_LABELS.get(place.get("indoor_outdoor"), place.get("indoor_outdoor") or "屋内外未設定")
    title = f"{place.get('name')}｜{place.get('municipality') or '群馬県'}の子どもの遊び場｜群馬イベントナビ"
    description = compact(
        f"{place.get('municipality') or '群馬県'}の子どもの遊び場「{place.get('name')}」。"
        f"{place_type}、{indoor}。{place.get('features') or place.get('target_age_note') or ''}",
        155,
    )
    location = " / ".join([x for x in [place.get("prefecture"), place.get("municipality")] if x])
    kicker = " · ".join([part for part in [place.get("municipality") or "群馬県", place_type, indoor] if part])
    display_image = best_display_image(place)
    body = (
        detail_hero_html(place, place.get("name"))
        + '<div class="static-detail-head">'
        + f'<p class="eyebrow">群馬の子どもの遊び場</p><h1>{html(place.get("name"))}</h1>'
        + f'<p class="lead">{html(kicker)}</p>'
        + fact_strip(
            [
                ("対象", compact_text(place.get("target_age_note"))),
                ("料金", compact_text(place.get("price_note"))),
                ("時間", compact_text(place.get("hours_note"))),
                ("屋内/屋外", indoor if indoor and indoor != "屋内外未設定" else ""),
            ]
        )
        + "</div><div class=\"static-detail-body\">"
        + section_paragraph("特徴", place.get("features"))
        + section_paragraph("補足", place.get("notes"))
        + detail_section(
            "利用案内",
            [
                ("対象", place.get("target_age_note")),
                ("料金", place.get("price_note")),
                ("利用時間", place.get("hours_note")),
                ("休み", place.get("closed_note")),
                ("予約", place.get("reservation_note")),
                ("種類", place_type),
            ],
        )
        + detail_section(
            "アクセス・設備",
            [
                ("住所", place.get("address")),
                ("地域", location),
                ("エリア", place.get("area_label")),
                ("駐車場", place.get("parking_note")),
                ("食事", place.get("food_note")),
                ("授乳等", place.get("nursing_note")),
                ("ベビーカー", place.get("stroller_note")),
            ],
        )
        + detail_section(
            "情報元",
            [
                ("ソース", place.get("source_names")),
                ("最終確認", format_verified_date(place.get("last_verified_at")) or place.get("last_verified_at")),
            ],
        )
        + action_links(
            place.get("official_url"),
            "公式ページで最新を確認",
            "places",
            place.get("municipality") or "",
            maps_url(place),
        )
        + "</div>"
    )
    return layout(
        title,
        description,
        canonical,
        display_image,
        "群馬の子どもの遊び場",
        place.get("name"),
        kicker,
        body,
        place_structured_data(place, canonical),
    )


AREA_HUBS = [
    {
        "slug": "takasaki",
        "municipality": "高崎市",
        "title": "高崎市のイベント・遊び場",
        "lead": "駅周辺・もてなし広場のイベントと、児童施設・観音山方面の遊び場をまとめています。",
        "intro": [
            "高崎は交通の結節点で、もてなし広場周辺では季節のイベントがよく案内されます。一方で子どもと半日過ごすなら、駅前だけで完結せず、児童センターや科学館、観音山方面まで含めて考えると予定が立てやすくなります。",
            "イベント目的の日は会場周辺に集中し、遊び場目的の日は通年型の施設を軸にする。この切り替えが、高崎でのおでかけを安定させるコツです。詳しい考え方はおでかけガイドも参照してください。",
        ],
        "guide_links": [
            {"href": "../guides/takasaki-outing.html", "label": "高崎駅・もてなし広場周辺の考え方"},
            {"href": "../guides/how-to-find-events.html", "label": "イベントの探し方"},
        ],
    },
    {
        "slug": "maebashi",
        "municipality": "前橋市",
        "title": "前橋市のイベント・遊び場",
        "lead": "児童遊園、室内プレイ、児童文化施設、科学館など、半日の部品がそろいやすい街の一覧です。",
        "intro": [
            "前橋は、るなぱあくのような児童遊園、室内の遊び場、児童文化センター、科学館など、半日プランの部品が多い都市です。主目的を一つに絞り、昼食や買い物を副目的にするくらいが、詰め込みすぎを防ぐ現実的な組み立て方です。",
            "まつりや花火などイベントがある日は、通常より移動が遅くなりがちです。イベントを主目的にするなら遊び場を欲張らず、平常時に室内や科学館へ行く、と役割を分けると判断が速くなります。",
        ],
        "guide_links": [
            {"href": "../guides/maebashi-halfday.html", "label": "前橋の半日プランの作り方"},
            {"href": "../guides/infant-friendly.html", "label": "乳幼児連れの選び方"},
        ],
    },
    {
        "slug": "ota",
        "municipality": "太田市",
        "title": "太田市のイベント・遊び場",
        "lead": "太田市のイベントと、ぐんまこどもの国など親子向けの遊び場をまとめています。",
    },
    {
        "slug": "kiryu",
        "municipality": "桐生市",
        "title": "桐生市のイベント・遊び場",
        "lead": "桐生市のイベントと、屋内遊び場・児童館などの親子向けスポットをまとめています。",
    },
    {
        "slug": "isesaki",
        "municipality": "伊勢崎市",
        "title": "伊勢崎市のイベント・遊び場",
        "lead": "伊勢崎市のイベントと、児童センターなど子どもの遊び場を一覧で探せます。",
    },
    {
        "slug": "shibukawa",
        "municipality": "渋川市",
        "title": "渋川市のイベント・遊び場",
        "lead": "渋川市のイベントと、伊香保周辺を含む親子向けの遊び場をまとめています。",
    },
    {
        "slug": "tatebayashi",
        "municipality": "館林市",
        "title": "館林市のイベント・遊び場",
        "lead": "館林市のイベントと、科学館など子どもの遊び場をまとめています。",
    },
    {
        "slug": "annaka",
        "municipality": "安中市",
        "title": "安中市のイベント・遊び場",
        "lead": "安中市のイベントと、あんなかスマイルパークなど親子向けスポットをまとめています。",
    },
    {
        "slug": "numata",
        "municipality": "沼田市",
        "title": "沼田市のイベント・遊び場",
        "lead": "沼田市のイベントと、子ども広場など市内の遊び場を一覧で探せます。",
    },
    {
        "slug": "midori",
        "municipality": "みどり市",
        "title": "みどり市のイベント・遊び場",
        "lead": "みどり市のイベントと、子育て支援センターなど親子向けの遊び場をまとめています。",
    },
]

THEME_HUBS = [
    {
        "slug": "indoor",
        "title": "雨の日の屋内遊び",
        "lead": "屋内または屋内外対応の遊び場を中心にまとめました。雨の日でも候補を探しやすい一覧です。",
        "intro": [
            "雨の日は、候補を増やすより「何時間いるか」と「子どもの年齢」で先に切る方がうまくいきます。短時間なら時間制の室内プレイや公共のひろば、長めなら科学館や児童文化施設が向きやすいです。",
            "屋内施設は悪天候の日に混みやすいので、開館時間・休館日・混雑時の入れ替えを公式で確認してから出発してください。選び方の詳細はガイド記事にまとめています。",
        ],
        "guide_links": [
            {"href": "../guides/rainy-day-indoor.html", "label": "雨の日屋内遊び場の選び方"},
            {"href": "../guides/weekend-checklist.html", "label": "夏の週末チェックリスト"},
        ],
        "decision": "rain",
        "mode": "places",
    },
    {
        "slug": "free",
        "title": "無料で行けるおでかけ",
        "lead": "料金メモに「無料」とあるイベント・遊び場を集めました。無料の範囲は施設ごとに異なります。",
        "intro": [
            "入園無料でも遊具やのりものが有料、展示は無料でも体験は有料、といったケースがあります。一覧は比較のたたき台として使い、詳細ページの料金メモと公式案内で「何が無料か」を確認してください。",
            "低予算で済ませたい日は、完全無料だけを狙うより、上限を決めて短時間利用する方が後悔が少ないこともあります。見方のコツはガイドに整理しています。",
        ],
        "guide_links": [
            {"href": "../guides/free-or-budget.html", "label": "無料・低予算スポットの見方"},
        ],
        "decision": "free",
        "mode": "events",
    },
    {
        "slug": "infant",
        "title": "乳幼児向けのおでかけ",
        "lead": "乳幼児・未就園の記述がある遊び場・イベントを中心にまとめています。",
        "intro": [
            "乳幼児連れでは、遊具の派手さより、授乳・おむつ替え・休憩・同年代の子が多いか、といった安心要素が重要です。対象年齢や利用登録の要否は施設ごとに違うため、公開メモを見たうえで公式案内を確認してください。",
            "外出は短く設計し、初めての場所はピークを外す。兄弟がいる場合は年齢の低い子のペースを基準にすると、予定が崩れにくくなります。",
        ],
        "guide_links": [
            {"href": "../guides/infant-friendly.html", "label": "乳幼児連れで行きやすい遊び場"},
            {"href": "../guides/transport-with-kids.html", "label": "移動手段の考え方"},
        ],
        "decision": "infant",
        "mode": "places",
    },
]

INFANT_RE = re.compile(r"乳児|乳幼児|0歳|1歳|2歳|6か月|生後|未就園|よちよち|ベビー|赤ちゃん")
FREE_RE = re.compile(r"無料")


def is_upcoming_event(event):
    end = event.get("end_date") or event.get("start_date") or ""
    return bool(end) and end >= TODAY


def is_indoor_place(place):
    return place.get("indoor_outdoor") in {"indoor", "both"}


def is_free_record(record):
    return bool(FREE_RE.search(str(record.get("price_note") or "")))


def is_infant_record(record):
    text = " ".join(
        str(record.get(key) or "")
        for key in ("target_age_note", "features", "name", "title", "summary", "notes", "category")
    )
    return bool(INFANT_RE.search(text))


def hub_media(image_url, label):
    if image_url:
        return (
            f'<div class="hub-card__media">'
            f'<img src="{html(image_url)}" alt="{html(label or "")}" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
            f"</div>"
        )
    return '<div class="hub-card__media hub-card__media--empty" aria-hidden="true"></div>'


def hub_card_event(event):
    href = f"../events/{event['id']}.html"
    title = event.get("title") or ""
    venue = event.get("venue_name") or event.get("area_label") or ""
    place_line = " / ".join(part for part in [event.get("municipality"), venue] if part)
    date_label = format_month_day(event.get("start_date")) if event.get("start_date") else ""
    time = time_text(event)
    display_image = best_display_image(event)
    has_image = " has-image" if display_image else ""
    when_bits = []
    if date_label:
        when_bits.append(f'<span class="meta-item">{ui_icon("calendar")}{html(date_label)}</span>')
    if time:
        when_bits.append(f'<span class="meta-item">{ui_icon("clock")}{html(time)}</span>')
    where_bits = [
        f'<span class="meta-item">{ui_icon("pin")}{html(place_line or "地域未設定")}</span>',
        f'<span class="meta-item">{ui_icon("yen")}{html(fact_or_confirm(compact_text(event.get("price_note"), 28)))}</span>',
    ]
    when_html = f'<p class="card-kicker card-kicker--when">{"".join(when_bits)}</p>' if when_bits else ""
    return (
        f'<a class="hub-card{has_image}" href="{html(href)}">'
        f"{hub_media(display_image, title)}"
        f'<div class="hub-card__body">'
        f"<strong>{html(title)}</strong>"
        f"{when_html}"
        f'<p class="card-kicker card-kicker--where">{"".join(where_bits)}</p>'
        f"</div>"
        f"</a>"
    )


def hub_card_place(place):
    href = f"../places/{place['id']}.html"
    title = place.get("name") or ""
    indoor = INDOOR_OUTDOOR_LABELS.get(place.get("indoor_outdoor"), "")
    display_image = best_display_image(place)
    has_image = " has-image" if display_image else ""
    indoor_icon = "sun" if place.get("indoor_outdoor") == "outdoor" else "home"
    when_bits = [
        f'<span class="meta-item">{ui_icon("pin")}{html(place.get("municipality") or place.get("prefecture") or "地域未設定")}</span>'
    ]
    if indoor:
        when_bits.append(f'<span class="meta-item">{ui_icon(indoor_icon)}{html(indoor)}</span>')
    return (
        f'<a class="hub-card{has_image}" href="{html(href)}">'
        f"{hub_media(display_image, title)}"
        f'<div class="hub-card__body">'
        f"<strong>{html(title)}</strong>"
        f'<p class="card-kicker card-kicker--when">{"".join(when_bits)}</p>'
        f'<p class="card-kicker card-kicker--where"><span class="meta-item">{ui_icon("yen")}{html(fact_or_confirm(compact_text(place.get("price_note"), 28)))}</span></p>'
        f"</div>"
        f"</a>"
    )


def format_month_day(value):
    if not value or len(str(value)) < 10:
        return ""
    raw = str(value)[:10]
    try:
        month = int(raw[5:7])
        day = int(raw[8:10])
    except ValueError:
        return ""
    return f"{month}/{day}"


def hub_section(title, cards, empty_text):
    if not cards:
        return (
            f'<section class="static-detail-section detail-section"><h2>{html(title)}</h2>'
            f'<p class="detail-copy">{html(empty_text)}</p></section>'
        )
    return (
        f'<section class="static-detail-section detail-section"><h2>{html(title)}</h2>'
        f'<div class="hub-card-grid event-list">{"".join(cards)}</div></section>'
    )


def hub_intro_html(hub):
    paragraphs = hub.get("intro") or []
    guide_links = hub.get("guide_links") or []
    if not paragraphs and not guide_links:
        return ""
    parts = ['<section class="static-detail-section hub-intro">']
    if paragraphs:
        parts.append("<h2>このページの使い方</h2>")
        parts.extend(f'<p class="detail-copy">{html(paragraph)}</p>' for paragraph in paragraphs)
    if guide_links:
        items = []
        for link in guide_links:
            items.append(f'<li><a href="{html(link["href"])}">{html(link["label"])}</a></li>')
        parts.append('<ul class="guide-related">' + "".join(items) + "</ul>")
    parts.append("</section>")
    return "".join(parts)


def render_area_hub(hub, events, places):
    muni = hub["municipality"]
    event_items = [e for e in events if e.get("municipality") == muni and is_upcoming_event(e)]
    event_items.sort(key=lambda e: (e.get("start_date") or "", e.get("title") or ""))
    place_items = [p for p in places if p.get("municipality") == muni]
    place_items.sort(key=lambda p: (p.get("place_type") or "", p.get("name") or ""))
    canonical = f"{BASE_URL}/areas/{hub['slug']}.html"
    list_href = f"../?municipality={url_quote(muni)}#eventList"
    description = compact(
        f"群馬県{muni}のイベント{len(event_items)}件、子どもの遊び場{len(place_items)}件。"
        f"{hub['lead']}",
        155,
    )
    body = (
        '<div class="static-detail-head">'
        f'<p class="eyebrow">地域からさがす</p><h1>{html(hub["title"])}</h1>'
        f'<p class="lead">{html(hub["lead"])}</p>'
        f'<div class="detail-fact-strip">'
        f'<span><b>{ui_icon("ticket")}イベント</b>{len(event_items)}件</span>'
        f'<span><b>{ui_icon("play")}遊び場</b>{len(place_items)}件</span>'
        f"<span><b>{ui_icon('pin')}対象</b>{html(muni)}</span>"
        f"</div></div><div class=\"static-detail-body\">"
        + hub_intro_html(hub)
        + hub_section("開催予定のイベント", [hub_card_event(e) for e in event_items], "現在、掲載中の開催予定イベントはありません。")
        + hub_section("子どもの遊び場", [hub_card_place(p) for p in place_items], "現在、掲載中の遊び場はありません。")
        +         f'<div class="dialog-actions static-detail-actions">'
        f'<a class="primary-button" href="{html(list_href)}">{ui_icon("list")}一覧で絞り込む</a>'
        f'<a class="secondary-button" href="../themes/">{ui_icon("layers")}テーマから探す</a>'
        f'<a class="secondary-button" href="../guides/">{ui_icon("book")}おでかけガイド</a>'
        f"</div></div>"
    )
    return layout(
        f"{hub['title']}｜群馬イベントナビ",
        description,
        canonical,
        None,
        "地域",
        hub["title"],
        hub["lead"],
        body,
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": hub["title"],
            "url": canonical,
            "description": description,
            "isPartOf": {"@type": "WebSite", "name": "群馬イベントナビ", "url": f"{BASE_URL}/"},
            "about": {"@type": "Place", "name": muni, "address": {"@type": "PostalAddress", "addressRegion": "群馬県"}},
        },
        body_class="static-detail-page hub-page",
    )


def render_theme_hub(hub, events, places):
    slug = hub["slug"]
    if slug == "indoor":
        event_items = []
        place_items = [p for p in places if is_indoor_place(p)]
    elif slug == "free":
        event_items = [e for e in events if is_upcoming_event(e) and is_free_record(e)]
        place_items = [p for p in places if is_free_record(p)]
    else:  # infant
        event_items = [e for e in events if is_upcoming_event(e) and is_infant_record(e)]
        place_items = [p for p in places if is_infant_record(p)]

    event_items.sort(key=lambda e: (e.get("start_date") or "", e.get("title") or ""))
    place_items.sort(key=lambda p: (p.get("municipality") or "", p.get("name") or ""))
    canonical = f"{BASE_URL}/themes/{hub['slug']}.html"
    list_href = f"../?decision={url_quote(hub['decision'])}&mode={url_quote(hub['mode'])}#eventList"
    description = compact(
        f"{hub['title']}。イベント{len(event_items)}件、遊び場{len(place_items)}件。"
        f"{hub['lead']}",
        155,
    )
    body = (
        '<div class="static-detail-head">'
        f'<p class="eyebrow">テーマからさがす</p><h1>{html(hub["title"])}</h1>'
        f'<p class="lead">{html(hub["lead"])}</p>'
        f'<div class="detail-fact-strip">'
        f'<span><b>{ui_icon("ticket")}イベント</b>{len(event_items)}件</span>'
        f'<span><b>{ui_icon("play")}遊び場</b>{len(place_items)}件</span>'
        f"</div></div><div class=\"static-detail-body\">"
        + hub_intro_html(hub)
        + hub_section("イベント", [hub_card_event(e) for e in event_items], "条件に合う開催予定イベントは現在ありません。")
        + hub_section("遊び場", [hub_card_place(p) for p in place_items], "条件に合う遊び場は現在ありません。")
        +         f'<div class="dialog-actions static-detail-actions">'
        f'<a class="primary-button" href="{html(list_href)}">{ui_icon("list")}一覧で同じ条件を開く</a>'
        f'<a class="secondary-button" href="../areas/">{ui_icon("map")}地域から探す</a>'
        f'<a class="secondary-button" href="../guides/">{ui_icon("book")}おでかけガイド</a>'
        f"</div></div>"
    )
    return layout(
        f"{hub['title']}｜群馬イベントナビ",
        description,
        canonical,
        None,
        "テーマ",
        hub["title"],
        hub["lead"],
        body,
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": hub["title"],
            "url": canonical,
            "description": description,
            "isPartOf": {"@type": "WebSite", "name": "群馬イベントナビ", "url": f"{BASE_URL}/"},
        },
        body_class="static-detail-page hub-page",
    )


def render_hub_index(kind, hubs, description):
    canonical = f"{BASE_URL}/{kind}/"
    cards = []
    for hub in hubs:
        href = f"./{hub['slug']}.html"
        cards.append(
            f'<a class="hub-card" href="{html(href)}">'
            f"<strong>{html(hub['title'])}</strong>"
            f"<span>{html(hub.get('municipality') or 'テーマ')}</span>"
            f"<small>{html(hub['lead'])}</small>"
            "</a>"
        )
    label = "地域" if kind == "areas" else "テーマ"
    body = (
        '<div class="static-detail-head">'
        f'<p class="eyebrow">群馬イベントナビ</p><h1>{html(label)}からさがす</h1>'
        f'<p class="lead">{html(description)}</p>'
        "</div><div class=\"static-detail-body\">"
        f'<div class="hub-card-grid">{"".join(cards)}</div>'
        '<div class="dialog-actions static-detail-actions">'
        '<a class="primary-button" href="../#eventList">トップの一覧へ</a>'
        "</div></div>"
    )
    # hub index uses ./ links; layout assumes ../ for assets — keep ../ for css from areas/index
    return layout(
        f"{label}からさがす｜群馬イベントナビ",
        description,
        canonical,
        None,
        label,
        f"{label}からさがす",
        description,
        body,
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": f"{label}からさがす",
            "url": canonical,
            "description": description,
        },
        body_class="static-detail-page hub-page",
    )


def section(title, content_html):
    return (
        f'<section class="static-detail-section detail-section"><h2>{html(title)}</h2>'
        f"{content_html}</section>"
    )


def render_about():
    canonical = f"{BASE_URL}/about.html"
    description = (
        "群馬イベントナビの運営方針、情報の集め方、更新の考え方、お問い合わせ方法について説明します。"
    )
    body = (
        '<div class="static-detail-head">'
        '<p class="eyebrow">群馬イベントナビ</p>'
        "<h1>運営について</h1>"
        f'<p class="lead">{html(description)}</p>'
        f'<p class="policy-updated">最終更新日：{html(TODAY_JA)}</p>'
        "</div><div class=\"static-detail-body info-page-body\">"
        + section(
            "このサイトについて",
            "<p class=\"detail-copy\">群馬イベントナビ（aso-aso.com）は、群馬県内のイベントや子どもの遊び場を、"
            "市町村・日程・テーマから探しやすくするための地域情報ナビです。"
            "公式サイトや観光協会などの公開情報をもとに、週末のおでかけ検討を助けることを目的としています。</p>",
        )
        + section(
            "運営者",
            "<p class=\"detail-copy\">本サイトは個人により運営しています。"
            "自治体や観光協会、各施設・イベント主催者の公式サイトではありません。</p>",
        )
        + section(
            "情報の集め方と更新",
            "<ul>"
            "<li>自治体・観光協会・施設・主催者などが公開している情報を確認し、一覧化しています。</li>"
            "<li>掲載内容は随時見直しを行いますが、変更の反映には時間がかかることがあります。</li>"
            "<li>日時・料金・開催可否などは変更されることがあるため、来場前に公式情報での確認をお願いします。</li>"
            "<li>SNSのみで告知されている情報など、公式確認が不十分な場合はその旨を記載することがあります。</li>"
            "</ul>",
        )
        + section(
            "掲載内容について",
            "<p class=\"detail-copy\">本サイトの情報は参考情報として提供しています。"
            "正確性や最新性を保証するものではなく、掲載内容に基づく判断や行動の結果について責任を負いません。"
            "画像や説明文の一部は情報源の公開ページに由来する場合があります。"
            "権利者からの削除・訂正のご要望には速やかに対応します。</p>",
        )
        + section(
            "お問い合わせ",
            "<p class=\"detail-copy\">誤情報の指摘、掲載削除のご依頼、その他のご質問はお問い合わせフォームからご連絡ください。</p>"
            "<ul>"
            f'<li><a href="{CONTACT_FORM_URL}" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a></li>'
            f'<li><a href="{LISTING_FORM_URL}" target="_blank" rel="noopener noreferrer">サイト掲載についてのフォーム</a></li>'
            '<li><a href="./privacy.html">プライバシーポリシー</a></li>'
            "</ul>",
        )
        + '<div class="dialog-actions static-detail-actions">'
        '<a class="primary-button" href="./#eventList">トップの一覧へ</a>'
        "</div></div>"
    )
    return layout(
        "運営について｜群馬イベントナビ",
        description,
        canonical,
        None,
        "運営",
        "運営について",
        description,
        body,
        {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "name": "運営について",
            "url": canonical,
            "description": description,
            "isPartOf": {"@type": "WebSite", "name": "群馬イベントナビ", "url": f"{BASE_URL}/"},
        },
        body_class="static-detail-page info-page",
        asset_prefix="./",
    )


def render_privacy():
    canonical = f"{BASE_URL}/privacy.html"
    description = (
        "群馬イベントナビのプライバシーポリシーです。アクセス解析、広告配信、Cookieの取り扱いについて説明します。"
    )
    body = (
        '<div class="static-detail-head">'
        '<p class="eyebrow">群馬イベントナビ</p>'
        "<h1>プライバシーポリシー</h1>"
        f'<p class="lead">{html(description)}</p>'
        f'<p class="policy-updated">最終更新日：{html(TODAY_JA)}</p>'
        "</div><div class=\"static-detail-body info-page-body\">"
        + section(
            "基本方針",
            "<p class=\"detail-copy\">群馬イベントナビ（以下「当サイト」）は、利用者のプライバシーを尊重し、"
            "取得した情報を適切に取り扱います。本ポリシーでは、当サイトにおける情報の取り扱いについて説明します。</p>",
        )
        + section(
            "取得する情報",
            "<p class=\"detail-copy\">当サイトでは、サービス提供・改善および広告配信のために、次のような情報を取得することがあります。</p>"
            "<ul>"
            "<li>Cookie、端末識別子、ブラウザ種別、閲覧ページ、参照元、アクセス日時などの利用状況</li>"
            "<li>お問い合わせフォーム送信時に、利用者ご自身が入力した氏名・メールアドレス・問い合わせ内容など</li>"
            "<li>広告配信やアクセス解析の過程で、第三者により取得される利用データ</li>"
            "</ul>"
            "<p class=\"detail-copy\">当サイトが会員登録や購入決済を行うことはありません。</p>",
        )
        + section(
            "利用目的",
            "<ul>"
            "<li>サイトの利用状況の把握、コンテンツ改善、表示の最適化</li>"
            "<li>お問い合わせへの対応</li>"
            "<li>不正利用の防止、サイト運営上の安全管理</li>"
            "<li>第三者配信による広告の表示および効果測定</li>"
            "</ul>",
        )
        + section(
            "アクセス解析ツールについて",
            "<p class=\"detail-copy\">当サイトでは Google アナリティクスを利用しています。"
            "Google アナリティクスは Cookie などを用いて利用者のサイト利用状況を収集します。"
            "収集されたデータは Google のプライバシーポリシーに基づいて管理されます。"
            "詳細は "
            '<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google のプライバシーポリシー</a>'
            " および "
            '<a href="https://support.google.com/analytics/answer/6004245?hl=ja" target="_blank" rel="noopener noreferrer">'
            "Google アナリティクス利用時の情報の取り扱い</a>"
            " をご確認ください。</p>",
        )
        + section(
            "広告配信について（Google AdSense）",
            "<p class=\"detail-copy\">当サイトでは、第三者配信事業者である Google を含む広告サービスを利用する場合があります。"
            "Google などの広告配信事業者は、Cookie を使用して、当サイトや他サイトへの過去のアクセス情報に基づき広告を配信することがあります。"
            "利用者は "
            '<a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer">Google 広告設定</a>'
            " からパーソナライズド広告を無効にできます。"
            "また、一般社団法人日本インタラクティブ広告協会（JIAA）などの提供するオプトアウト手段を利用できる場合があります。"
            "詳細は "
            '<a href="https://policies.google.com/technologies/ads?hl=ja" target="_blank" rel="noopener noreferrer">'
            "Google の広告に関するポリシー</a>"
            " をご確認ください。</p>",
        )
        + section(
            "Cookie について",
            "<p class=\"detail-copy\">Cookie は、ウェブサイトがブラウザに保存する小さなデータです。"
            "当サイトおよび第三者サービスは、利便性向上、アクセス解析、広告配信のために Cookie を使用することがあります。"
            "ブラウザの設定により Cookie を拒否・削除できますが、一部機能が利用できなくなる場合があります。</p>",
        )
        + section(
            "第三者への提供",
            "<p class=\"detail-copy\">法令に基づく場合を除き、利用者の同意なく個人を特定できる情報を第三者に提供しません。"
            "ただし、アクセス解析や広告配信のため、Cookie 等を通じて第三者が利用データを取得する場合があります。</p>",
        )
        + section(
            "お問い合わせフォームの取り扱い",
            "<p class=\"detail-copy\">お問い合わせ時に送信された情報は、問い合わせ対応の目的でのみ利用し、"
            "対応完了後は必要に応じて適切に削除または管理します。"
            "フォーム提供サービス（Google フォーム等）の利用に伴い、当該サービスの規約・プライバシーポリシーも適用されます。</p>",
        )
        + section(
            "免責・外部リンク",
            "<p class=\"detail-copy\">当サイトからリンクする外部サイトにおける個人情報の取り扱いについて、当サイトは責任を負いません。"
            "リンク先のポリシーをご確認ください。</p>",
        )
        + section(
            "本ポリシーの変更",
            "<p class=\"detail-copy\">必要に応じて本ポリシーを改定することがあります。"
            "重要な変更がある場合は、当ページの更新をもってお知らせします。</p>",
        )
        + section(
            "お問い合わせ窓口",
            "<p class=\"detail-copy\">本ポリシーに関するお問い合わせは、以下のフォームよりご連絡ください。</p>"
            "<ul>"
            f'<li><a href="{CONTACT_FORM_URL}" target="_blank" rel="noopener noreferrer">お問い合わせフォーム</a></li>'
            '<li><a href="./about.html">運営について</a></li>'
            "</ul>",
        )
        + '<div class="dialog-actions static-detail-actions">'
        '<a class="primary-button" href="./#eventList">トップの一覧へ</a>'
        "</div></div>"
    )
    return layout(
        "プライバシーポリシー｜群馬イベントナビ",
        description,
        canonical,
        None,
        "プライバシー",
        "プライバシーポリシー",
        description,
        body,
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "プライバシーポリシー",
            "url": canonical,
            "description": description,
            "isPartOf": {"@type": "WebSite", "name": "群馬イベントナビ", "url": f"{BASE_URL}/"},
        },
        body_class="static-detail-page info-page",
        asset_prefix="./",
    )


def load_guides():
    with (ROOT / "data/guides.json").open(encoding="utf-8") as f:
        return json.load(f).get("guides", [])


def format_guide_date(value):
    if not value or len(str(value)) < 10:
        return TODAY_JA
    raw = str(value)[:10]
    try:
        year, month, day = int(raw[0:4]), int(raw[5:7]), int(raw[8:10])
    except ValueError:
        return TODAY_JA
    return f"{year}年{month}月{day}日"


def render_guide_section(section_data):
    parts = [
        '<section class="static-detail-section guide-section">',
        f"<h2>{html(section_data.get('heading'))}</h2>",
    ]
    for paragraph in section_data.get("paragraphs") or []:
        parts.append(f'<p class="detail-copy">{html(paragraph)}</p>')
    bullets = section_data.get("bullets") or []
    if bullets:
        parts.append("<ul>" + "".join(f"<li>{html(item)}</li>" for item in bullets) + "</ul>")
    links = section_data.get("links") or []
    if links:
        items = []
        for link in links:
            href = link.get("href") or ""
            label = link.get("label") or href
            if link.get("external"):
                items.append(
                    f'<li><a href="{html(href)}" target="_blank" rel="noopener noreferrer">{html(label)}</a></li>'
                )
            else:
                items.append(f'<li><a href="{html(href)}">{html(label)}</a></li>')
        parts.append('<ul class="guide-inline-links">' + "".join(items) + "</ul>")
    parts.append("</section>")
    return "".join(parts)


def render_related_guides(guide, guides):
    by_slug = {item["slug"]: item for item in guides}
    items = []
    for slug in guide.get("related") or []:
        other = by_slug.get(slug)
        if other:
            items.append(f'<li><a href="./{html(other["slug"])}.html">{html(other["title"])}</a></li>')
    if not items:
        return ""
    return (
        '<section class="static-detail-section guide-section">'
        "<h2>関連ガイド</h2>"
        f'<ul class="guide-related">{"".join(items)}</ul>'
        "</section>"
    )


def render_guide(guide, guides):
    canonical = f"{BASE_URL}/guides/{guide['slug']}.html"
    description = guide.get("description") or guide.get("lead") or guide.get("title")
    updated = format_guide_date(guide.get("updated"))
    body = (
        '<div class="static-detail-head">'
        f'<p class="eyebrow">{html(guide.get("eyebrow") or "おでかけガイド")}</p>'
        f'<h1>{html(guide.get("title"))}</h1>'
        f'<p class="lead">{html(guide.get("lead") or description)}</p>'
        f'<p class="policy-updated">更新日：{html(updated)}</p>'
        '</div><div class="static-detail-body info-page-body guide-body">'
        + "".join(render_guide_section(section_data) for section_data in guide.get("sections") or [])
        + render_related_guides(guide, guides)
        + '<div class="dialog-actions static-detail-actions">'
        '<a class="primary-button" href="./">ガイド一覧</a>'
        '<a class="secondary-button" href="../#eventList">トップの一覧へ</a>'
        '<a class="secondary-button" href="../themes/">テーマから探す</a>'
        "</div></div>"
    )
    return layout(
        f"{guide.get('title')}｜群馬イベントナビ",
        description,
        canonical,
        None,
        "ガイド",
        guide.get("title"),
        description,
        body,
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": guide.get("title"),
            "description": description,
            "dateModified": guide.get("updated") or TODAY,
            "inLanguage": "ja",
            "author": {"@type": "Organization", "name": "群馬イベントナビ"},
            "mainEntityOfPage": canonical,
            "isPartOf": {"@type": "WebSite", "name": "群馬イベントナビ", "url": f"{BASE_URL}/"},
        },
        body_class="static-detail-page info-page guide-page",
        asset_prefix="../",
    )


def render_guides_index(guides):
    canonical = f"{BASE_URL}/guides/"
    description = "群馬でのイベントや親子おでかけの選び方をまとめた編集ガイドです。雨の日、乳幼児、高崎・前橋、無料、移動の考え方など。"
    cards = []
    for guide in guides:
        cards.append(
            f'<a class="hub-card" href="./{html(guide["slug"])}.html">'
            f'<div class="hub-card__body">'
            f"<strong>{html(guide['title'])}</strong>"
            f'<p class="card-kicker"><span class="meta-item">{ui_icon("book")}{html(guide.get("eyebrow") or "おでかけガイド")}</span></p>'
            f"<small>{html(guide.get('description') or guide.get('lead') or '')}</small>"
            f"</div></a>"
        )
    body = (
        '<div class="static-detail-head">'
        '<p class="eyebrow">群馬イベントナビ</p>'
        "<h1>おでかけガイド</h1>"
        f'<p class="lead">{html(description)}</p>'
        "</div><div class=\"static-detail-body\">"
        '<section class="static-detail-section detail-section">'
        f"<h2>{ui_icon('book')}記事一覧</h2>"
        f'<div class="hub-card-grid">{"".join(cards)}</div>'
        "</section>"
        '<div class="dialog-actions static-detail-actions">'
        f'<a class="primary-button" href="../#eventList">{ui_icon("list")}トップの一覧へ</a>'
        f'<a class="secondary-button" href="../areas/">{ui_icon("map")}地域から探す</a>'
        f'<a class="secondary-button" href="../themes/">{ui_icon("layers")}テーマから探す</a>'
        "</div></div>"
    )
    return layout(
        "おでかけガイド｜群馬イベントナビ",
        description,
        canonical,
        None,
        "ガイド",
        "おでかけガイド",
        description,
        body,
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "おでかけガイド",
            "url": canonical,
            "description": description,
        },
        body_class="static-detail-page hub-page guide-index-page",
        asset_prefix="../",
    )


def render_sitemap(events, places, area_hubs, theme_hubs, guides):
    urls = [(f"{BASE_URL}/", "1.0", "daily")]
    urls.append((f"{BASE_URL}/about.html", "0.4", "yearly"))
    urls.append((f"{BASE_URL}/privacy.html", "0.4", "yearly"))
    urls.append((f"{BASE_URL}/guides/", "0.8", "weekly"))
    urls.extend((f"{BASE_URL}/guides/{guide['slug']}.html", "0.7", "monthly") for guide in guides)
    urls.append((f"{BASE_URL}/areas/", "0.8", "weekly"))
    urls.append((f"{BASE_URL}/themes/", "0.8", "weekly"))
    urls.extend((f"{BASE_URL}/areas/{hub['slug']}.html", "0.8", "weekly") for hub in area_hubs)
    urls.extend((f"{BASE_URL}/themes/{hub['slug']}.html", "0.8", "weekly") for hub in theme_hubs)
    urls.extend((event_url(event), "0.8", "weekly") for event in events)
    urls.extend((place_url(place), "0.8", "monthly") for place in places)
    items = []
    for loc, priority, changefreq in urls:
        items.append(
            "  <url>\n"
            f"    <loc>{html(loc)}</loc>\n"
            f"    <lastmod>{TODAY}</lastmod>\n"
            f"    <changefreq>{changefreq}</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            "  </url>"
        )
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(items) + "\n</urlset>\n"


def main():
    with (ROOT / "data/events.json").open(encoding="utf-8") as f:
        data = json.load(f)
    events = data.get("events", [])
    places = data.get("child_play_places", [])
    guides = load_guides()
    clean_dir("events")
    clean_dir("places")
    clean_dir("areas")
    clean_dir("themes")
    clean_dir("guides")
    for event in events:
        write(ROOT / "events" / f"{event['id']}.html", render_event(event))
    for place in places:
        write(ROOT / "places" / f"{place['id']}.html", render_place(place))
    for hub in AREA_HUBS:
        write(ROOT / "areas" / f"{hub['slug']}.html", render_area_hub(hub, events, places))
    for hub in THEME_HUBS:
        write(ROOT / "themes" / f"{hub['slug']}.html", render_theme_hub(hub, events, places))
    for guide in guides:
        write(ROOT / "guides" / f"{guide['slug']}.html", render_guide(guide, guides))
    write(ROOT / "guides" / "index.html", render_guides_index(guides))
    write(
        ROOT / "areas" / "index.html",
        render_hub_index("areas", AREA_HUBS, "高崎・前橋・太田・桐生・伊勢崎など、主要都市のイベントと遊び場をまとめています。"),
    )
    write(
        ROOT / "themes" / "index.html",
        render_hub_index("themes", THEME_HUBS, "雨の日屋内、無料、乳幼児向けなど、予定が決まりやすいテーマから探せます。"),
    )
    write(ROOT / "about.html", render_about())
    write(ROOT / "privacy.html", render_privacy())
    write(ROOT / "sitemap.xml", render_sitemap(events, places, AREA_HUBS, THEME_HUBS, guides))
    print(
        f"generated {len(events)} events, {len(places)} places, "
        f"{len(AREA_HUBS)} area hubs, {len(THEME_HUBS)} theme hubs, "
        f"{len(guides)} guides, about, privacy"
    )


if __name__ == "__main__":
    main()
