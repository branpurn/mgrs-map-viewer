# MGRS Map Viewer — Design Spec (v1, build against this)

Source of truth for Frontend. Mockups are direction only; if a mock disagrees with this file, this file wins.

- Product: browser map → print US Letter 8.5×11 portrait, USGS-topo look
- Base: OpenTopoMap (fallback OSM). No auth v1.
- Grid: MGRS is first-class (not a lat/lon graticule)
- Copy: locked keys in /workspace/mgrs-map-viewer/strings.json (copy-sheet-v1.md). Do not invent strings.
- Fonts: IBM Plex Sans + IBM Plex Sans Condensed + IBM Plex Mono (SIL OFL)

---

## 1. Tokens

### Color

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F4EFE4` | page, readout card, print button fill |
| `collar` | `#EDE6D6` | print lower/upper collar fill |
| `ink` | `#1C1914` | body text, neatline, 100 km / 1 km grid |
| `ink-muted` | `#4A4036` | secondary collar type, attribution |
| `chrome` | `#2B2924` | web toolbar, zoom buttons |
| `chrome-inset` | `#3A3731` | search field fill |
| `gzd` | `#8B1E1E` | GZD / zone-boundary lines + labels |
| `contour-index` | `#A65D32` | legend only (tiles own contours) |
| `contour-int` | `#C4845A` | legend only |
| `hydro` | `#3A7CA5` | legend only |
| `veg` | `#5B7F4A` | legend only |
| `road` | `#1C1914` | legend only |
| `frame` | `#1C1914` | web print-frame overlay, 55% opacity dashed |

Do **not** use cyan/blue for the MGRS grid. Blue is reserved for hydro. Grid is ink + gzd red.

### Type

| Role | Face | Web | Print |
|---|---|---|---|
| UI / collar body | IBM Plex Sans | 13 / 12 | 7.5 pt |
| Sheet title | IBM Plex Sans Condensed Bold | — | 12–11 pt, tracking +20 |
| Toolbar | IBM Plex Sans | 14 | — |
| Grid labels | IBM Plex Mono | 11–14 | 7 pt |
| RF / MGRS readout | IBM Plex Mono | 13 | 9 pt |
| Attribution | IBM Plex Sans | — | 6 pt |

Line-height 1.2. No letter-spacing on mono.

---

## 2. Print sheet — US Letter portrait

`@page { size: 8.5in 11in; margin: 0; }`
Orientation: **portrait only**. Landscape is out of scope for v1.

### Coordinate system

Origin: top-left of the physical page.
Units: inches (and 96 CSS px, and 300 dpi print px).

| | in | CSS px @96 | print px @300 |
|---|---|---|---|
| Page W | 8.50 | 816 | 2550 |
| Page H | 11.00 | 1056 | 3300 |

### Frame (neatline)

| Edge | in from page | CSS px | 300 dpi |
|---|---|---|---|
| Left | 0.38 | 36.5 | 114 |
| Right | 0.38 (x = 8.12) | 36.5 | 114 |
| Top | 0.58 | 55.7 | 174 |
| Bottom | 2.28 (y = 8.72) | 218.9 | 684 |

Map frame interior: **7.74" × 8.14"** (743 × 781 CSS px).

Neatline stroke: **1.25 pt**, `ink`, square corners. No radius.

Printer-safe: keep all ink ≥ 0.25" from paper edge. Collar type sits inside that.

### Upper collar (y 0.25 → 0.58, x 0.38 → 8.12)

Height 0.33". Fill `collar`. Baseline of type 0.12" above neatline. No logo, no tagline.

- Left: `app.name` — 7.5 pt Sans, `ink-muted`, "MGRS Viewer"
- Right: `print.title` / `lbl.sheetTitle` — 11 pt Condensed Bold, `ink` — place name, or the MGRS square if no place. No "Title" label. **Max 28 characters, truncate with an ellipsis, do not wrap.**

### Map interior

1. Base tiles, clipped to neatline.
2. MGRS overlay frozen at the print zoom band (see §4), not a live screen redraw.
3. Corner ticks: 0.08" inward ticks on the neatline at every **principal** grid line.
4. Edge labels (mono 7 pt, `ink`) sit in a 0.14" band *inside* the neatline, not in the collar:
   - Eastings along top + bottom
   - Northings along left + right
   - Format: see §4 label grammar
5. GZD + 100 km square ID drawn once in each visible corner, 8 pt Mono Bold, `gzd` / `ink`: `18T WK`

