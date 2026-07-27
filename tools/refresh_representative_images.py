#!/usr/bin/env python3
"""Scrape official pages for more attractive representative photos.

Updates data/events.json (and mirrors to data/events.js) by:
- fetching canonical_url / official_url
- extracting og:image / twitter:image / large content images
- preferring photographic assets over livecams, posters, calendars, chrome
"""

from __future__ import annotations

import html as html_lib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_JSON = ROOT / "data" / "events.json"
DATA_JS = ROOT / "data" / "events.js"

sys.path.insert(0, str(ROOT / "tools"))
from generate_static_pages import (  # noqa: E402
    image_pixel_hint,
    is_junk_image_url,
    upgrade_image_url,
)

UA = (
    "Mozilla/5.0 (compatible; AsoAsoBot/1.0; +https://aso-aso.com/; "
    "image-refresh for regional event directory)"
)

WEAK_PRIMARY_RE = re.compile(
    r"(?:livecamera|webcam|page-\d+|flyer|チラシ|A4|両面|運営日|calendar|"
    r"opengraph-image|og[_-]?img|og-image|no_thumb|t\d+-\d+\.jpg|"
    r"ふるさと祭り2025_A4|schedule|timetable|運行|タイムテーブル|掲示用|"
    r"ポスチラ|main_visual_ttl|rsrc\.php|skids-price|/banner/)",
    re.I,
)

IMG_SRC_RE = re.compile(
    r"""(?:og:image|twitter:image)["'\s]+(?:content|href)=["']([^"']+)["']"""
    r"""|property=["']og:image["'][^>]*content=["']([^"']+)["']"""
    r"""|name=["']twitter:image["'][^>]*content=["']([^"']+)["']"""
    r"""|<img\b[^>]+src=["']([^"']+)["']""",
    re.I,
)


def is_weak_photo_url(url: str) -> bool:
    if not url or is_junk_image_url(url):
        return True
    if WEAK_PRIMARY_RE.search(url):
        return True
    base = urlparse(url).path.rsplit("/", 1)[-1].lower()
    if base.endswith((".gif", ".svg")):
        return True
    if re.search(r"(?:facebook|instagram|line|twitter|sns)", base):
        return True
    return False


def photo_score(url: str) -> int:
    if is_weak_photo_url(url):
        return -50_000
    score = image_pixel_hint(url)
    if re.search(r"\.(?:jpe?g|webp)(?:\?|$)", url, re.I):
        score += 80
    if re.search(r"(?:photo|photos|image|images|img|upload|media|gallery)", url, re.I):
        score += 40
    if re.search(r"(?:keep/\d{3,4}|/\d{3,4}x\d{3,4}/|w=\d{3,}|width=\d{3,})", url, re.I):
        score += 30
    if re.search(r"(?:poster|flyer|leaflet|チラシ|page-\d+|pdf)", url, re.I):
        score -= 200
    return score


