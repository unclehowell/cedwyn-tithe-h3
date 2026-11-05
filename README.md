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

`split-repos.json` on `unclehowell/cedwyn` main sets the mode:

- **mirror** (now): the old branch `section/tithe-h3` on unclehowell/cedwyn is still the source. `mirror.yml` here copies it every
  30 minutes. Send pull requests to `section/tithe-h3` on unclehowell/cedwyn (clone it with
  `git clone --depth 1 --single-branch --branch section/tithe-h3 --filter=blob:none https://github.com/unclehowell/cedwyn.git`).
- **split-repo** (after the owner switches it): this repository is the source; send pull requests here.
  unclehowell/cedwyn copies `main` back into `section/tithe-h3`, so the live page and every old path keep working.

`SPLIT.json` records the source commit of the last copy. The app's own notes, if the branch had any, are in `APP-README.md`.

## Previews

`preview.yml` deploys every pull request to Cloudflare Pages and comments the link, once the repository secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set (Settings → Secrets → Actions). Without them it stops quietly.

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
