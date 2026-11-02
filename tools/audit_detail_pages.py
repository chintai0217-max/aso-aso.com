#!/usr/bin/env python3
"""Inventory detail pages for manual editorial and image review.

Run `python3 tools/audit_detail_pages.py --csv > /tmp/detail-review.csv`.
The inventory describes stored data, not independent fact or rights verification.
"""
import argparse
import csv
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from generate_static_pages import collect_gallery_images

ROOT = Path(__file__).resolve().parents[1]


def inventory(data, reviews):
    today = date.today().isoformat()
    for kind, key in (("event", "events"), ("place", "child_play_places")):
        for record in data.get(key, []):
            name = record.get("title") if kind == "event" else record.get("name")
            images = collect_gallery_images(record, name)
            review = reviews.get(f"{kind}:{record['id']}", {})
            end = record.get("end_date") or ""
            start = record.get("start_date") or ""
            if kind == "place":
                period = "施設"
            elif end and end < today:
                period = "開催終了"
            elif start and start > today:
                period = "開催前"
            else:
                period = "開催中・期間要確認"
            yield {
                "種別": "イベント" if kind == "event" else "遊び場",
                "ID": record["id"],
                "名称": name,
                "ページ": f"https://aso-aso.com/{'events' if kind == 'event' else 'places'}/{record['id']}.html",
                "開催状況の目安": period,
                "個別編集": "あり" if record.get("experience_cards") else "未着手",
                "内容確認": review.get("content_status", "未記録"),
                "表示画像数": len(images),
                "写真・権利": review.get("image_status", "要個別確認" if images else "画像なし・調査要"),
                "確認記録日": review.get("reviewed_at", ""),
                "情報確認日": record.get("last_verified_at") or "未記録",
                "公式情報": record.get("canonical_url") if kind == "event" else record.get("official_url"),
            }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", action="store_true", help="write page-by-page inventory to stdout")
    args = parser.parse_args()
    reviews_path = ROOT / 'data/detail-review.json'
    reviews = json.loads(reviews_path.read_text(encoding='utf-8')) if reviews_path.exists() else {}
    rows = list(inventory(json.loads((ROOT / 'data/events.json').read_text(encoding='utf-8')), reviews))
    if args.csv:
        writer = csv.DictWriter(sys.stdout, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    else:
        for kind in ("イベント", "遊び場"):
            subset = [row for row in rows if row["種別"] == kind]
            print(f'{kind}: {len(subset)}件 / 個別編集あり {sum(r["個別編集"] == "あり" for r in subset)}件 / 表示画像なし {sum(not r["表示画像数"] for r in subset)}件')
            print('  開催状況の目安:', dict(Counter(r['開催状況の目安'] for r in subset)))


if __name__ == '__main__':
    main()
