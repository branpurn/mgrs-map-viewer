# MGRS Viewer — Copy sheet v1.6
For Designer (print title block), Frontend (string keys), and Infra (README). Field / planning tone. No consumer voice.

**Import:** Frontend uses `/workspace/mgrs-map-viewer/strings.json` (flat key→string). Do not scrape this markdown.

**Locked (PM, 2026-08-15):** product name `MGRS Viewer`. Formal/project name `MGRS Map Viewer`. One-liner and voice unchanged.

**Voice:** short, specific, imperative. Labels over sentences. Never “explore,” “discover,” or “adventure.”
**Audience:** people who already know MGRS, or can follow a format hint.
**Product name:** MGRS Viewer
**Formal / project name:** MGRS Map Viewer
**Do not use:** Gridly, MapDrop, FieldScout, or anything cute.

**Header one-liner**
`Search a grid or place. Print the sheet.`

---

## 1. Search

| Key | Copy |
|---|---|
| `search.placeholder` | `Grid or place` |
| `search.helper` | `MGRS, lat/long, or a place name` |
| `search.ariaLabel` | `Search by grid, coordinates, or place` |
| `search.submit` | `Search` |
| `search.clear` | `Clear` |

Format hint (helper or first-focus tooltip, one line):
`Examples: 18T WK 8712 0415 · 38.889, -77.035 · Arlington VA`

### Errors

| Key | Copy |
|---|---|
| `search.error.empty` | `Enter a grid, coordinates, or place name.` |
| `search.error.unrecognized` | `Unrecognized coordinates.` |
| `search.error.unrecognizedHint` | `Use MGRS (18T WK 8712 0415) or decimal lat, long.` |
| `search.error.noPlace` | `No place found for “{q}”.` |
| `search.error.ambiguous` | `Several matches for “{q}”. Select one.` |
| `search.error.failed` | `Search failed. Try again.` |
| `search.error.offline` | `Search needs a connection.` |

Ambiguous-results list:
- Heading: `Matches`
- Item secondary line: `{region}` or `{lat}, {lon}` (whichever you have)
- Too many: `Showing the first {n} matches.`

---

## 2. Map chrome

| Key | Copy |
|---|---|
| `chrome.print` | `Print` |
| `chrome.printTitle` | `Print this frame (US Letter)` |
| `chrome.printing` | `Preparing sheet…` |
| `chrome.printBlocked` | `Allow printing in the browser, then try again.` |
| `chrome.scale` | `1:{n}` |
| `chrome.scaleLabel` | `Scale` |
| `chrome.empty` | `Search a grid or place to set the frame.` |
| `chrome.loading` | `Loading map…` |
| `chrome.loadingTiles` | `Loading tiles…` |
| `chrome.tilesFailed` | `Map tiles failed to load.` |
| `chrome.retry` | `Retry` |

Scale readout is the ratio only (`1:24 000`). Use a thin space or comma in the number, not `1/24000`. Put `Scale` in the `aria-label` or a quiet caption, not as a loud chip.

---

## 3. Print sheet — title block

USGS-style labels. Short. All of these are **labels**; values are live.

| Key | Label | Value (source) |
|---|---|---|
| `print.series` | `Topographic` | static |
| `print.title` | *(no label — the title is the value)* | Place name, or MGRS 1 km / 10 km square if no place |
| `print.subtitle` | *(no label)* | Product name: `MGRS Viewer` |
| `print.scale` | `Scale` | `1:{n}` (same as chrome, frozen at print) |
| `print.grid` | `Grid` | `MGRS` |
| `print.gridInterval` | `Grid interval` | `{n} m` (e.g. `1000 m`) |
| `print.datum` | `Datum` | `WGS 84` |
| `print.projection` | `Projection` | `UTM` |
| `print.contour` | `Contour interval` | hide the row if unknown |
| `print.printed` | `Printed` | `15 Aug 2026` (local date, no clock) |
| `print.sheet` | `Sheet` | `8.5 × 11 in` *(v1.5, one line)* |

**North**
- Label: `North`
- Arrow caption: `True north`
- Do not show magnetic north or declination in v1 (we will not have a reliable value).

**Legend headings** (only show layers that are on the sheet)

