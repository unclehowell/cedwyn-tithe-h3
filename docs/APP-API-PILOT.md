# Tithe H3 app-view API

**State: non-production API pilot backed by the app-local view database.** The API now reads the generated data/view.json contract rather than synthetic fixtures or the old data/central.json cache.

## Database contract and data flow

data/view.json is Tithe H3's single logical app database/view, following ADR-002 in cedwyn#310:

1. App-owned map records are authored in data/pins.json; parcel geometry remains in the app-owned files referenced by the view.
2. tools/sync_central.py reads the public central catalogue API for the record IDs referenced by the map.
3. It copies only these seven public fields: id, kind, title, date_display, date_sort, status, and page.
4. It writes one data/view.json containing the app-owned map pins, the seven-field central catalogue projection, missing-ID list, provenance, sync timestamp and geometry asset references.
5. The browser and JSON/XML/MCP API all read the same view. The central catalogue remains authoritative for catalogue fields; the app repository remains authoritative for map-specific data and interpretation.

There is no app-local D1 database binding in this pilot. view.json is the app database contract selected by ADR-002; a chunked SQLite mirror is not needed for this dataset size. No other app's database is reused.

## API routes

| Route | Behavior |
|---|---|
| GET / with Accept: text/html | Calls context.next() and preserves the existing static application page. |
| GET / with Accept: application/json | Returns the public catalogue projection from data/view.json. |
| GET / with Accept: application/xml | Returns the same projection as XML. |
| GET /api/v1 | Returns JSON by default; Accept: application/xml or ?format=xml selects XML. |
| POST /mcp | Stateless Streamable HTTP JSON-RPC endpoint exposing resources/list and resources/read. |

The MCP resource URI is cedwyn://tithe-h3/catalogue. Current protocol 2026-07-28 uses stateless server/discover; compatibility support for 2025-11-25 retains the older initialize exchange.

## Public data and provenance

The API exposes only the seven central-catalogue fields plus a constructed source URL. It does not spread or return the full central record. Private fields, bodies, correspondence, attachments and non-public catalogue rows are excluded before the app view is written.

Each response declares:
- dataset.mode: app-view;
- the app repository and data/view.json path;
- the central public catalogue source and synced_utc;
- a per-record source URL.

Map records are app-owned and remain distinct from central evidence records. Missing central IDs are recorded in catalogue.not_in_central; the API does not fabricate catalogue records for them.

## Security and operational contract

- Public read-only routes only. Unknown query parameters fail with 400.
- MCP rejects a mismatched Origin, requires JSON POST, checks protocol and modern method/name headers, and caps request bodies at 16 KiB.
- Pagination is bounded (limit 1–50; offset 0–10,000); errors use application/problem+json or JSON-RPC errors.
- GET responses use a 60-second cache and ETag. MCP is no-store.
- Proposed production edge limits: 60 collection GETs/minute/IP and 30 MCP POSTs/minute/IP. These limits are specified but not enforced by this pilot; before production, configure and test Cloudflare rate limiting at the app hostname.
- No private records may be served anonymously. Any future non-public route requires authentication and per-record authorization.

## Sync and recovery

sync-central.yml runs every six hours and also on pushes that change data/pins.json or the sync script. The sync is idempotent: unchanged view data does not produce a commit. If fewer than half of the previously available catalogue records can be read, the previous view.json is retained. If a central record is no longer public, it is omitted from the next successful view and listed as not in the central catalogue.

The static map geometry remains in the repository and can be rebuilt from Git history. data/view.json is generated; never edit it by hand. Re-running tools/sync_central.py restores the view from app-owned map data and the central public catalogue.

## Release gates

This is a reviewable API/database pilot, not production acceptance. The PR preview must be checked at desktop and mobile widths; /api/v1 JSON, XML and MCP must be checked on the preview hostname; production remains unchanged. Do not mark the API complete until preview HTTP checks, edge rate limits, sync behavior and rollback are verified independently.
