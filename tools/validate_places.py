#!/usr/bin/env python3
"""Validate child_play_places for accuracy-first publishing.

Usage:
  python3 tools/validate_places.py
  python3 tools/validate_places.py --strict-new   # fail on medium with vague notes
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_JSON = ROOT / "data" / "events.json"

PLACE_TYPES = {
    "amusement_park",
    "animal_cafe",
    "animal_indoor_play",
    "childcare_support",
    "child_center",
    "craft_workshop",
    "dinosaur_museum",
    "indoor_play",
    "indoor_sports",
    "museum",
    "museum_workshop",
    "nature_museum",
    "park",
    "park_indoor_play",
    "park_science",
    "playground",
    "pool",
    "railway_museum",
    "safari_park",
    "science_museum",
    "theme_park",
    "water_play_park",
}

REQUIRED = (
    "id",
    "name",
    "prefecture",
    "municipality",
    "area_label",
    "address",
    "place_type",
    "indoor_outdoor",
    "target_age_note",
    "features",
    "price_note",
    "hours_note",
    "closed_note",
    "parking_note",
    "official_url",
    "status",
    "confidence",
    "discovered_at",
    "last_verified_at",
    "source_names",
)

# Apply mainly to price/hours/closed — not feature prose (「遊具など」は正常)。
VAGUE_RE = re.compile(
    r"(各センター確認|詳細は(?:各|公式).{0,12}確認|要確認|未確認|無料想定|利用時間は各|"
    r"休館日は各|目安。|要公式確認)",
    re.I,
)
SPECULATION_RE = re.compile(r"(可能性|と思われる|おそらく|らしい)")
HTTP_RE = re.compile(r"^https?://", re.I)


def issue(level: str, place_id, msg: str) -> dict:
    return {"level": level, "id": place_id, "message": msg}


def validate_place(place: dict, source_names: set[str], *, for_publish: bool = False) -> list[dict]:
    issues: list[dict] = []
    pid = place.get("id")

    for key in REQUIRED:
        val = place.get(key)
        if val is None or (isinstance(val, str) and not val.strip()):
            issues.append(issue("error", pid, f"required field missing: {key}"))

    if place.get("prefecture") != "群馬県":
        issues.append(issue("error", pid, "prefecture must be 群馬県"))

    if place.get("place_type") not in PLACE_TYPES:
        issues.append(issue("error", pid, f"unknown place_type: {place.get('place_type')}"))

    if place.get("indoor_outdoor") not in {"indoor", "outdoor", "both"}:
        issues.append(issue("error", pid, f"invalid indoor_outdoor: {place.get('indoor_outdoor')}"))

    if place.get("status") not in {"verified", "candidate"}:
        issues.append(issue("error", pid, f"invalid status: {place.get('status')}"))

    if place.get("confidence") not in {"high", "medium", "low"}:
        issues.append(issue("error", pid, f"invalid confidence: {place.get('confidence')}"))

    url = place.get("official_url") or ""
    if url and not HTTP_RE.match(url):
        issues.append(issue("error", pid, "official_url must be http(s)"))

    src = place.get("source_names")
    if src and src not in source_names:
        issues.append(issue("error", pid, f"source_names not in sources[]: {src}"))

    # Accuracy heuristics
    for field in ("price_note", "hours_note", "closed_note", "features", "target_age_note"):
        text = place.get(field) or ""
        if SPECULATION_RE.search(text):
            issues.append(issue("error", pid, f"speculative wording in {field}"))
        if VAGUE_RE.search(text):
            if place.get("confidence") == "high":
                issues.append(issue("error", pid, f"vague wording in {field} but confidence=high"))
            else:
                issues.append(issue("warning", pid, f"vague wording in {field}"))

    if place.get("status") == "verified" and place.get("confidence") == "low":
        issues.append(issue("error", pid, "verified + low confidence is not allowed"))

    if for_publish and place.get("status") == "verified":
        if not place.get("last_verified_at"):
            issues.append(issue("error", pid, "verified place needs last_verified_at"))
        # Prefer municipal/facility domains over directories alone for high confidence
        if place.get("confidence") == "high" and re.search(
            r"kodomonokuni\.or\.jp/another/conference/jidoukan", url
        ):
            issues.append(
                issue(
                    "error",
                    pid,
                    "high confidence should use facility/municipality official_url, not directory listing",
                )
            )

    # Optional equipment fields: never invent — null is OK; empty string is not
    for field in ("stroller_note", "nursing_note", "food_note", "reservation_note", "notes"):
        if place.get(field) == "":
            issues.append(issue("error", pid, f"{field} should be null when unknown, not empty string"))

    return issues


def validate_dataset(data: dict, *, strict_new: bool = False) -> list[dict]:
    places = data.get("child_play_places") or []
    sources = data.get("sources") or []
    source_names = {s.get("name") for s in sources if s.get("name")}
    issues: list[dict] = []

    ids = [p.get("id") for p in places]
    if len(ids) != len(set(ids)):
        issues.append(issue("error", None, "duplicate place ids"))

    meta_count = (data.get("meta") or {}).get("child_play_place_count")
    if meta_count is not None and meta_count != len(places):
        issues.append(
            issue("error", None, f"meta.child_play_place_count={meta_count} != len(places)={len(places)}")
        )

    for place in places:
        issues.extend(validate_place(place, source_names, for_publish=True))
        if strict_new and place.get("confidence") == "medium":
            blob = " ".join(
                str(place.get(k) or "")
                for k in ("price_note", "hours_note", "closed_note")
            )
            if VAGUE_RE.search(blob):
                issues.append(
                    issue(
                        "error",
                        place.get("id"),
                        "strict-new: medium + vague notes should not be newly published",
                    )
                )
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict-new", action="store_true")
    args = parser.parse_args()
    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    issues = validate_dataset(data, strict_new=args.strict_new)
    errors = [i for i in issues if i["level"] == "error"]
    warnings = [i for i in issues if i["level"] == "warning"]
    for i in issues:
        loc = f"#{i['id']}" if i["id"] is not None else "dataset"
        print(f"[{i['level']}] {loc}: {i['message']}")
    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s), {len(data.get('child_play_places') or [])} places")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