| Key | Copy |
|---|---|
| `print.legend` | `Legend` |
| `print.legend.roads` | `Roads` |
| `print.legend.water` | `Water` |
| `print.legend.contours` | `Contours` |
| `print.legend.grid` | `MGRS grid` |
| `print.legend.places` | `Places` |
| `print.legend.relief` | `Relief` |

**Disclaimer** (title block or footer, one block):
`Not an official USGS or military product. Verify in the field. Do not use as the sole navigation source.`

Short fallback if the block is tight:
`Not official. Verify in the field.`

**Attribution** (footer line, OSM/USGS style — pick the tile source in use)

| Source | Line |
|---|---|
| OpenTopoMap (preferred) | `Map data © OpenStreetMap contributors, SRTM. Style © OpenTopoMap (CC-BY-SA).` |
| OSM standard | `Map data © OpenStreetMap contributors.` |
| Always append | `Not a USGS map.` |

Full preferred footer (OpenTopoMap):
`Map data © OpenStreetMap contributors, SRTM. Style © OpenTopoMap (CC-BY-SA). Not a USGS map.`

---

## 4. Title-block layout note for Designer

Stack, left-to-right USGS habit:

1. **Title** (largest) + series word `Topographic` + product `MGRS Viewer`
2. **Scale** (ratio + bar — bar is visual; label is `Scale`)
3. **Grid / interval / datum / projection** as a tight spec column
4. **North** arrow, right of the spec column
5. **Legend** opposite the spec column, or under the map if the footer is short
6. **Printed** + **Sheet** on the far end of the footer
7. **Disclaimer** then **attribution**, last line, smallest type

If the footer is one strip: `Title · Scale · Grid · Datum · North` on the left/center; disclaimer + attribution full-width underneath.

Do not put a logo lockup or tagline on the sheet. The title and the grid spec are the identity.

---

## 5. Page header (web)

| Key | Copy |
|---|---|
| `app.name` | `MGRS Viewer` |
| `app.nameFormal` | `MGRS Map Viewer` |
| `app.tagline` | `Search a grid or place. Print the sheet.` |
| `app.documentTitle` | `MGRS Viewer` |

Browser tab: `MGRS Viewer`
Printed sheet product line: `MGRS Viewer` (matches `print.subtitle`)

---

## 6. Out of scope this wave
Auth, accounts, share links, “welcome” marketing, onboarding carousel, magnetic declination, unit toggle copy (meters only for grid interval).

---

## 7. Print filename and save-as (v1.1)

Pattern (no spaces, lowercase prefix, uppercase MGRS token):

`mgrs-viewer-{mgrs}-{yyyy-mm-dd}`

| Token | Rule |
|---|---|
| `{mgrs}` | Compact MGRS of the frame center (or the searched grid). Strip spaces. Uppercase. Example: `18TWK87120415` |
| `{yyyy-mm-dd}` | Local date of the print. Example: `2026-08-15` |
| extension | `.pdf` if the client writes a file. Omit if the browser print dialog names the file. |

Fallback if no grid is available yet:

`mgrs-viewer-frame-{yyyy-mm-dd}`

Worked example: `mgrs-viewer-18TWK87120415-2026-08-15.pdf`

If the path is `window.print()`, set `document.title` to the same basename so the dialog’s default name matches.

| Key | Copy |
|---|---|
| `print.filename` | `mgrs-viewer-{mgrs}-{yyyy-mm-dd}` |
| `print.filenameFallback` | `mgrs-viewer-frame-{yyyy-mm-dd}` |
| `chrome.printing` | `Preparing sheet…` *(unchanged)* |
| `print.saveAs` | `Save as {filename}` |
| `print.downloading` | `Downloading {filename}` |

Use `print.saveAs` only on a download / Save as path. The print dialog does not need it.

---

## 8. Search format reference (v1.1)

Show under the helper (`search.helper`). One short block. Same example family as the one-line hint.

| Key | Copy |
|---|---|
| `search.formats.heading` | `Formats` |
| `search.formats.mgrs100` | `100 m · 18T WK 8712 0415` |
| `search.formats.mgrs1k` | `1 km · 18T WK 871 041` |
| `search.formats.mgrs10k` | `10 km · 18T WK 87 04` |
| `search.formats.decimal` | `Lat, long · 38.889, -77.035` |
| `search.formats.dms` | `DMS · 38°53′20″N 77°02′06″W` |
| `search.formats.place` | `Place · Arlington VA` |

