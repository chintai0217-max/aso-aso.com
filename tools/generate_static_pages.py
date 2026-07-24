#!/usr/bin/env python3
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
GA_MEASUREMENT_ID = "G-ZWE0042E90"

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


def image_tag(url, alt):
    if not url:
        return ""
    return (
        '<div class="static-detail-image">'
        f'<img src="{html(url)}" alt="{html(alt)}" loading="eager" decoding="async" referrerpolicy="no-referrer" '
        'onerror="this.closest(\'.static-detail-image\').hidden=true">'
        "</div>"
    )


def gallery_html(images, alt):
    items = []
    seen = set()
    for image in images or []:
        url = image.get("image_url") if isinstance(image, dict) else None
        if not url or url in seen:
            continue
        seen.add(url)
        items.append(image if isinstance(image, dict) else {"image_url": url})
    items = filter_relevant_images(items, alt)
    if len(items) <= 1:
        return ""
    thumbs = []
    for image in items[1:5]:
        href = image.get("source_page_url") or image.get("image_url")
        thumbs.append(
            f'<a href="{html(href)}" target="_blank" rel="noreferrer" class="gallery-thumb">'
            f'<img src="{html(image.get("image_url"))}" alt="{html(image.get("alt_text") or alt)}" '
            'loading="lazy" decoding="async" referrerpolicy="no-referrer">'
            "</a>"
        )
    return f'<div class="photo-gallery" aria-label="写真ギャラリー">{"".join(thumbs)}</div>'


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
    return matched if len(matched) > 1 else images[:1]


def fact_strip(items):
    cells = []
    for label, value in items:
        if not value:
            continue
        cells.append(f"<span><b>{html(label)}</b>{html(value)}</span>")
    if not cells:
        return ""
    return f'<div class="detail-fact-strip">{"".join(cells)}</div>'


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
    </script>"""


def layout(title, description, canonical, image, kind_label, h1, kicker, body, structured_data, body_class="static-detail-page"):
    og_image = image or f"{BASE_URL}/og-image.png"
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
    <link rel="icon" href="../favicon.ico" sizes="any">
    <link rel="icon" href="../favicon.svg" type="image/svg+xml">
    <link rel="icon" href="../favicon-32.png" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="../apple-touch-icon.png" sizes="180x180">
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
    <link rel="stylesheet" href="../styles.css">
    <script type="application/ld+json">{json_ld(structured_data)}</script>
  </head>
  <body class="{html(body_class)}">
    <nav class="topbar" aria-label="サイト内ナビゲーション">
      <div class="topbar-inner">
        <a class="brand" href="../">
          <span class="brand-mark">群</span>
          <span>
            <strong>群馬イベントナビ</strong>
            <small>イベント・遊び場データベース</small>
          </span>
        </a>
        <div class="topbar-links">
          <a href="../#eventList">一覧へ戻る</a>
          <a href="../areas/">地域</a>
          <a href="../themes/">テーマ</a>
        </div>
      </div>
    </nav>
    <main class="static-detail-shell">
      <article class="static-detail">
        {body}
      </article>
    </main>
  </body>
</html>
"""


def details(items):
    rows = []
    for label, value in items:
        if value:
            rows.append(f"<dt>{html(label)}</dt><dd>{html(value)}</dd>")
    if not rows:
        return ""
    return '<dl class="detail-grid static-detail-grid">' + "".join(rows) + "</dl>"


def detail_section(title, items):
    grid = details(items)
    if not grid:
        return ""
    return f'<section class="static-detail-section detail-section"><h2>{html(title)}</h2>{grid}</section>'


