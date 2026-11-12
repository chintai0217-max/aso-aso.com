#!/usr/bin/env python3
"""Group detail-page review work by exact source URL and venue.

The output is an inventory and conservative triage aid, not verification or a
completion assessment. Run: python3 tools/detail_work_queue.py > /tmp/detail-work-queue.json
"""
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

from generate_static_pages import collect_gallery_images

ROOT = Path(__file__).resolve().parents[1]
UNCERTAIN = ('未確認', '未再確認', '要確認', '確認でき', '確認が必要', '不明', '確認要', '要調査', '調査要', '保留', '未確定', '確認してください')
ABSENT = ('未確保', '画像なし', '写真なし', '未入手', '確保できていない')


def unique_urls(record, review, kind):
    # Do not merge URLs by hostname or assume a URL is an official source.
    urls = [record.get('canonical_url' if kind == 'event' else 'official_url')]
    for field in ('source_url', 'secondary_source_url', 'additional_source_url',
                  'additional_source_urls', 'additional_sources'):
        value = review.get(field)
        urls.extend(value if isinstance(value, list) else [value])
    return list(dict.fromkeys(u.strip() for u in urls if isinstance(u, str) and u.strip()))


def matching_terms(value, terms):
    """Return search hints, not semantic conclusions about negated phrases."""
    if not value:
        return []
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return [term for term in terms if term in text]


def make_row(kind, record, review):
    name = record.get('title' if kind == 'event' else 'name') or ''
    images = collect_gallery_images(record, name)
    image_status = review.get('image_status') or ''
    content_status = review.get('content_status') or ''
    photo_missing = matching_terms(image_status, ABSENT)
    uncertainty_sources = {
        field: matching_terms(value, UNCERTAIN)
        for field, value in {
            'content_status': content_status,
            'review_notes': review.get('notes'),
            'image_status': image_status,
            'image_research_note': review.get('image_research_note'),
            'unverified_previous_values': review.get('unverified_previous_values'),
            'record_notes': record.get('notes'),
        }.items()
    }
    uncertainty_sources = {key: value for key, value in uncertainty_sources.items() if value}
    # Existing photos and positive words in free text never establish compliance.
    if photo_missing:
        photo_triage = '写真未確保等の文字列あり・文脈要確認'
    elif not images:
        photo_triage = '表示画像なし・写真要確認'
    else:
        photo_triage = '表示画像あり・対象写真と権利等を要確認'
    flags = []
    if not content_status or content_status == '未記録':
        flags.append('内容確認の記録なし')
    if uncertainty_sources:
        flags.append('未確認等の文字列あり・文脈要確認')
    elif content_status and content_status != '未記録':
        flags.append('内容の完全性は要個別確認')
    if not record.get('experience_cards'):
        flags.append('個別本文の編集記録なし')
    flags.append(photo_triage)
    return {
        'key': f"{kind}:{record['id']}", 'name': name,
        'municipality': record.get('municipality') or '',
        'venue': (record.get('venue_name') if kind == 'event' else record.get('name')) or '',
        'source_urls': unique_urls(record, review, kind),
        'content_status': content_status or '未記録',
        'image_status': image_status or '未記録',
        'review_notes': review.get('notes') or '',
        'image_research_note': review.get('image_research_note') or '',
        'record_notes': record.get('notes') or '',
        'unverified_previous_values': review.get('unverified_previous_values'),
        'uncertainty_term_hits': uncertainty_sources,
        'photo_absence_term_hits': photo_missing,
        'image_source_urls': {field: review[field] for field in
                              ('image_source_url', 'image_source_urls', 'photo_source_url',
                               'image_research_source_url', 'candidate_photo_sources')
                              if review.get(field)},
        'display_image_count': len(images),
        'photo_triage': photo_triage,
        'work_flags': flags,
        'reviewed_at': review.get('reviewed_at') or '',
    }


def build_report(data, reviews):
    rows = [make_row(kind, record, reviews.get(f"{kind}:{record['id']}", {}))
            for kind, key in (('event', 'events'), ('place', 'child_play_places'))
            for record in data.get(key, [])]
    sources, venues = defaultdict(list), defaultdict(list)
    for row in rows:
        for url in row['source_urls']:
            sources[url].append(row['key'])
        if not row['source_urls']:
            sources['（資料URL未記録）'].append(row['key'])
        # Exact municipality + exact venue only; missing venue is never merged.
        venue_key = f"{row['municipality']} | {row['venue']}" if row['venue'] else f"会場未記録 | {row['key']}"
        venues[venue_key].append(row['key'])
    def groups(mapping):
        return [{'group': key, 'count': len(keys), 'records': keys}
                for key, keys in sorted(mapping.items(), key=lambda x: (-len(x[1]), x[0]))]
    return {
        'notes': [
            '表示画像・個別本文・確認済みの文字列は、対象写真や権利・撮影時期・全項目の照合完了を証明しません。',
            '未確認や写真未確保の語の検出は自由記述の文字列検索であり、否定文・条件文を解釈しません。原文を確認してください。該当しない記録にも未確認事項があり得ます。',
            '資料URLは候補をそのまま集計し、公式性や正確性は判定しません。複数URLを持つレコードは複数グループに含まれます。',
            '会場は自治体と名称が完全一致するもののみ集計し、別名・移転・同名施設は個別に確認してください。',
        ],
        'counts': {'records': len(rows), 'kinds': dict(Counter(r['key'].split(':')[0] for r in rows)),
                   'photo_triage': dict(Counter(r['photo_triage'] for r in rows))},
        'source_groups': groups(sources), 'venue_groups': groups(venues), 'records': rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    data = json.loads((ROOT / 'data/events.json').read_text(encoding='utf-8'))
    reviews = json.loads((ROOT / 'data/detail-review.json').read_text(encoding='utf-8'))
    print(json.dumps(build_report(data, reviews), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