Stacked block (drop-in, keep the dots and spaces):

```
Formats
100 m    18T WK 8712 0415
1 km     18T WK 871 041
10 km    18T WK 87 04
Lat, long    38.889, -77.035
DMS          38°53′20″N 77°02′06″W
```

Accept compact MGRS (`18TWK87120415`) as well as spaced. Do not show USNG as a separate line unless Backend ships it.

---

## 9. Tile source chrome (v1.1)

Quiet status, not a toast. Show when the source is active or when it switches.

| Key | Copy |
|---|---|
| `chrome.tiles.opentopomap` | `Using OpenTopoMap tiles` |
| `chrome.tiles.osm` | `Using OpenStreetMap tiles` |
| `chrome.tiles.switchedOsm` | `Using OpenStreetMap tiles` |
| `chrome.tiles.switchedTopo` | `Using OpenTopoMap tiles` |

Same string for idle and switch. Do not add “fallback” or “degraded” — the user does not need the reason.

---

## 10. README blurb (v1.1, for Infra)

Drop in as the opening of the repo README. 7 lines. Do not add badges or marketing above it.

```
MGRS Viewer is a browser tool for field and planning work.

Search a Military Grid Reference, lat/long, or a place name. The map
shows an MGRS grid over topographic tiles. Set the frame, then print
a US Letter (8.5 × 11 in) sheet with scale, grid spec, and a title block.

No account. Scale follows zoom. Tiles are OpenTopoMap, with OpenStreetMap
as fallback. Not an official USGS or military product. Verify in the field.
```

---

## 11. Backend error map (v1.2)

`GET /api/search` errors. Reuse v1 keys. One new key: `search.error.unrecognizedQuery`.

| Backend `error` | Typical HTTP | Key | Copy |
|---|---|---|---|
| `unrecognized_query` | 400 | `search.error.unrecognizedQuery` | `Unrecognized query.` |
| `invalid_coordinates` | 400 | `search.error.unrecognized` | `Unrecognized coordinates.` |
| `not_found` | 404 | `search.error.noPlace` | `No place found for “{q}”.` |
| `upstream` | 502 | `search.error.failed` | `Search failed. Try again.` |

Hints (do not invent a second line if the formats block is already open):

| Backend `error` | Hint key | Copy |
|---|---|---|
| `unrecognized_query` | `search.helper` | `MGRS, lat/long, or a place name` *(reuse)* |
| `invalid_coordinates` | `search.error.unrecognizedHint` | `Use MGRS (18T WK 8712 0415) or decimal lat, long.` |

Empty client submit still uses `search.error.empty`. Offline still uses `search.error.offline`. Ambiguous still uses `search.error.ambiguous` (client-side list, not a Backend code). If Backend returns 200 with an empty `results` array, treat it as `not_found` / `search.error.noPlace`.

Do not surface Backend `message` verbatim. The table above is the user-facing line.

---

## 12. Live MGRS readout (v1.2)

Map chrome, next to the scale readout. Updates as the frame pans. Source: `GET /api/convert?lat=&lon=&precision=`.

| Key | Copy |
|---|---|
| `chrome.mgrsLabel` | `MGRS` |
| `chrome.mgrs` | `{mgrs}` |
| `chrome.mgrsAria` | `MGRS at frame center` |

Display with spaces, same family as the format reference. Example at 100 m:

`MGRS  18T WK 8712 0415`

Precision follows zoom (do not lock a digit count in the label). Compact form is for filenames only.

If convert fails or is in flight: keep the last good value, or hide the readout. No error toast. No “—” placeholder.

---

## 13. Keyboard (v1.2)

Enter submits search. Esc clears.

Prefer aria only. Show the one-liner only if the UI already has a shortcut row.

| Key | Copy |
|---|---|
| `search.shortcutLine` | `Enter search · Esc clear` |
| `search.ariaSubmit` | `Search. Enter to submit.` |
| `search.ariaClear` | `Clear search. Escape to clear.` |

Do not add a keyboard cheatsheet, modal, or “Pro tip.”