### Lower collar (y 8.72 → 10.72, x 0.38 → 8.12)

Height **2.00"** (PM lock). Fill `collar`. 0.75 pt `ink` rule on the neatline; 0.35 pt rule at y 10.72.
Internal pad 0.08". Four columns, 0.08" gutters, 0.35 pt vertical rules. USGS habit: title+spec · scale/north · legend · printed/sheet.

| Col | x range (in) | Width | Content |
|---|---|---|---|
| A Ident | 0.38 – 3.08 | 2.70" | Title + series + product + spec column |
| B Scale | 3.16 – 5.16 | 2.00" | North arrow + scale bar |
| C Legend | 5.24 – 6.74 | 1.50" | Legend (layers on the sheet only) |
| D Meta | 6.82 – 8.12 | 1.30" | Printed + Sheet |

Neatline bottom stays **2.28"** (y = 8.72). Map size unchanged. Disclaimer/attribution sit *under* this 2.00" collar, not inside it. **Legal never goes in Col A–D.** The long disclaimer is footer-only, 6 pt, with attribution.

#### Col A — Title + spec

```
{print.title}              12 pt Condensed Bold   e.g. Arlington VA
                           or 18T WK 871 041 if no place
                           max 28 chars, truncate, no wrap
{print.series}             7.5 pt Sans            Topographic
{print.subtitle}           7 pt Sans, ink-muted   MGRS Viewer

Scale            1:24 000        7 pt  label ink-muted, value Mono
Grid             MGRS
Grid interval    1 km            hide row if floor(zoom) ≤ 7
Datum            WGS 84
Projection       UTM
Contour interval {n}             hide row if unknown
```

Spec rows 0.16" each, label 0.95" wide, value the rest. Keys: `print.scale`, `print.grid`, `print.gridInterval`, `print.datum`, `print.projection`, `print.contour`.
Grid-interval display strings (not `1000 m`): `10 km` / `1 km` / `100 m` from the printed RF principal. No `10 m`.

#### Col B — North + scale bar

- Section label `print.north` "North" 7.5 pt Sans Bold.
- Arrow 0.42" tall, filled spear, centered under the label.
- Caption `print.trueNorth` "True north" 6.5 pt, under the arrow. No magnetic / declination.
- Scale bar below, max width **1.84"**, height 0.10", 4–5 segments alternating `ink` / `paper`.
  - Metres / kilometres only.
  - Nice total (1, 2, 5 × 10^n m) fills 60–95% of the bar.
  - End labels 7 pt Mono. Zero at left.
- RF is *not* repeated here; it lives in Col A as `print.scale`.

RF formula (Frontend):

```
groundWidthMeters = mapFrameGroundWidth
rf = groundWidthMeters / (7.74 * 0.0254)
display as 1:{roundToNice(rf)}
```

`roundToNice`: nearest of 1 000, 1 250, 1 500, 2 000, 2 500, 3 000, 4 000, 5 000, 6 000, 7 500, 8 000, 10 000, 12 000, 15 000, 20 000, 24 000, 25 000, 30 000, 40 000, 50 000, 62 500, 75 000, 100 000. Thin space in the number (`1:24 000`).

#### Col C — Legend

Heading `print.legend` "Legend" 7.5 pt Sans Bold.
Rows 0.20", 7 pt Sans, swatch 0.22" × 0.09". Show **only layers on the sheet**.

| Key | Swatch | Copy |
|---|---|---|
| `print.legend.roads` | 1.15 pt `road` | Roads |
| `print.legend.water` | 1.0 pt `hydro` | Water |
| `print.legend.contours` | 1.15 pt `contour-index` over 0.50 pt `contour-int` | Contours |
| `print.legend.grid` | 0.90 pt `ink` + 1.50 pt `gzd` tick | MGRS grid |
| `print.legend.places` | 6 pt Sans Bold sample | Places |
| `print.legend.relief` | 0.22×0.09 fill `veg` @ 40% | Relief |

OpenTopoMap v1 shows all six. If a layer is off, drop the row and close the gap.

#### Col D — Printed + Sheet

Far-right stack, 7 pt. Label `ink-muted` on its own line, value `ink` under it.

```
Printed                 print.printed
15 Aug 2026             local date, no clock

Sheet                   print.sheet / print.sheetValue
8.5 × 11 in             one line, no wrap (PM lock)
```

