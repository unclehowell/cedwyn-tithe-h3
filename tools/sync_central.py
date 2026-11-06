#!/usr/bin/env python3
"""Build this webapp's single logical database view from app-local map data and the central public catalogue.
Only the seven fields used by Tithe H3 are copied. The central catalogue remains authoritative for those fields;
map pins and geometry references remain app-owned. data/view.json is the generated app database contract.
Never edit data/view.json by hand. — Sion's Tab agent"""
import json, re, sys, time, datetime, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://cedwyn.bucklerfamily.estate/api/catalogue/"
PINS = ROOT / "data" / "pins.json"
OUT = ROOT / "data" / "view.json"
FIELDS = ("id", "kind", "title", "date_display", "date_sort", "status", "page")
ASSETS = {
    "parcels": "data/parcels.json",
    "estimated_parcels": "data/parcels-est.json",
    "registry_parcels": "data/registry-parcels.geojson"
}

pins_text = PINS.read_text(encoding="utf-8")
pins = json.loads(pins_text)
ids = sorted(set(re.findall(r"\b(?:EV|MR|AR)-\d{4}\b", pins_text)))
items, missing = {}, []
for record_id in ids:
    try:
        req = urllib.request.Request(
            f"{API}{record_id}?cb={int(time.time())}",
            headers={"User-Agent": "cedwyn-webapp-sync/1.0"}
        )
        item = (json.load(urllib.request.urlopen(req, timeout=30)) or {}).get("item") or {}
        if item.get("id") == record_id:
            items[record_id] = {field: item.get(field) for field in FIELDS}
        else:
            missing.append(record_id)
    except Exception:
        missing.append(record_id)
    time.sleep(0.2)

previous = {}
try:
    previous = json.loads(OUT.read_text(encoding="utf-8"))
except Exception:
    pass
previous_items = previous.get("catalogue", {}).get("items", {})
if len(items) < max(1, len(previous_items) // 2):
    sys.exit(f"only {len(items)} of {len(ids)} records readable; data/view.json left unchanged")

previous_map = previous.get("map", {}).get("pins")
if previous_items == items and previous.get("catalogue", {}).get("not_in_central") == missing and previous_map == pins:
    print("no change", len(items), "catalogue records and", len(pins.get("records", [])), "map records")
    sys.exit(0)

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
view = {
    "schema": "cedwyn.app-view/v1",
    "app": {"id": "tithe-h3", "repository": "unclehowell/cedwyn-tithe-h3"},
    "generated_utc": now,
    "catalogue": {
        "source": API.rstrip("/"),
        "fields": list(FIELDS),
        "synced_utc": now,
        "count": len(items),
        "not_in_central": missing,
        "items": items
    },
    "map": {
        "source": "data/pins.json",
        "pins": pins,
        "assets": ASSETS
    }
}
OUT.write_text(json.dumps(view, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("written data/view.json:", len(items), "public catalogue records;", len(missing), "not in central catalogue;", len(pins.get("records", [])), "map records")