def action_links(primary_url, primary_label, home_query, map_link=""):
    query = url_quote(str(home_query or ""))
    links = []
    if primary_url:
        links.append(
            f'<a class="primary-button" href="{html(primary_url)}" target="_blank" rel="noreferrer">{html(primary_label)}</a>'
        )
    if map_link:
        links.append(f'<a class="secondary-button" href="{html(map_link)}" target="_blank" rel="noreferrer">地図で見る</a>')
    links.append(f'<a class="secondary-button" href="../?q={html(query)}">一覧で探す</a>')
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
    if event.get("primary_image_url"):
        event_schema["image"] = [event["primary_image_url"]]
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
    if place.get("primary_image_url"):
        place_schema["image"] = [place["primary_image_url"]]
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
    body = (
        image_tag(event.get("primary_image_url"), event.get("title"))
        + '<div class="static-detail-head">'
        + f'<p class="eyebrow">群馬のイベント</p><h1>{html(event.get("title"))}</h1>'
        + f'<p class="lead">{html(kicker)}</p>'
        + fact_strip(
            [
                ("開催日", date_short),
                ("時間", time_text(event)),
                ("会場", event.get("venue_name")),
                ("料金", event.get("price_note")),
                ("最終確認", format_verified_date(event.get("last_verified_at"))),
            ]
        )
        + "</div><div class=\"static-detail-body\">"
        + section_paragraph("概要", event.get("summary"))
        + section_paragraph("補足", event.get("notes"))
        + gallery_html(event.get("images"), event.get("title"))
        + detail_section(
            "会場・アクセス",
            [
                ("住所", event.get("address")),
                ("地域", location),
                ("エリア", event.get("area_label")),
            ],
        )
        + detail_section(
            "主催・情報元",
            [
                ("主催", event.get("organizer")),
                ("カテゴリ", category),
                ("開催期間", date_long if date_long != date_short else ""),
                ("ソース", event.get("source_names")),
                ("最終確認", event.get("last_verified_at")),
            ],
        )
        + action_links(
            event.get("canonical_url"),
            "公式ページを見る",
            event.get("title"),
            maps_url(event),
        )
        + "</div>"
    )
    return layout(
        title,
        description,
        canonical,
        event.get("primary_image_url"),
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
    body = (
        image_tag(place.get("primary_image_url"), place.get("name"))
        + '<div class="static-detail-head">'
        + f'<p class="eyebrow">群馬の子どもの遊び場</p><h1>{html(place.get("name"))}</h1>'
        + f'<p class="lead">{html(kicker)}</p>'
        + fact_strip(
            [
                ("対象", compact_text(place.get("target_age_note"))),
                ("料金", compact_text(place.get("price_note"))),
                ("時間", compact_text(place.get("hours_note"))),
                ("屋内/屋外", indoor),
                ("最終確認", format_verified_date(place.get("last_verified_at"))),
            ]
        )
        + "</div><div class=\"static-detail-body\">"
        + section_paragraph("特徴", place.get("features"))
        + section_paragraph("補足", place.get("notes"))
        + gallery_html(place.get("images"), place.get("name"))
        + detail_section(
            "利用案内",
            [
                ("対象", place.get("target_age_note")),
                ("料金", place.get("price_note")),
                ("利用時間", place.get("hours_note")),
                ("休み", place.get("closed_note")),
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
                ("最終確認", place.get("last_verified_at")),
            ],
        )
        + action_links(
            place.get("official_url"),
            "公式ページを見る",
            place.get("name"),
            maps_url(place),
        )
        + "</div>"
    )
    return layout(
        title,
        description,
        canonical,
        place.get("primary_image_url"),
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
        "lead": "高崎市のもてなし広場周辺イベントや、親子で行ける遊び場をまとめています。",
    },
    {
        "slug": "maebashi",
        "municipality": "前橋市",
        "title": "前橋市のイベント・遊び場",
        "lead": "前橋市のイベントと子どもの遊び場を一覧で探せます。",
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
        "lead": "屋内または屋内外対応の遊び場を中心にまとめました。雨の日でも出かけやすい候補です。",
        "decision": "rain",
        "mode": "places",
    },
    {
        "slug": "free",
        "title": "無料で行けるおでかけ",
        "lead": "料金メモに「無料」とあるイベント・遊び場を集めました。詳細は公式でご確認ください。",
        "decision": "free",
        "mode": "events",
    },
    {
        "slug": "infant",
        "title": "乳幼児向けのおでかけ",
        "lead": "乳幼児・未就園の記述がある遊び場・イベントを中心にまとめています。",
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
    meta = " / ".join(
        part
        for part in [
            event.get("municipality"),
            CATEGORY_LABELS.get(event.get("category"), event.get("category")),
            date_text_compact(event),
        ]
        if part
    )
    badge = format_month_day(event.get("start_date")) if event.get("start_date") else ""
    badge_html = f'<div class="hub-card__badge"><strong>{html(badge)}</strong></div>' if badge else ""
    has_image = " has-image" if event.get("primary_image_url") else ""
    return (
        f'<a class="hub-card{has_image}" href="{html(href)}">'
        f"{hub_media(event.get('primary_image_url'), title)}"
        f"{badge_html}"
        f'<div class="hub-card__body">'
        f'<p class="card-kicker">{html(meta)}</p>'
        f"<strong>{html(title)}</strong>"
        f"<small>{html(compact_text(event.get('summary') or event.get('venue_name'), 70))}</small>"
        f"</div>"
        f"</a>"
    )


def hub_card_place(place):
    href = f"../places/{place['id']}.html"
    title = place.get("name") or ""
    meta = " / ".join(
        part
        for part in [
            place.get("municipality"),
            PLACE_TYPE_LABELS.get(place.get("place_type"), place.get("place_type")),
            INDOOR_OUTDOOR_LABELS.get(place.get("indoor_outdoor"), place.get("indoor_outdoor")),
        ]
        if part
    )
    indoor = INDOOR_OUTDOOR_LABELS.get(place.get("indoor_outdoor"), "")
    badge_html = (
        f'<div class="hub-card__badge hub-card__badge--place"><strong>{html(indoor)}</strong></div>'
        if indoor
        else ""
    )
    has_image = " has-image" if place.get("primary_image_url") else ""
    return (
        f'<a class="hub-card{has_image}" href="{html(href)}">'
        f"{hub_media(place.get('primary_image_url'), title)}"
        f"{badge_html}"
        f'<div class="hub-card__body">'
        f'<p class="card-kicker">{html(meta)}</p>'
        f"<strong>{html(title)}</strong>"
        f"<small>{html(compact_text(place.get('features') or place.get('target_age_note'), 70))}</small>"
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
        f'<span><b>イベント</b>{len(event_items)}件</span>'
        f'<span><b>遊び場</b>{len(place_items)}件</span>'
        f"<span><b>対象</b>{html(muni)}</span>"
        f"</div></div><div class=\"static-detail-body\">"
        + hub_section("開催予定のイベント", [hub_card_event(e) for e in event_items], "現在、掲載中の開催予定イベントはありません。")
        + hub_section("子どもの遊び場", [hub_card_place(p) for p in place_items], "現在、掲載中の遊び場はありません。")
        + f'<div class="dialog-actions static-detail-actions">'
        f'<a class="primary-button" href="{html(list_href)}">一覧で絞り込む</a>'
        f'<a class="secondary-button" href="../themes/">テーマから探す</a>'
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
        f'<span><b>イベント</b>{len(event_items)}件</span>'
        f'<span><b>遊び場</b>{len(place_items)}件</span>'
        f"</div></div><div class=\"static-detail-body\">"
        + hub_section("イベント", [hub_card_event(e) for e in event_items], "条件に合う開催予定イベントは現在ありません。")
        + hub_section("遊び場", [hub_card_place(p) for p in place_items], "条件に合う遊び場は現在ありません。")
        + f'<div class="dialog-actions static-detail-actions">'
        f'<a class="primary-button" href="{html(list_href)}">一覧で同じ条件を開く</a>'
        f'<a class="secondary-button" href="../areas/">地域から探す</a>'
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


def render_sitemap(events, places, area_hubs, theme_hubs):
    urls = [(f"{BASE_URL}/", "1.0", "daily")]
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
    clean_dir("events")
    clean_dir("places")
    clean_dir("areas")
    clean_dir("themes")
    for event in events:
        write(ROOT / "events" / f"{event['id']}.html", render_event(event))
    for place in places:
        write(ROOT / "places" / f"{place['id']}.html", render_place(place))
    for hub in AREA_HUBS:
        write(ROOT / "areas" / f"{hub['slug']}.html", render_area_hub(hub, events, places))
    for hub in THEME_HUBS:
        write(ROOT / "themes" / f"{hub['slug']}.html", render_theme_hub(hub, events, places))
    write(
        ROOT / "areas" / "index.html",
        render_hub_index("areas", AREA_HUBS, "高崎・前橋・太田・桐生・伊勢崎など、主要都市のイベントと遊び場をまとめています。"),
    )
    write(
        ROOT / "themes" / "index.html",
        render_hub_index("themes", THEME_HUBS, "雨の日屋内、無料、乳幼児向けなど、予定が決まりやすいテーマから探せます。"),
    )
    write(ROOT / "sitemap.xml", render_sitemap(events, places, AREA_HUBS, THEME_HUBS))
    print(
        f"generated {len(events)} events, {len(places)} places, "
        f"{len(AREA_HUBS)} area hubs, {len(THEME_HUBS)} theme hubs"
    )


if __name__ == "__main__":
    main()