---

## 14. Print guard (v1.3)

User hits Print before a search or frame is set.

| Key | Copy |
|---|---|
| ~~`print.guard.noFrame`~~ | *dropped v1.4 — print is always allowed* |

---

## 15. Unsupported browser / no WebGL (v1.3)

MapLibre cannot start (no WebGL, or the context failed).

| Key | Copy |
|---|---|
| `chrome.noWebGL` | `This browser cannot draw the map.` |

One line. No retry, no “try Chrome,” no download link. Replace the map canvas with this line. Do not show search or Print on this state.

---

## 16. Grid interval by zoom (v1.3)

Use `Math.floor(zoom)` from MapLibre. One band at a time. Display strings replace the old `{n} m` form on `print.gridInterval` (do not print `10000 m`).

Live MGRS precision matches the band. Pass that `precision` to `GET /api/convert`.

| `floor(zoom)` | Interval | `print.gridInterval` | Convert `precision` | Live MGRS example | Grid / interval / live readout |
|---|---|---|---|---|---|
| 0–7 | GZD only (screen) | *(no interval row)* | — | — | Screen overlay stays (GZD). No live MGRS interval. |
| 8–10 | 10 km | `10 km` | 1 | `18T WK 87 04` | Show |
| 11–13 | 1 km | `1 km` | 2 | `18T WK 871 041` | Show |
| 14–16 | 100 m | `100 m` | 3 | `18T WK 8712 0415` | Show |
| 17–22 | 100 m | `100 m` | 3 | `18T WK 8712 0415` | Show *(no 10 m v1)* |

v1.4: do **not** hide the screen overlay at zoom 0–7 (GZD stays). Hide only the interval row and live MGRS *interval* at that band. Print interval follows Design RF table, not this screen table.

Print freezes the band at the moment of Print (same as scale). Filename `{mgrs}` uses the compact form of the live readout at that band.

Keys (values are the four display strings, or empty when hidden):

| Key | Copy |
|---|---|
| `print.gridInterval.10k` | `10 km` |
| `print.gridInterval.1k` | `1 km` |
| `print.gridInterval.100m` | `100 m` |
| ~~`print.gridInterval.10m`~~ | *dropped v1.4 — no 10 m grid* |

---

## 17. Design lbl.* map (v1.4)

Source: `design/DESIGN_SPEC.md` §6. Copy sheet wins for voice. Spec wins for length/case on collar titles (ALL CAPS, `TN`, 6 pt strip).

Print is always allowed. Empty / ocean frame → `lbl.untitled`. `print.guard.noFrame` is dropped. No 10 m grid. Screen GZD stays visible at low zoom.

| Design key | Copy | Notes |
|---|---|---|
| `lbl.product` | `MGRS MAP VIEWER` | Upper collar, 7.5 pt. Formal name. Fits. |
| `lbl.sheetTitle` | `{place}, {st}` | 11–12 pt Condensed Bold CAPS. Empty/ocean → `lbl.untitled`. |
| `lbl.sheetDate` | `{date}` | Format `D MMM YYYY`, e.g. `15 AUG 2026`. |
| `ph.search` | `Grid or place` | Same as `search.placeholder`. Copy voice. |
| `lbl.print` | `Print` | Same as `chrome.print`. |
| `lbl.legendFeatures` | `FEATURES` | Col A title. Spec length/case. |
| `lbl.legIndex` | `Index contour` | |
| `lbl.legInt` | `Intermediate contour` | |
| `lbl.legHydro` | `Water` | Copy voice (was “Stream / waterbody”). |
| `lbl.legVeg` | `Woodland` | Matches the veg swatch. |
| `lbl.legRoad` | `Roads` | Copy voice. |
| `lbl.contourInterval` | `CONTOUR INTERVAL {n} {unit}` | Omit the line if `{n}` unknown. |
| `lbl.trueNorth` | `TN` | 6.5 pt under the N. Spec length. Aria stays `True north`. |
| `lbl.scaleNote` | `SCALE AT CENTER OF SHEET` | Spec length. |
| `lbl.legendGrid` | `MGRS GRID` | Col C title. Spec length/case. |
| `lbl.gridGzd` | `GZD (zone)` | |
| `lbl.grid100` | `100 km square` | |
| `lbl.gridPrin` | `Principal ({interval})` | `{interval}` is `10 km` / `1 km` / `100 m`. |
| `lbl.gridPrefix` | `GRID` | Spec length/case. |
| `lbl.datum` | `DATUM WGS84 · UTM {zone}` | One line. Fits 2.34 in. |
| `lbl.attribution` | `Map data © OpenStreetMap contributors https://www.openstreetmap.org/copyright, SRTM. Style © OpenTopoMap (CC-BY-SA) opentopomap.org. Not a USGS map. Not for navigation.` | 6 pt strip. URLs required. |
| `lbl.attributionOsm` | `Map data © OpenStreetMap contributors https://www.openstreetmap.org/copyright. Not a USGS map. Not for navigation.` | OSM tile fallback only. |
| `lbl.searchMiss` | `No place found for “{q}”.` | Copy voice. Toolbar has the width. |
| `lbl.untitled` | `UNTITLED SHEET` | Empty / ocean print. |
| `lbl.gridUnavailable` | `MGRS grid unavailable at this latitude.` | Polar UPS out of scope. |

