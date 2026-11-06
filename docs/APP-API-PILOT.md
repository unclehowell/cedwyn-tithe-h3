# Tithe H3 API contract pilot

**State: fixture-only, non-production PR.** This is a contract and transport test, not a claim that Tithe H3 has a live API or app-local database. It must not be merged or deployed to the production route as a substitute for the database work in `cedwyn#310` / `cedwyn#311`.

## What was verified before this pilot

- The dedicated app repository is `unclehowell/cedwyn-tithe-h3` (`main` is the app source of truth under the current split-repository policy).
- `data/central.json` is an app-owned, generated projection pulled read-only from `https://cedwyn.bucklerfamily.estate/api/catalogue` by `tools/sync_central.py` and `.github/workflows/sync-central.yml`.
- The projection contains 45 rows and the seven selected fields `id`, `kind`, `title`, `date_display`, `date_sort`, `status`, and `page` in the snapshot inspected on 6 November 2026.
- `data/central.json` is a static generated file. No app-local D1 binding or durable database configuration was found in this repository. It is not a database merely because it is the app's own JSON projection.

## Pilot routes

| Route | Behavior |
|---|---|
| `GET /` with `Accept: text/html` | Calls `context.next()` and preserves the existing static application page. |
| `GET /` with `Accept: application/json` | Returns the fixture collection as JSON. |
| `GET /` with `Accept: application/xml` | Returns the fixture collection as XML. |
| `GET /api/v1` | Returns JSON by default; `Accept: application/xml` or `?format=xml` selects XML. |
| `POST /mcp` | Streamable HTTP JSON-RPC endpoint exposing `resources/list` and `resources/read`. |

The resource URI is `cedwyn://tithe-h3/catalogue`. Current MCP protocol `2026-07-28` uses stateless `server/discover`; compatibility support for `2025-11-25` retains the older `initialize` exchange. This avoids implementing a retired handshake as the only MCP entry point. See the [2026-07-28 MCP release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/) and [Streamable HTTP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/basic/transports/streamable-http.mdx).

## Public data and provenance contract

The pilot uses three synthetic records only. They are not evidence records, not parcels, not rows from `data/central.json`, and not a projection of the central catalogue. The response declares `dataset.mode: fixture-only` and points provenance to the fixture module.

The public-field allowlist is explicit: `id`, `kind`, `title`, `date_display`, `date_sort`, `status`, `page`, and `source`. Source records are projected field-by-field; spreading a source object into a response is prohibited. Fixture-only `internal_note` and `contact_email` canaries exist solely to prove they do not escape the allowlist. No real private information is included.

Stable fixture IDs are namespaced under `urn:cedwyn:fixture:tithe-h3:`. Real API IDs must preserve the central catalogue's stable artifact IDs, or use an app namespace for app-local records, without re-keying the underlying artifact. Every real record must retain a source reference and a clear distinction between central-catalogue projection and app-local data.

## Security and operational contract

- The pilot is public-only. There is no private route, no authentication token, no CRM identifier and no correspondence body. Unknown query parameters (including any attempt to ask for private fields) fail with `400`.
- MCP rejects a mismatched `Origin`, requires JSON POST, checks the protocol header, checks modern method/name headers, and caps the request body at 16 KiB.
- Pagination is bounded (`limit` 1–50; `offset` 0–10,000); errors use `application/problem+json` or JSON-RPC errors. GET responses use a 60-second cache and ETag. MCP is `no-store`.
- Proposed production edge limits: **60 collection GETs/minute/IP** and **30 MCP POSTs/minute/IP**, with `429` and `Retry-After`. These limits are specified but **not enforced by this fixture-only Function**; before production, configure and test Cloudflare rate limiting (or a durable rate-limit service) at the app's own hostname. Do not replace this with an in-memory per-isolate counter.
- No private records may be served anonymously. Any future non-public route requires explicit authentication and per-record authorization, plus tests for unauthenticated, unauthorized, and cross-tenant access.
- The fixture Functions add no D1/KV writes and require no production secrets.

## Database and catalogue boundary

The target production design for each app is:

1. The app's dedicated repository owns its schema, migration, function code, and app-local records.
2. The app-local backend database is the only writer for app-owned state. Per `cedwyn#310`, `view.json` is the single logical app database contract; `section.sqlite` may be a derived/chunked mirror for large apps, never a competing writer.
3. The app requests only the required, read-only public projection from the central Cedwyn catalogue. It does not write app edits back into the catalogue.
4. The API reads its app-local database/view, not the central catalogue directly on every request and not a stale copy from the monorepo theme branch.
5. Provenance, source IDs, version/sync timestamp, and interpretation/artifact separation remain intact.

This pilot intentionally does not invent a D1 binding or provision a database. A production implementation must first add the app-owned migration/binding and a tested sync that updates one canonical local store; then replace the fixture provider with that store and add rollback/restore tests.

## Rollback and release gates

This PR is a review-only change. Cloudflare Pages can produce a branch preview through the existing `cedwyn-tithe-h3` project; production remains unchanged. If the preview breaks, close/revert the PR branch. Static HTML remains the default response for normal browser `Accept` headers. No DNS, Worker route, production Pages setting, D1, KV, HubSpot or email state is changed.

Do not mark the API complete until the app-local database is real, preview tests pass, the live preview paths are checked, production access controls and edge limits are configured, and an owner-approved production release is verified independently.
