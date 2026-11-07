# Changelog

## v0.6.3 (7 Nov 2026)
- Street-map tiles on the live page. The site build keeps a map-tile address only when it starts with a template in `allowed_tile_templates` (unclehowell/cedwyn `themes.json`: `https://{s}.tile.openstreetmap.org/`); the bare `https://tile.openstreetmap.org/` form of v0.6.2 is not listed, so the build rewrote it into a `/wayback/go/?u=` link and the browser blocked every tile (ERR_BLOCKED_BY_ORB, checked 7 Nov 16:30Z at 390 px). The OSM layer is back on the `{s}` form (`subdomains: "abc"`) and keeps `referrerPolicy: strict-origin-when-cross-origin`. Footer and changelog table brought up to date (they still read v0.6.1). Issue #5.

## v0.6.2 (6 Nov 2026)
- OpenStreetMap base layer: tile images now send the page's origin as the referrer (`referrerPolicy: strict-origin-when-cross-origin`), because the site-wide `Referrer-Policy: no-referrer` header stripped it and the OpenStreetMap tile servers refuse tile requests with no referrer; the single `tile.openstreetmap.org` host replaces the deprecated `a/b/c` subdomains. The OS six-inch layer is unchanged. Issue #5.

## v0.6.1 (6 Nov 2026)
- Record IDs in the dated-record pop-ups link to their catalogue pages (title on hover). They come from the map's own data store, `data/central.json`: only id, kind, title, date, status and page for the IDs in `data/pins.json`, pulled read-only from the central catalogue by `tools/sync_central.py` every 6 hours (`.github/workflows/sync-central.yml`). An ID the central catalogue does not hold yet stays plain text.

## v0.6.0 (5 Nov 2026)
- OS c.1900 overlay stays visible at every zoom: its tiles exist to zoom 17 only, so they are now enlarged past 17 (maxNativeZoom 17) instead of going blank at 18 and above.
- Hexagons follow the zoom, never below resolution 12: 12 up to zoom 16, 13 at zoom 17, 14 at 18 and 19, 15 from 20 (stepping back one where the view would pass the cell cap). "Lock resolution" (or picking a resolution) holds one resolution at every zoom. Resolutions 8, 10 and 11 leave the picker.
- "Traffic light" is renamed "Highlight parcels".
- Parcel shapes: a gap-free, non-overlapping reconstruction (data/parcels-est.json). The 43 traced outlines are merged and closed by 12 m into an estate outline; an outline lying at least 40% inside a larger one keeps the shared ground (22 in 23, B in 29, 42 in 45); other overlaps split along the midline; gaps go to the nearest parcel; scraps under 400 m² merged. Boundaries between parcels are estimated, and the page says so. The outlines as drawn stay in parcels.json and on the "Traced outlines (as drawn)" layer. Plan numbers 18 and 46-59 are not placed: no figure 18 could be read, and no figures 46-59 were found on the plan (the highest read is 45).
- New layer "Highlight parcels — later Land Registry" (cyan, overlaps allowed in this layer only), reading data/registry-parcels.geojson, empty until registry title plans are held.
- Pins key: Bute, Williams and Other, one pin per placed parcel from the 1841 apportionment as entered (occupier is not owner), each its own layer; and "Dated records", diamond markers grouping 80 dated records from the site's evidence pages (65 placed: estate-wide, house-and-yard plot, wooded strip, Parcel B, Leckwith Common; 15 not placed). Data: data/pins.json.
- The cell count moves to the top-left corner so the credits bar no longer covers it at 390 px, and shows the resolution in use.

## v0.5.0 (4 Nov 2026)
Map first on a phone. The page title is one visually hidden line (the site header already reads "Tithe H3 · 42 of 59"), the introduction moves under the map, and the layer switches (traffic light, 1841 tithe map, Stewart plan, OS c.1900, opacity) and the hexagon picker fold into a "Layers" button on the map, closed by default. The cell count sits in the map's bottom-left corner as "N cells in view"; the hexagon size shows once, in the picker. At 390 px the map now starts about 177 px from the top (was about 415 px). No change to data, layers or behaviour.

## v0.4.0 (3 Nov 2026)
H3 resolution picker: 8, 10, 11, 12 (default), 13, 14, 15. Resolution 15 is the finest the H3 grid has (about 0.9 m² a cell); there is no resolution above it. Resolution 8 keeps the cell holding each parcel's centre. From 10 up, cells are generated in the browser with h3-js 4.5.0 (polygonToCells, vendored) for the map area in view only, never stored; a cell is drawn when its centre falls inside a parcel outline (centroid-in-polygon), in that parcel's traffic-light colour. Work is capped at about 20,000 cells; past the cap, and below zoom 17 (res 14) or zoom 19 (res 15), a "Zoom in to see res N" prompt shows with a zoom button. The map zooms to 21 (tiles scaled past their own zoom). Tapping a parcel names the hexagon under the tap at the chosen resolution.

## v0.3.0 (3 Nov 2026)
Traffic-light layer, on by default with a switch in the layer bar. Red: every parcel on the c.1824 estate plan of Cedfin alias Ty Mawr. Amber: land with a possible link that is not established: Parcel B (plan 5 and 6, over 1841 tithe 193; match not checked), Leckwith Common and the playing fields (City of Cardiff (Leckwith Common) Compulsory Purchase Order 1957, confirmed 1958; extent not yet located, so a guide pin marks today's Leckwith Moors park), Parcel C (no boundary held; not drawn). Green: Parcel A (plan parcels over 1841 tithe 209, 211, 219, 220: house and yard, orchard, wood strip, field; a working match). Legend wording: family-associated land, a working classification, not a legal finding. Parcel popups and the table carry the light.

## v0.2.0 (2 Nov 2026)
Re-aligned to today's ground. The whole layer (parcel outlines, centres, both old-map overlays) was moved by one affine correction fitted to seven control points on OpenStreetMap (St Dochdwy's church, the Cwm Cydfin stream mouth at the Ely, the Ely meander tip round plot 216, the Ely's north-west bend and first bend, the Cwm Cydfin stream curve, a field boundary on Penlan Road): about 86 m RMS out before, about 7 m RMS after. The correction scales the layer by about 1.16 and turns it about 5°, so traced areas now total about 140 acres against 139a 3r 8p on the plan (before: 105). OS grid references and the H3 cells (res 8, 11, 12) were regenerated from the moved outlines. The (i) button opens the changelog table.

## v0.1.2 (2 Nov 2026)
The page shows at /tithe-h3/ (Online) as well as /wales/tithe-h3/; it stays hidden in the Argentina scope. On /wales/tithe-h3/ the header showed the Wales hub's name and number because this webapp is not yet in the area registry; the page now writes "Tithe H3" and "42 of 59" there too, and stands down once the registry carries slot 42.

## v0.1.1 (2 Nov 2026)
The "42 of 59" number moves into the header's own numbering slot (the in-page line under the header is removed). The header's third row (the e-book "Read free" strip) is hidden on this webapp; only the shared Garden banner may use that row. The street map uses the site's shared OpenStreetMap tile template.

## v0.1.0 (2 Nov 2026)
First version.