`print.sheetValue` is `8.5 × 11 in`. Do not restore `US Letter 8.5 × 11 in`.

### Footer (y 10.76 → 10.94)

Two 6 pt lines, `ink-muted`, x 0.38–8.12, leading 1.15. Last and smallest.

1. `print.disclaimer` — "Not an official USGS or military product. Verify in the field. Do not use as the sole navigation source."
2. Attribution + `Not a USGS map.`
   - OpenTopoMap: "Map data © OpenStreetMap contributors, SRTM. Style © OpenTopoMap (CC-BY-SA). Not a USGS map."
   - OSM fallback: "Map data © OpenStreetMap contributors. Not a USGS map."

Full disclaimer fits one 6 pt line on 7.74". Tight fallback (`Not official. Verify in the field.`) is unused.

Print filename (browser dialog / save-as): `mgrs-viewer-{mgrs}-{yyyy-mm-dd}` compact uppercase MGRS, local date. Fallback `mgrs-viewer-frame-{yyyy-mm-dd}`. Set `document.title` to that basename for `window.print()`.

### Print CSS notes

- Clip map + overlay to neatline (`overflow: hidden`).
- Embed the three Plex files; do not fall back to Arial on print if it can be avoided.
- Color adjust: `print-color-adjust: exact` on the sheet.
- One sheet, no bleed, no crop marks v1.

---

## 3. Web UI

Utilitarian field tool. Chrome is thin; the map is the product. No pills, no glass, no drop shadows except the readout (0 1px 2px rgba(28,25,20,0.18)). Radius 2 px max.

### Layout (1440x900 reference)

```
+----------------------------------------------------------------+
| TOOLBAR 48px  chrome                                           |
|  search (flex 1)                                 [ Print ]     |
+----------------------------------------------------------------+
| MAP  (100% remaining)                                          |
|                                                                |
|  print-frame overlay = exact neatline aspect 7.74:8.14         |
|  centered, max size that fits with 24px inset from chrome      |
|  and from zoom/readout                                         |
|                                                                |
|  [+]  bottom-left, 16px inset                                  |
|  [-]                                                           |
|                                         readout  bottom-right  |
|                                         16px inset             |
+----------------------------------------------------------------+
```

Toolbar 48 px, `chrome`. Horizontal pad 12 px. Gap 12 px.

**Search**
- Height 32 px, fill `chrome-inset`, 1 px `ink` @ 35%, radius 2.
- Text `paper` 14 / 400. Placeholder `paper` @ 45%: `search.placeholder` "Grid or place". Helper `search.helper` "MGRS, lat/long, or a place name".
- Accepts: geocoder place string, MGRS (`18S WJ 12345 67890` or packed), decimal lat lon, DDM.
- No icon required; a 14 px magnifier in `paper` @ 50% on the left is ok if it stays inside the 32 px field.

**Print**
- 32 × 88 px (or hug + 16 px pad). Fill `paper`, text `ink` 13 / 600, radius 2.
- Label `chrome.print` "Print". Title `chrome.printTitle` "Print this frame (US Letter)".
- Action: open browser print of the **print sheet** (not the raw viewport). The dashed frame on screen *is* the map that lands inside the neatline.

**Zoom**
- Two 36×36 buttons, stacked, 2 px gap, fill `chrome`, glyph `paper`, 1 px `ink` @ 40%.
- No rotate-north control v1 (north is always up / Web Mercator).

**Readout card** (bottom-right)
- Fill `paper`, 1 px `ink`, radius 2, pad 8×10.
- Width hug, min 168 px.
- Lines, Mono 13, `ink`:
  1. RF `1:24 000` (live with zoom)
  2. `z{n}` + thin space + current principal grid (`1 km` / `100 m` / …)
  3. `chrome.mgrsLabel` + live MGRS of frame center, spaced, precision from §4 band: `MGRS  18T WK 8712 0415`
- Scale bar under the type, 120–148 px wide, same construction as print (metres).

**Print frame overlay**
- Rectangle, aspect **7.74 : 8.14** (≈ 0.951), centered in the remaining map.
- Stroke 1 px dashed `4 3`, `ink` @ 55%. No fill (or `ink` @ 4% if tiles wash out).
- Pan/zoom move the *map under a fixed frame* (frame is viewport-fixed). This matches "adjust the view frame, then print that frame."
- Do not draw MGRS edge labels on the web frame; those belong on the print neatline. Web grid labels float on the map (see §4).