def fetch(url: str, timeout: float = 18.0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
        charset = res.headers.get_content_charset() or "utf-8"
    try:
        return raw.decode(charset, "replace")
    except Exception:
        return raw.decode("utf-8", "replace")


def extract_image_urls(page_url: str, html: str) -> list[str]:
    found = []
    seen = set()
    for match in IMG_SRC_RE.finditer(html):
        raw = next((g for g in match.groups() if g), "")
        if not raw:
            continue
        raw = html_lib.unescape(raw.strip())
        if raw.startswith("data:"):
            continue
        abs_url = urljoin(page_url, raw)
        abs_url = upgrade_image_url(abs_url) or abs_url
        if abs_url in seen or is_weak_photo_url(abs_url):
            continue
        # Skip tiny UI paths
        if re.search(r"(?:/icon|/icons|/sprite|/emoji|/static\.cdninstagram)", abs_url, re.I):
            continue
        seen.add(abs_url)
        found.append(abs_url)
    found.sort(key=photo_score, reverse=True)
    return found


def existing_urls(record: dict) -> list[str]:
    urls = []
    if record.get("primary_image_url"):
        urls.append(record["primary_image_url"])
    for image in record.get("images") or []:
        if isinstance(image, dict) and image.get("image_url"):
            urls.append(image["image_url"])
        elif isinstance(image, str):
            urls.append(image)
    return urls


def best_existing(record: dict) -> str:
    scored = [(photo_score(u), u) for u in existing_urls(record)]
    scored = [x for x in scored if x[0] > 0]
    if not scored:
        return ""
    scored.sort(reverse=True)
    return scored[0][1]


def make_image_entry(url: str, page_url: str, title: str, entity_type: str, entity_id: int) -> dict:
    return {
        "id": None,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "image_url": url,
        "source_page_url": page_url,
        "title": title,
        "alt_text": title,
        "image_kind": "representative",
        "width": None,
        "height": None,
        "credit": None,
        "license_note": "公式・準公式ページ上の画像URL。再配布可否は未確認のため、公開利用時は出典リンク併記または利用条件確認が必要。",
        "status": "verified",
        "confidence": "medium",
        "discovered_at": time.strftime("%Y-%m-%d"),
        "last_verified_at": time.strftime("%Y-%m-%d"),
        "notes": "refresh_representative_images",
    }


def next_image_id(data: dict) -> int:
    max_id = 0
    for bucket in (data.get("image_assets") or [],):
        for item in bucket:
            try:
                max_id = max(max_id, int(item.get("id") or 0))
            except Exception:
                pass
    for coll in (data.get("events") or [], data.get("child_play_places") or []):
        for rec in coll:
            for item in rec.get("images") or []:
                if isinstance(item, dict):
                    try:
                        max_id = max(max_id, int(item.get("id") or 0))
                    except Exception:
                        pass
    return max_id + 1


def apply_best(record: dict, entity_type: str, candidates: list[str], page_url: str, next_id: int) -> tuple[bool, int]:
    title = record.get("title") or record.get("name") or ""
    current = record.get("primary_image_url") or ""
    current_score = photo_score(current) if current else -100_000
    existing_best = best_existing(record)
    existing_score = photo_score(existing_best) if existing_best else -100_000

    best = ""
    best_score = -100_000
    for url in candidates + ([existing_best] if existing_best else []):
        score = photo_score(url)
        if score > best_score:
            best_score = score
            best = url

    if not best or best_score < 200:
        # still upgrade to best existing if current is weak
        if existing_best and (is_weak_photo_url(current) or current_score + 80 < existing_score):
            best = existing_best
            best_score = existing_score
        else:
            return False, next_id

    if best == current and not is_weak_photo_url(current):
        return False, next_id
    if best_score <= current_score and not is_weak_photo_url(current):
        return False, next_id

    record["primary_image_url"] = best
    images = list(record.get("images") or [])
    urls = {im.get("image_url") if isinstance(im, dict) else im for im in images}
    if best not in urls:
        entry = make_image_entry(best, page_url, title, entity_type, record["id"])
        entry["id"] = next_id
        next_id += 1
        images.insert(0, entry)
    else:
        # move best to front
        rest = []
        lead = None
        for im in images:
            url = im.get("image_url") if isinstance(im, dict) else im
            if url == best and lead is None:
                lead = im
            else:
                rest.append(im)
        if lead is not None:
            images = [lead] + rest
    record["images"] = images[:12]
    return True, next_id


def page_url_for(record: dict, kind: str) -> str:
    if kind == "event":
        return record.get("canonical_url") or ""
    return record.get("official_url") or record.get("canonical_url") or ""


def refresh_collection(data: dict, key: str, entity_type: str, limit: int | None = None) -> list[str]:
    records = data.get(key) or []
    next_id = next_image_id(data)
    changed = []
    for index, record in enumerate(records):
        if limit is not None and index >= limit:
            break
        page = page_url_for(record, "event" if key == "events" else "place")
        title = record.get("title") or record.get("name") or f"#{record.get('id')}"
        current = record.get("primary_image_url") or ""
        needs = (not current) or is_weak_photo_url(current) or photo_score(current) < 500
        # Always try to improve weak ones; also lightly improve mediocre
        if not needs and photo_score(current) >= 700:
            # still check if existing gallery has a much better photo
            existing_best = best_existing(record)
            if not existing_best or photo_score(existing_best) <= photo_score(current) + 40:
                continue

        candidates: list[str] = []
        if page and not page.startswith("https://www.instagram.com/"):
            try:
                html = fetch(page)
                candidates = extract_image_urls(page, html)[:12]
                time.sleep(0.35)
            except (urllib.error.URLError, TimeoutError, ValueError) as err:
                print(f"  ! fetch fail {title}: {err}")

        # Also pull non-junk assets already catalogued
        for asset in data.get("image_assets") or []:
            if asset.get("entity_type") != entity_type or asset.get("entity_id") != record.get("id"):
                continue
            url = asset.get("image_url")
            if url and not is_weak_photo_url(url):
                candidates.append(url)

        updated, next_id = apply_best(record, entity_type, candidates, page or "", next_id)
        if updated:
            msg = f"{entity_type}#{record['id']} {title} -> {record['primary_image_url'][:90]}"
            print("  ✓", msg)
            changed.append(msg)
            # mirror into image_assets
            url = record["primary_image_url"]
            assets = data.setdefault("image_assets", [])
            if not any(a.get("image_url") == url and a.get("entity_id") == record["id"] for a in assets):
                entry = make_image_entry(url, page or "", title, entity_type, record["id"])
                entry["id"] = next_id
                next_id += 1
                assets.append(entry)
    return changed


def write_js_mirror(data: dict) -> None:
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"window.EVENT_DATA = {payload};\n", encoding="utf-8")


def main() -> int:
    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    print("Refreshing event representatives...")
    event_changes = refresh_collection(data, "events", "event")
    print("Refreshing place representatives...")
    place_changes = refresh_collection(data, "child_play_places", "child_play_place")
    DATA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_js_mirror(data)
    print(f"\nUpdated {len(event_changes)} events, {len(place_changes)} places")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
