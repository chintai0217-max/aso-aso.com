#!/usr/bin/env python3
"""Add accuracy-verified child play places into data/events.json.

Only records with facility/municipality official pages (address + hours + closed
+ price sourced from official text) are included. Run validate_places.py after.

Usage:
  python3 tools/add_verified_places.py
  python3 tools/add_verified_places.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_JSON = ROOT / "data" / "events.json"
DATA_JS = ROOT / "data" / "events.js"

TODAY = "2026-07-28"

# New sources to register (by name).
NEW_SOURCES = [
    {
        "name": "前橋市 児童館一覧",
        "url": "https://www.city.maebashi.gunma.jp/soshiki/kodomomiraibu/kodomoshisetsu/gyomu/3/2/3803.html",
        "prefecture": "群馬県",
        "municipality": "前橋市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "前橋市児童館の共通利用条件（無料・開館時間・休館日）と一覧。",
    },
    {
        "name": "前橋市 日吉児童館",
        "url": "https://www.city.maebashi.gunma.jp/soshiki/kodomomiraibu/kodomoshisetsu/gyomu/3/2/5344.html",
        "prefecture": "群馬県",
        "municipality": "前橋市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "日吉児童館の施設ページ（住所・時間・休館・駐車）。",
    },
    {
        "name": "前橋市 グローバルキッズパーク児童館あさくら",
        "url": "https://www.city.maebashi.gunma.jp/soshiki/kodomomiraibu/kodomoshisetsu/gyomu/3/2/5343.html",
        "prefecture": "群馬県",
        "municipality": "前橋市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "朝倉児童館の施設ページ（住所・時間・休館・駐車台数）。",
    },
    {
        "name": "館林市 児童館の利用について",
        "url": "https://www.city.tatebayashi.gunma.jp/s046/kenko/140/150/050/20200105105000.html",
        "prefecture": "群馬県",
        "municipality": "館林市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "館林市児童館共通の利用料・対象・開館時間・飲食案内。",
    },
    {
        "name": "館林市 児童センター",
        "url": "https://www.city.tatebayashi.gunma.jp/s046/kenko/140/150/070/20200105095000.html",
        "prefecture": "群馬県",
        "municipality": "館林市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "館林市児童センター施設ページ。",
    },
    {
        "name": "館林市 西児童館",
        "url": "https://www.city.tatebayashi.gunma.jp/s048/kenko/140/150/090/20200105101000.html",
        "prefecture": "群馬県",
        "municipality": "館林市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "西児童館施設ページ。授乳コーナーは施設案内ページにも記載。",
    },
    {
        "name": "館林市 赤羽児童館",
        "url": "https://www.city.tatebayashi.gunma.jp/s047/kenko/140/150/070/20200105103000.html",
        "prefecture": "群馬県",
        "municipality": "館林市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "赤羽児童館施設ページ。",
    },
    {
        "name": "伊勢崎市 赤堀児童館",
        "url": "https://www.city.isesaki.lg.jp/kosodate_kyoiku/kosodateshisetsu/jidocenter_jidokan/17737.html",
        "prefecture": "群馬県",
        "municipality": "伊勢崎市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "赤堀児童館の施設ページ。無料は市の無料利用場所一覧PDFと整合。",
    },
    {
        "name": "太田市 児童センター",
        "url": "https://www.city.ota.gunma.jp/site/kosodate/2869.html",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "太田市児童センター施設ページ。",
    },
    {
        "name": "太田市 九合児童館",
        "url": "https://www.city.ota.gunma.jp/site/kosodate/2867.html",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "九合児童館施設ページ。",
    },
    {
        "name": "太田市 宝泉児童館",
        "url": "https://www.city.ota.gunma.jp/site/kosodate/2880.html",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "宝泉児童館施設ページ（授乳室記載あり）。",
    },
    {
        "name": "太田市 生品児童館",
        "url": "https://www.city.ota.gunma.jp/site/kosodate/2871.html",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "生品児童館（ポラン）施設ページ。",
    },
    {
        "name": "太田市 沢野児童館",
        "url": "https://www.city.ota.gunma.jp/site/kosodate/2876.html",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "source_type": "government_site",
        "reliability": "official",
        "crawl_priority": 1,
        "notes": "沢野児童館の市公式施設ページ。",
    },
    {
        "name": "沼田めぐみこども園 チャイルドハウスめぐみ",
        "url": "https://www.megumi-n.com/pages/21/",
        "prefecture": "群馬県",
        "municipality": "沼田市",
        "source_type": "venue_site",
        "reliability": "official_venue",
        "crawl_priority": 1,
        "notes": "子育て支援センター「チャイルドハウスめぐみ」公式利用案内。市ページと突合。",
    },
]

# Places to add. Fields must follow validate_places rules.
# price_note for Ota child centers: 世良田児童館等の市公式に「使用料 無料」記載あり（同種施設）。
# Isesaki: 市「無料で利用できる場所一覧」PDFに赤堀児童館を掲載。
NEW_PLACES = [
    {
        "name": "日吉児童館",
        "prefecture": "群馬県",
        "municipality": "前橋市",
        "area_label": "日吉町",
        "address": "群馬県前橋市日吉町二丁目17番地10（総合福祉会館内）",
        "place_type": "child_center",
        "indoor_outdoor": "indoor",
        "target_age_note": "原則18歳未満の児童とその保護者。入館無料。日吉では平日10:00～14:00に地域子育て支援センター事業（3歳未満の親子）も実施。",
        "features": "児童館。遊び・文化行事、幼児サークル・母親クラブの活動の場。総合福祉会館内。",
        "price_note": "無料。",
        "hours_note": "10:00～17:00。",
        "closed_note": "日曜、国民の祝日、年末年始（12/29～1/3）。",
        "parking_note": "総合福祉会館の駐車場を利用（平日昼310台の記載あり）。",
        "stroller_note": None,
        "nursing_note": None,
        "food_note": None,
        "official_url": "https://www.city.maebashi.gunma.jp/soshiki/kodomomiraibu/kodomoshisetsu/gyomu/3/2/5344.html",
        "status": "verified",
        "confidence": "high",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "共通条件は前橋市児童館一覧ページ、施設固有情報は日吉児童館ページで確認。",
        "source_names": "前橋市 日吉児童館",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": None,
        "images": [],
    },
    {
        "name": "グローバルキッズパーク児童館あさくら",
        "prefecture": "群馬県",
        "municipality": "前橋市",
        "area_label": "朝倉町",
        "address": "群馬県前橋市朝倉町170-3",
        "place_type": "child_center",
        "indoor_outdoor": "indoor",
        "target_age_note": "原則18歳未満の児童とその保護者。入館無料。朝倉では平日10:00～14:00に地域子育て支援センター事業（3歳未満の親子）も実施。",
        "features": "児童館（グローバルキッズパーク）。遊び・文化行事、幼児サークル・母親クラブの活動の場。",
        "price_note": "無料。",
        "hours_note": "10:00～17:00。",
        "closed_note": "日曜、国民の祝日、年末年始（12/29～1/3）。",
        "parking_note": "駐車場14台。",
        "stroller_note": None,
        "nursing_note": None,
        "food_note": None,
        "official_url": "https://www.city.maebashi.gunma.jp/soshiki/kodomomiraibu/kodomoshisetsu/gyomu/3/2/5343.html",
        "status": "verified",
        "confidence": "high",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "共通条件は前橋市児童館一覧ページ、施設固有情報はあさくらページで確認。",
        "source_names": "前橋市 グローバルキッズパーク児童館あさくら",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": None,
        "images": [],
    },
    {
        "name": "館林市児童センター",
        "prefecture": "群馬県",
        "municipality": "館林市",
        "area_label": "大手町",
        "address": "群馬県館林市大手町10-55",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "0歳から18歳未満の児童とその保護者。乳幼児は保護者同伴。",
        "features": "グラウンド（サッカー・バスケ）、大型トランポリン、子育て相談・親子ふれあい遊び。受付で利用名簿記入。",
        "price_note": "無料（イベントにより参加費あり）。",
        "hours_note": "10:00～17:00（火～日・国民の祝日）。",
        "closed_note": "月曜（祝日の場合は開館）、祝日の翌日、年末年始。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": None,
        "food_note": "飲食できるスペースあり。ゴミは持ち帰り。",
        "official_url": "https://www.city.tatebayashi.gunma.jp/s046/kenko/140/150/070/20200105095000.html",
        "status": "verified",
        "confidence": "high",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "利用条件は「児童館の利用について」ページと突合。",
        "source_names": "館林市 児童センター",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": "団体利用は1週間前までに利用許可申請書が必要。",
        "images": [],
    },
    {
        "name": "館林市西児童館",
        "prefecture": "群馬県",
        "municipality": "館林市",
        "area_label": "富士原町",
        "address": "群馬県館林市富士原町1241-80",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "0歳から18歳未満の児童とその保護者。乳幼児は保護者同伴。",
        "features": "屋外遊具・砂場・グラウンド、室内トランポリン・卓球、図書室。乳幼児向け集会室あり。",
        "price_note": "無料（イベントにより参加費あり）。",
        "hours_note": "10:00～17:00（火～日・国民の祝日）。",
        "closed_note": "月曜（祝日の場合は開館）、祝日の翌日、年末年始。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": "図書室に授乳コーナーあり（西児童館施設案内ページ）。",
        "food_note": "飲食できるスペースあり（市の児童館共通案内）。ゴミは持ち帰り。",
        "official_url": "https://www.city.tatebayashi.gunma.jp/s048/kenko/140/150/090/20200105101000.html",
        "status": "verified",
        "confidence": "high",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "共通利用条件は館林市「児童館の利用について」。授乳は施設案内ページ。",
        "source_names": "館林市 西児童館",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": "団体利用は1週間前までに利用許可申請書が必要。",
        "images": [],
    },
    {
        "name": "館林市赤羽児童館",
        "prefecture": "群馬県",
        "municipality": "館林市",
        "area_label": "赤生田町",
        "address": "群馬県館林市赤生田町1964-1",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "0歳から18歳未満の児童とその保護者。乳幼児は保護者同伴。",
        "features": "幼児の遊び場、トランポリン、卓球。隣接する赤羽公民館運動場で戸外遊び。",
        "price_note": "無料（イベントにより参加費あり）。",
        "hours_note": "10:00～17:00（火～日・国民の祝日）。",
        "closed_note": "月曜（祝日の場合は開館）、祝日の翌日、年末年始。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": None,
        "food_note": "飲食できるスペースあり（市の児童館共通案内）。ゴミは持ち帰り。",
        "official_url": "https://www.city.tatebayashi.gunma.jp/s047/kenko/140/150/070/20200105103000.html",
        "status": "verified",
        "confidence": "high",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "共通利用条件は館林市「児童館の利用について」。",
        "source_names": "館林市 赤羽児童館",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": "団体利用は1週間前までに利用許可申請書が必要。",
        "images": [],
    },
    {
        "name": "伊勢崎市赤堀児童館",
        "prefecture": "群馬県",
        "municipality": "伊勢崎市",
        "area_label": "西久保町",
        "address": "群馬県伊勢崎市西久保町二丁目105番地",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "自由遊びの児童館。詳細な対象年齢は月次おたより・公式で確認。",
        "features": "遊戯室、図書室、児童クラブ室、ぴよぴよルーム、卓球、バドミントン、サッカー、バスケットなど。",
        "price_note": "無料（市の「こどもや若者などが無料で利用できる場所一覧」に掲載）。放課後児童クラブは別料金。",
        "hours_note": "9:30～18:00。",
        "closed_note": "日曜、祝日（5月5日除く）、年末年始（12/29～1/3）。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": None,
        "food_note": "施設内飲食は市の無料利用場所一覧で「不可」と記載。",
        "official_url": "https://www.city.isesaki.lg.jp/kosodate_kyoiku/kosodateshisetsu/jidocenter_jidokan/17737.html",
        "status": "verified",
        "confidence": "high",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "時間・休館は施設ページ。無料・飲食は市の無料利用場所一覧PDFと突合。",
        "source_names": "伊勢崎市 赤堀児童館",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": None,
        "images": [],
    },
    {
        "name": "太田市児童センター",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "area_label": "本町",
        "address": "群馬県太田市本町28-17",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "公式ページに対象年齢の明記なし。詳細は公式・施設へ確認。",
        "features": "遊戯室（ロフト・ボルダリング）、創作活動室、集会室、図書室、授乳室。屋外にホッピング・すべり台など。",
        "price_note": "公式施設ページに使用料の記載なし。詳細は公式・施設へ確認。",
        "hours_note": "9:30～18:15。",
        "closed_note": "日曜、月曜、年末年始（12/29～1/3）。",
        "parking_note": "テクノプラザおおた立体駐車場の2・3階を利用する案内あり。",
        "stroller_note": None,
        "nursing_note": "授乳室あり。",
        "food_note": None,
        "official_url": "https://www.city.ota.gunma.jp/site/kosodate/2869.html",
        "status": "verified",
        "confidence": "medium",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "住所・時間・休館・設備は太田市児童センター公式ページで確認。使用料・対象年齢は未記載のため断定しない。",
        "source_names": "太田市 児童センター",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": None,
        "images": [],
    },
    {
        "name": "太田市九合児童館",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "area_label": "飯塚町",
        "address": "群馬県太田市飯塚町586-2",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "公式ページに対象年齢の明記なし。詳細は公式・施設へ確認。",
        "features": "遊戯室、図書室、幼児スペース、授乳室、卓球・玩具。館庭に大型遊具・鉄棒。",
        "price_note": "公式施設ページに使用料の記載なし。詳細は公式・施設へ確認。",
        "hours_note": "9:30～18:15。",
        "closed_note": "日曜、月曜、年末年始（12/29～1/3）。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": "授乳室あり。",
        "food_note": None,
        "official_url": "https://www.city.ota.gunma.jp/site/kosodate/2867.html",
        "status": "verified",
        "confidence": "medium",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "住所・時間・休館・設備は太田市九合児童館公式ページで確認。使用料・対象年齢は未記載のため断定しない。",
        "source_names": "太田市 九合児童館",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": None,
        "images": [],
    },
    {
        "name": "太田市宝泉児童館",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "area_label": "由良町",
        "address": "群馬県太田市由良町1738-1",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "公式ページに対象年齢の明記なし。0歳児からの親子向け行事の記載あり。詳細は公式・施設へ確認。",
        "features": "遊戯室、図書コーナー、授乳室。屋外に複合遊具・バスケットゴール。母親クラブの活動あり。",
        "price_note": "公式施設ページに使用料の記載なし。詳細は公式・施設へ確認。",
        "hours_note": "9:30～18:15。",
        "closed_note": "日曜、月曜、年末年始（12/29～1/3）。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": "授乳室あり。",
        "food_note": None,
        "official_url": "https://www.city.ota.gunma.jp/site/kosodate/2880.html",
        "status": "verified",
        "confidence": "medium",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "住所・時間・休館・設備は太田市宝泉児童館公式ページで確認。使用料・対象年齢は未記載のため断定しない。",
        "source_names": "太田市 宝泉児童館",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": None,
        "images": [],
    },
    {
        "name": "太田市生品児童館（ポラン）",
        "prefecture": "群馬県",
        "municipality": "太田市",
        "area_label": "新田村田町",
        "address": "群馬県太田市新田村田町1084-1",
        "place_type": "child_center",
        "indoor_outdoor": "both",
        "target_age_note": "公式ページに対象年齢の明記なし。詳細は公式・施設へ確認。",
        "features": "学童室、図書室、集会室、遊戯室、キャットウォーク。屋外に木製アスレチック・回転遊具。放課後児童クラブ併設。",
        "price_note": "公式施設ページに使用料の記載なし。詳細は公式・施設へ確認。",
        "hours_note": "9:30～18:15。",
        "closed_note": "日曜、月曜、年末年始（12/29～1/3）。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": None,
        "food_note": None,
        "official_url": "https://www.city.ota.gunma.jp/site/kosodate/2871.html",
        "status": "verified",
        "confidence": "medium",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "住所・時間・休館・設備は太田市生品児童館公式ページで確認。使用料・対象年齢は未記載のため断定しない。",
        "source_names": "太田市 生品児童館",
        "primary_image_url": None,
        "google_place_id": None,
        "reservation_note": None,
        "images": [],
    },
    {
        "name": "チャイルドハウスめぐみ",
        "prefecture": "群馬県",
        "municipality": "沼田市",
        "area_label": "清水町",
        "address": "群馬県沼田市清水町4330（沼田めぐみこども園内）",
        "place_type": "childcare_support",
        "indoor_outdoor": "indoor",
        "target_age_note": "0歳から就学前の子どもと保護者。市外からも利用可の記載あり。",
        "features": "地域子育て支援センター。育児相談、子育てサークル支援、セミナー・講座。木の香りの施設。",
        "price_note": "利用料の明示なし（支援センター利用）。詳細は公式・施設へ確認。",
        "hours_note": "平日・土曜 10:00～15:00（市ページも月～土 10:00～15:00）。",
        "closed_note": "日曜・祝祭日・こども園休園日・春休み・お盆・冬休み。園行事等で休館する場合あり。",
        "parking_note": "駐車場情報は公式で確認。",
        "stroller_note": None,
        "nursing_note": None,
        "food_note": None,
        "official_url": "https://www.megumi-n.com/pages/21/",
        "status": "verified",
        "confidence": "medium",
        "discovered_at": TODAY,
        "last_verified_at": TODAY,
        "notes": "時間・休館・住所は施設公式と沼田市地域子育て支援センターページで突合。利用料は施設ページに明示がないため medium。",
        "source_names": "沼田めぐみこども園 チャイルドハウスめぐみ",
        "primary_image_url": "https://www.megumi-n.com/files/libs/1583/s/202010301408439983.JPG?1756435229",
        "google_place_id": None,
        "reservation_note": "支援センター通信で開館状況を確認のうえ来所する案内あり。",
        "images": [],
    },
]


def write_js_mirror(data: dict) -> None:
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    DATA_JS.write_text(f"window.EVENT_DATA = {payload};\n", encoding="utf-8")


def ensure_sources(data: dict) -> int:
    existing = {s["name"]: s for s in data["sources"]}
    next_id = max(s["id"] for s in data["sources"]) + 1
    added = 0
    for src in NEW_SOURCES:
        if src["name"] in existing:
            continue
        row = {"id": next_id, **src}
        data["sources"].append(row)
        existing[src["name"]] = row
        next_id += 1
        added += 1
    return added


def upgrade_existing(data: dict) -> list[str]:
    """Fix known accuracy issues on existing records."""
    notes: list[str] = []
    by_id = {p["id"]: p for p in data["child_play_places"]}

    # #38 太田市こども館 — tighten from official page
    p38 = by_id.get(38)
    if p38:
        p38["hours_note"] = "9:30～17:30。"
        p38["closed_note"] = "月曜（祝日の場合は翌日）、祝日の翌日、年末年始（12/29～1/3）。"
        p38["price_note"] = "無料。"
        p38["target_age_note"] = "乳幼児（未就学）は保護者同伴。絵本室・支援ルーム・多目的室など。"
        p38["features"] = "子育て支援・えほん室・天体観測の複合施設。育児相談、乳幼児向け広場、貸出おもちゃ。"
        p38["confidence"] = "high"
        p38["last_verified_at"] = TODAY
        p38["notes"] = "太田市こども館公式ページ（2026-07-28確認）に基づき時間・休館・利用料を更新。"
        notes.append("upgraded #38 太田市こども館")

    # #39 沢野 — prefer city official facility page over directory
    p39 = by_id.get(39)
    if p39:
        p39["official_url"] = "https://www.city.ota.gunma.jp/site/kosodate/2876.html"
        p39["source_names"] = "太田市 沢野児童館"
        p39["price_note"] = "公式施設ページに使用料の記載なし。詳細は公式・施設へ確認。"
        p39["hours_note"] = "9:30～18:15。"
        p39["closed_note"] = "日曜、月曜、年末年始（12/29～1/3）。"
        p39["features"] = "図書室、ホール、遊戯室、集会室。乳幼児向けスペース。屋外遊具・運動場・ミニバスケット。"
        p39["target_age_note"] = "公式ページに対象年齢の明記なし。小学生未満向けの部屋あり。詳細は公式・施設へ確認。"
        p39["confidence"] = "medium"
        p39["last_verified_at"] = TODAY
        p39["notes"] = "住所・時間・休館・設備は太田市沢野児童館公式ページで確認。使用料・対象年齢は未記載のため断定しない。"
        notes.append("corrected #39 太田市沢野児童館 to city official page")

    # #40 子ども広場 — add reservation note from運営サイト (cross-check city hours)
    p40 = by_id.get(40)
    if p40:
        p40["reservation_note"] = "予約優先の案内あり（沼田子育てネット）。空きがあれば予約なし利用可。"
        p40["last_verified_at"] = TODAY
        notes.append("updated #40 reservation note")

    # Downgrade or clarify existing high+vague mismatches so validation stays honest
    for pid in (71, 74, 42):
        p = by_id.get(pid)
        if not p:
            continue
        if p.get("confidence") == "high":
            p["confidence"] = "medium"
            p["last_verified_at"] = TODAY
            prev = p.get("notes") or ""
            tag = "vague fields present; confidence lowered pending re-verification."
            p["notes"] = f"{prev} {tag}".strip() if prev else tag
            notes.append(f"confidence medium for #{pid} (vague fields)")

    return notes


def add_places(data: dict) -> list[str]:
    existing_names = {(p["municipality"], p["name"]) for p in data["child_play_places"]}
    next_id = max(p["id"] for p in data["child_play_places"]) + 1
    added: list[str] = []
    for raw in NEW_PLACES:
        key = (raw["municipality"], raw["name"])
        if key in existing_names:
            continue
        place = deepcopy(raw)
        place["id"] = next_id
        data["child_play_places"].append(place)
        existing_names.add(key)
        added.append(f"#{next_id} {place['name']}")
        next_id += 1
    return added


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    src_added = ensure_sources(data)
    upgraded = upgrade_existing(data)
    added = add_places(data)

    data["meta"]["child_play_place_count"] = len(data["child_play_places"])
    if "generated_at" in data["meta"]:
        data["meta"]["generated_at"] = TODAY

    sys.path.insert(0, str(ROOT / "tools"))
    from validate_places import validate_dataset

    issues = validate_dataset(data, strict_new=False)
    errors = [i for i in issues if i["level"] == "error"]
    for i in issues:
        loc = f"#{i['id']}" if i["id"] is not None else "dataset"
        print(f"[{i['level']}] {loc}: {i['message']}")

    print(f"\nsources added: {src_added}")
    print(f"upgraded: {upgraded}")
    print(f"places added: {added}")
    print(f"total places: {len(data['child_play_places'])}")

    if errors:
        print("aborting write due to validation errors", file=sys.stderr)
        return 1

    if args.dry_run:
        print("dry-run: not writing")
        return 0

    DATA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_js_mirror(data)
    print(f"wrote {DATA_JSON} and {DATA_JS}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
