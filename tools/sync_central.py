#!/usr/bin/env python3
"""Fill this webapp's own data store, data/central.json, with only the central-catalogue fields the map shows.
Read-only against the central catalogue (https://cedwyn.bucklerfamily.estate/api/catalogue/<id>). data/central.json is a
derived cache: never edit it by hand; the central catalogue stays the single source of truth. The file is rewritten only
when a record it holds changed, and a run that can read fewer than half of the records leaves it as it was.
Run by .github/workflows/sync-central.yml every 6 hours. — Sion's Tab agent"""
import json, re, sys, time, datetime, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parent.parent
API = 'https://cedwyn.bucklerfamily.estate/api/catalogue/'
FIELDS = ('id', 'kind', 'title', 'date_display', 'date_sort', 'status', 'page')
NEEDS = ['data/pins.json']          # the files whose record IDs this webapp shows
OUT = ROOT / 'data' / 'central.json'
ids = set()
for f in NEEDS:
    ids |= set(re.findall(r'\b(?:EV|MR|AR)-\d{4}\b', (ROOT / f).read_text(encoding='utf-8')))
items, miss = {}, []
for i in sorted(ids):
    try:
        req = urllib.request.Request(f'{API}{i}?cb={int(time.time())}', headers={'User-Agent': 'cedwyn-webapp-sync/1.0'})
        it = (json.load(urllib.request.urlopen(req, timeout=30)) or {}).get('item') or {}
        if it.get('id') == i: items[i] = {k: it.get(k) for k in FIELDS}
        else: miss.append(i)
    except Exception:
        miss.append(i)
    time.sleep(0.2)
prev = {}
try: prev = json.loads(OUT.read_text(encoding='utf-8'))
except Exception: pass
if len(items) < max(1, len(prev.get('items', {})) // 2):
    sys.exit(f'only {len(items)} of {len(ids)} records readable; data/central.json left as it was')
if prev.get('items') == items and prev.get('not_in_central') == miss:
    print('no change', len(items)); sys.exit(0)
doc = {
    'source': API.rstrip('/'),
    'note': "This webapp's own data store: the central-catalogue fields the map shows for the record IDs in "
            + ', '.join(NEEDS) + '. Derived and read-only; never edit by hand (tools/sync_central.py rewrites it).',
    'fields': list(FIELDS),
    'synced_utc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'count': len(items), 'not_in_central': miss, 'items': items}
OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print('written', len(items), 'missing', len(miss))
