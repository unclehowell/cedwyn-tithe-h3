# Tithe H3 map

The Tithe H3 map webapp of [cedwyn.bucklerfamily.estate](https://cedwyn.bucklerfamily.estate/tithe-h3/), in its own repository.

It was split out of `unclehowell/cedwyn` (branch `section/tithe-h3`) on 5 Nov 2026, because that repository holds about 290 branches
(~43 GB with history) and a job on one webapp should never need the rest. This repository is a few MB
(18 files, 1.1 MB at the split).

## Get the code

```
git clone --depth 1 https://github.com/unclehowell/cedwyn-tithe-h3.git
```

## Where to send changes (read this first)

The authoritative `split-repos.json` in `unclehowell/cedwyn` lists this app as `mode: split-repo` and `deploy: repo`. **This repository's `main` branch is the app source of truth.**

1. Make app changes on a feature branch in this repository.
2. Open the pull request into this repository's `main`.
3. The estate build reads this repository directly for `deploy: repo` apps (see `tools/assemble.py` in `unclehowell/cedwyn`). It records the exact source commit and fails closed if the repository cannot be read.
4. The retained `section/tithe-h3` branch in `unclehowell/cedwyn` is a legacy copy, not the app's development or deployment source. The central `sync-split-repos` workflow excludes `deploy: repo` apps, and the local mirror workflow below must run only when the authoritative manifest explicitly says `mode: mirror`.

`SPLIT.json` records the source commit from the initial split; it is historical provenance, not a live sync indicator.

## Previews

Cloudflare Pages builds this repository itself (project `cedwyn-tithe-h3`): `main` at https://cedwyn-tithe-h3.pages.dev/ and every
branch or pull request at `https://<branch>.cedwyn-tithe-h3.pages.dev/`, with the link commented on the pull request.
`preview.yml` is the fallback route (wrangler with the secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`, unset; it stops quietly).

## History before the split

The full history stays on the old branch: https://github.com/unclehowell/cedwyn/commits/section/tithe-h3

Latest commits on `section/tithe-h3` at the split:

| Date | Commit | Change |
| --- | --- | --- |
| 2026-11-05 | `853258d` | Tithe H3 v0.6.0: smaller pins, cell-count box legible in the top-left corner |
| 2026-11-05 | `62d02a0` | Tithe H3 v0.6.0 changelog and readme |
| 2026-11-05 | `ee3d462` | Tithe H3 v0.6.0: OS c.1900 at every zoom, auto H3 resolution with lock (floor 12), Highlight parcels rename, e |
| 2026-11-05 | `46c7689` | Tithe H3 v0.6.0 data: estimated gap-free parcel shapes, pins and dated records, empty later Land Registry laye |
| 2026-11-04 | `6042f4a` | Tithe H3 v0.5.0 changelog |
| 2026-11-04 | `3ac0f01` | Tithe H3 v0.5.0: map first on a phone — one-line title, intro under the map, layer and hexagon controls folded |
| 2026-11-03 | `6054262` | Tithe H3 v0.4.0: VERSION, changelog and README |
| 2026-11-03 | `1548495` | Tithe H3 v0.4.0: H3 resolution picker (8, 10-15), cells made in the browser for the view |
| 2026-11-03 | `5c10ea2` | Tithe H3 v0.3.0: changelog and README for the traffic-light layer |
| 2026-11-03 | `1759d58` | Tithe H3 v0.3.0: traffic-light parcel layer |
| 2026-11-02 | `1a8a4f4` | Tithe H3 v0.2.0: (i) changelog modal, cache-busted data and overlays, method notes |
| 2026-11-02 | `3e3d40a` | Tithe H3 v0.2.0: both old-map overlays moved with the same correction; version and changelog |

Never force-push; never delete the old branch.
