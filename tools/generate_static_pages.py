#!/usr/bin/env python3
import json
import shutil
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import quote as url_quote


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://aso-aso.com"
TODAY = date.today().isoformat()

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
    start = event.get("start_date") or "日程未設定"
    end = event.get("end_date")
    if end and end != start:
        return f"{start} - {end}"
    return start


def time_text(event):
    values = [event.get("start_time"), event.get("end_time")]
    return " - ".join([value for value in values if value]) or "時間未設定"


def image_tag(url, alt):
    if not url:
        return ""
    return (
        '<div class="static-detail-image">'
        f'<img src="{html(url)}" alt="{html(alt)}" loading="eager" decoding="async" referrerpolicy="no-referrer">'
        "</div>"
    )


def layout(title, description, canonical, image, kind_label, h1, kicker, body, structured_data):
    og_image = image or f"{BASE_URL}/screenshot-desktop.png"
    return f"""<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{html(title)}</title>
    <meta name="description" content="{html(description)}">
    <meta name="robots" content="index,follow">
    <link rel="canonical" href="{html(canonical)}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="群馬イベントナビ">
    <meta property="og:title" content="{html(title)}">
    <meta property="og:description" content="{html(description)}">
    <meta property="og:url" content="{html(canonical)}">
    <meta property="og:image" content="{html(og_image)}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <script type="application/ld+json">{json_ld(structured_data)}</script>
  </head>
  <body class="static-detail-page">
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
          <a href="../">一覧へ戻る</a>
          <a href="../sitemap.xml">サイトマップ</a>
        </div>
      </div>
    </nav>
    <main class="static-detail-shell">
      <article class="static-detail">
        <p class="eyebrow">{html(kind_label)}</p>
        <h1>{html(h1)}</h1>
        <p class="lead">{html(kicker)}</p>
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


def action_links(primary_url, primary_label, home_query):
    query = url_quote(str(home_query or ""))
    links = [f'<a class="secondary-button" href="../?q={html(query)}">一覧で探す</a>']
    if primary_url:
        links.append(
            f'<a class="primary-button" href="{html(primary_url)}" target="_blank" rel="noreferrer">{html(primary_label)}</a>'
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
    quick = [
        ("日付", date_text(event)),
        ("時間", time_text(event)),
        ("会場", event.get("venue_name")),
        ("住所", event.get("address")),
        ("地域", " / ".join([x for x in [event.get("prefecture"), event.get("municipality")] if x])),
        ("カテゴリ", category),
        ("料金", event.get("price_note")),
        ("主催", event.get("organizer")),
        ("情報元", event.get("source_names")),
        ("最終確認", event.get("last_verified_at")),
    ]
    body = (
        image_tag(event.get("primary_image_url"), event.get("title"))
        + f'<section class="static-detail-section"><h2>概要</h2><p>{html(event.get("summary") or "詳細は公式ページで確認してください。")}</p></section>'
        + details(quick)
        + action_links(event.get("canonical_url"), "公式ページを見る", event.get("title"))
    )
    return layout(
        title,
        description,
        canonical,
        event.get("primary_image_url"),
        "群馬のイベント",
        event.get("title"),
        f"{event.get('municipality') or '群馬県'} / {category} / {date_text(event)}",
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
    quick = [
        ("地域", " / ".join([x for x in [place.get("prefecture"), place.get("municipality")] if x])),
        ("住所", place.get("address")),
        ("種類", place_type),
        ("屋内/屋外", indoor),
        ("対象", place.get("target_age_note")),
        ("特徴", place.get("features")),
        ("料金", place.get("price_note")),
        ("利用時間", place.get("hours_note")),
        ("休み", place.get("closed_note")),
        ("駐車場", place.get("parking_note")),
        ("授乳等", place.get("nursing_note")),
        ("情報元", place.get("source_names")),
        ("最終確認", place.get("last_verified_at")),
    ]
    body = (
        image_tag(place.get("primary_image_url"), place.get("name"))
        + f'<section class="static-detail-section"><h2>概要</h2><p>{html(place.get("features") or place.get("target_age_note") or "詳細は公式ページで確認してください。")}</p></section>'
        + details(quick)
        + action_links(place.get("official_url"), "公式ページを見る", place.get("name"))
    )
    return layout(
        title,
        description,
        canonical,
        place.get("primary_image_url"),
        "群馬の子どもの遊び場",
        place.get("name"),
        f"{place.get('municipality') or '群馬県'} / {place_type} / {indoor}",
        body,
        place_structured_data(place, canonical),
    )


def render_sitemap(events, places):
    urls = [(f"{BASE_URL}/", "1.0", "daily")]
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
    for event in events:
        write(ROOT / "events" / f"{event['id']}.html", render_event(event))
    for place in places:
        write(ROOT / "places" / f"{place['id']}.html", render_place(place))
    write(ROOT / "sitemap.xml", render_sitemap(events, places))
    print(f"generated {len(events)} event pages and {len(places)} place pages")


if __name__ == "__main__":
    main()