**What is out**
- Hamburger, account, layers panel, basemap switcher, 3D, measure tool, drawing. v1 is search + frame + print.

---

## 4. MGRS overlay

Always-on in v1. No lat/lon graticule.

### Hierarchy (coarse → fine)

| Level | Spacing | Color | Screen width | Print width |
|---|---|---|---|---|
| GZD | 6° × 8° | `gzd` | 2.5 px @ 0.85 | 1.50 pt |
| 100 km | 100 000 m | `ink` | 1.5 px @ 0.75 | 0.90 pt |
| 10 km | 10 000 m | `ink` | 0.9 px @ 0.40 | 0.45 pt |
| 1 km | 1 000 m | `ink` | 0.6 px @ 0.40 | 0.40 pt |
| 100 m | 100 m | `ink` | 0.4 px @ 0.28 | 0.25 pt @ 40% |

Line cap `butt`, join `miter`. No fill.

### Screen visibility (Leaflet/MapLibre-style integer zoom, Web Mercator)

| `floor(zoom)` | Draw | Live MGRS (copy precision) | Convert precision |
|---|---|---|---|
| 0–7 | **GZD only** (PM lock: GZD at low zoom) | hide readout | — |
| 8–10 | + 100 km | `18T WK 87 04` | 1 |
| 11–12 | + 10 km | `18T WK 87 04` | 1 |
| 13–14 | + 1 km | `18T WK 871 041` | 2 |
| 15–16 | + 100 m (label every 5th) | `18T WK 8712 0415` | 3 |
| 17–22 | 100 m principal. **No 10 m grid** (PM lock) | `18T WK 8712 0415` | 3 |

GZD lines stay visible at every zoom.

### Print visibility (by RF — PM lock; not screen zoom)

| RF | Principal | Also draw | `print.gridInterval` |
|---|---|---|---|
| ≥ 1:75 000 | 10 km | GZD, 100 km | `10 km` |
| 1:25 000 – 1:74 999 | 1 km | GZD, 100 km | `1 km` |
| ≤ 1:24 999 | 100 m | GZD, 100 km, 1 km | `100 m` |

No 10 m interval on the sheet. Copy v1.3 `10 m` band is unused.

### Label grammar

- GZD: `18S` (zone + band)
- 100 km: `WJ` (two letters only; GZD is not repeated on every square)
- 1 km easting/northing: last **2** digits of the km (e.g. `23` / `56`). Full `123` / `4567` on the *first* labeled line of each 10 km block (the "principal digit" convention on USGS/USNG sheets).
- 100 m: last **3** digits of the 100 m easting/northing (`235` / `567`), and only every 5th line.
- Center MGRS (readout + title): spaced, precision from the zoom band (examples in the table). Compact form is for filenames only (`18TWK87120415`).

Halo: 2 px `paper` @ 80% (or equivalent CSS `text-shadow` / stroke). Required so labels read on green woodland and brown contour.

Collision: label a line only if it intersects the view. Prefer top + left edges. Skip a label rather than overlap. Never draw a spaghetti of unlabelled fine lines — if a level would put lines closer than **24 CSS px**, do not draw that level.

### Special

- Polar UPS: out of scope v1. If the frame center is outside 80°S–84°N, hide grid and show `lbl.gridUnavailable` "MGRS grid unavailable at this latitude."
- Norway / Svalbard special UTM zones: implement if the grid library handles them; do not fake 6° cells there.

---

## 5. Visual states (measured)

Same language as the chrome: `paper` / `ink` / `gzd`, 2 px radius, no toast, no modal, no illustration. Copy from `strings.json` only.

### 5.1 No WebGL — `chrome.noWebGL`

Full viewport. Hide toolbar, search, Print, zoom, readout, print-frame.

- Fill: `paper`
- Centered stack, max-width 320 px
- Mark: favicon grid, 48×48, 16 px above the line, opacity 1
- Type: 15 / 400 Sans, `ink`, center, line-height 1.3
- No retry, no “try Chrome,” no download link

### 5.2 Tiles failed — `chrome.tilesFailed` + `chrome.retry`

Toolbar stays. Print frame stays.

- If no tile has ever painted: map well fill `collar`
- Strip under toolbar: height **36 px**, full width, fill `collar`, 1 px bottom `ink` @ 20%
- Text: 13 / 400 Sans, `ink`, left pad 12 px, vertically centered
- `chrome.retry`: right, 12 px inset, 28×64, 2 px radius, 1 px `ink`, `paper` fill, 12 / 600
- Strip does not persist after a successful retry. Quiet `chrome.tiles.*` status is not this strip.