### Keyboard (v1.4)

| Key | Copy |
|---|---|
| `search.shortcutLine` | `/ focus · Enter search · Esc clear · P print · +/− zoom` |
| `search.ariaSubmit` | `Search. Enter to submit.` |
| `search.ariaClear` | `Clear search. Escape to clear.` |
| `search.ariaFocus` | `Focus search. Slash to focus.` |
| `chrome.ariaPrint` | `Print. P to print.` |
| `chrome.ariaZoomIn` | `Zoom in. Plus to zoom in.` |
| `chrome.ariaZoomOut` | `Zoom out. Minus to zoom out.` |

Show `search.shortcutLine` only if a shortcut row already exists.

### Print interval (v1.4, by RF — Design §4)

Replaces the 10 m band. Screen overlay is separate (GZD at ≤6, then Design §4).

| RF | `print.gridInterval` / `{interval}` |
|---|---|
| ≥ 1:75 000 | `10 km` |
| 1:25 000 – 1:74 999 | `1 km` |
| ≤ 1:24 999 | `100 m` |

### Title-block fit (2.00 in collar, 2.34 in ident, 0.08 in pad → 2.18 in type)

| Row | Fit | Action |
|---|---|---|
| `lbl.sheetTitle` 12 pt Condensed Bold +40, CAPS | ~28 characters | Longer names overflow. Truncate. Do not wrap. |
| `lbl.gridPrefix` + GZD + 100 km, 8 pt Mono | Fits | — |
| RF `1:{n}`, 8 pt Mono | Fits | — |
| `lbl.datum`, 7 pt Sans | Fits | — |
| `lbl.sheetDate`, 7 pt | Fits | — |
| Long disclaimer | **Does not fit Col C** | Legal is the 6 pt strip only. Do not add a 6th ident row. |
| Short disclaimer `Not official. Verify in the field.` | Would fit a 6th row, unused | Keep in `print.disclaimerShort` only if Designer opens a row. |
| `lbl.product` 7.5 pt upper collar | Fits | — |
| `lbl.attribution` 6 pt × 7.74 in | Fits (~118 of ~165 chars) | — |

Upper-collar right title (11 pt) has the same ~28-character cap. Same truncate rule.

---

## 18. Legal URLs + sheet size (v1.5)

No other copy changed.

| Key | Copy |
|---|---|
| `lbl.attribution` | `Map data © OpenStreetMap contributors https://www.openstreetmap.org/copyright, SRTM. Style © OpenTopoMap (CC-BY-SA) opentopomap.org. Not a USGS map. Not for navigation.` |
| `lbl.attributionOsm` | `Map data © OpenStreetMap contributors https://www.openstreetmap.org/copyright. Not a USGS map. Not for navigation.` |
| `print.sheetValue` | `8.5 × 11 in` |

`print.sheet` stays `Sheet`. Do not wrap `print.sheetValue`.

---

## 19. Polar readout (v1.6)

Same sentence as `lbl.gridUnavailable`. No new voice.

| Key | Copy |
|---|---|
| `chrome.gridUnavailable` | `MGRS grid unavailable at this latitude.` |