### 5.3 Search miss — 3.0 s helper

Does **not** push the map. Overlay, not layout.

- Field outline: 1 px `gzd` for 3000 ms, then back to `ink` @ 35%
- Helper: 12 / 400 Sans, `gzd`, line-height 18 px
- Position: `top: 52 px` (48 toolbar + 4), `left` = search field left, `width` = search field width
- Height 18 px. No background, no icon, no close
- Visible 3000 ms, fade 150 ms (`opacity 1 → 0`)
- String: the matching `search.error.*` key (empty / unrecognized / unrecognizedQuery / noPlace / failed / offline). Not a generic “No match.”
- Ambiguous (`search.error.ambiguous`): helper stays until a result is picked; list is a 1 px `ink` paper panel, 4 px under the helper, max-height 240 px, row height 32 px

### 5.4 Polar / grid unavailable

Frame center outside 80°S–84°N (UPS out of scope).

- Tiles stay. Print frame stays. Scale stays.
- Hide MGRS overlay (all levels)
- Hide live MGRS line in the readout
- Hide `print.gridInterval` (and the Grid row if there is no grid to spec)
- Readout: the MGRS line is replaced by one 13 / 400 Sans line, `ink-muted`, same card padding. Key `lbl.gridUnavailable` or `chrome.gridUnavailable` (same sentence in strings.json): “MGRS grid unavailable at this latitude.”
- Print sheet: `lbl.gridUnavailable` as a 7 pt `ink-muted` line under the spec column, or omit the Grid block
- No toast, no banner, no blocking Print

### 5.5 Other interaction

- First load: CONUS-ish default (e.g. 39.8 N, 77.2 W, z 12). `chrome.empty` if you need a pre-search hint.
- Print with no frame: disable Print if you can; else `print.guard.noFrame`. No dialog.
- Keyboard: Enter submits, Esc clears. `+`/`-` zoom. No cheatsheet.

---

## 6. Copy keys (locked)

Import `/workspace/mgrs-map-viewer/strings.json`. Do not scrape the markdown. Product name is **MGRS Viewer** (formal/project: MGRS Map Viewer).

Print title block:
`print.series` Topographic · `print.title` (value only) · `print.subtitle` MGRS Viewer
`print.scale` Scale / `1:{n}` · `print.grid` Grid / MGRS · `print.gridInterval` / `10 km`|`1 km`|`100 m` (no `10 m`)
`print.datum` Datum / WGS 84 · `print.projection` Projection / UTM · `print.contour` hide if unknown
`print.printed` Printed / local date · `print.sheet` Sheet / US Letter 8.5 × 11 in
North: `print.north` North · `print.trueNorth` True north
Legend: `print.legend` + `.roads` `.water` `.contours` `.grid` `.places` `.relief`
`print.disclaimer` full line (tight fallback unused)
Attribution: OpenTopoMap preferred line + "Not a USGS map."

Web: `app.name` MGRS Viewer · `search.placeholder` Grid or place · `chrome.print` Print · `chrome.scale` `1:{n}` · `chrome.mgrsLabel` MGRS

## 8. Favicon / app icon

Utilitarian. Ink on paper. No cute mark, no pin, no mountain, no wordmark.

- Field: `paper` `#F4EFE4` edge to edge (no iOS squircle in the asset)
- Neatline: `ink` square, inset 14%
- Inner: 3×3 grid, half the neatline weight
- One `gzd` vertical on the left inner edge
- No type at 16/32. The detailed lockup (with ticks) is the 512/1024 app icon only

Files in `/workspace/mgrs-map-viewer/design/icon/`:

| File | Size | Use |
|---|---|---|
| `favicon-16.png` | 16 | tab |
| `favicon-32.png` | 32 | tab @2x |
| `apple-touch-180.png` | 180 | apple-touch-icon |
| `app-icon-512.png` | 512 | PWA / manifest |
| `app-icon-source.png` | 1024 | source |

`<link rel="icon" href="/favicon-32.png" sizes="32x32">` plus 16. Theme color `chrome` `#2B2924`.

---

## 7. What Frontend can ignore

- Magnetic declination
- Adjoining-quad diagram
- USGS / DOI logos (we are not a USGS product)
- Layers UI, basemap picker
- 10 m grid (PM lock)
- Auth, save, share, welcome marketing
