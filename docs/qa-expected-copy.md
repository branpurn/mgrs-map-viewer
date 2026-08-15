# QA — expected copy

Source: strings.json. No new product copy. Fail if the UI shows different words.

## Sheet toggle

Toolbar label is **Sheet**. On is the Letter sheet. Off is the full map. Default On.

Print is still US Letter (8.5 × 11 in) either way. Print must stay **one tab**. Fail if Print opens a second MGRS Viewer tab.

Collar: **WGS 84**, **GRID ZONE**, **MGRS**, true north. Sheet row still **Sheet**. Fail USNG, NAD 83, or a G–M rose.

Fail: WYSIWYG On, WGS 84, a raw key on screen. Zoom + flips Sheet Off.

## Search

| When | Key | Expected |
|---|---|---|
| Placeholder | ph.search / search.placeholder | Grid or place |
| Empty submit | search.error.empty | Enter a grid, coordinates, or place name. |
| Bad coordinates | search.error.unrecognized | Unrecognized coordinates. |
| Unrecognized query | search.error.unrecognizedQuery | Unrecognized query. |
| No place (also empty 200) | search.error.noPlace / lbl.searchMiss | No place found for “{q}”. |
| Several matches | search.error.ambiguous | Several matches for “{q}”. Select one. |
| 502 / upstream | search.error.failed | Search failed. Try again. |
| Offline | search.error.offline | Search needs a connection. |

## Chrome

| When | Key | Expected |
|---|---|---|
| No WebGL | chrome.noWebGL | This browser cannot draw the map. |
| Polar / UPS | chrome.gridUnavailable / lbl.gridUnavailable | MGRS grid unavailable at this latitude. |
| Print button | lbl.print / chrome.print | Print |
| Preparing | chrome.printing | Preparing sheet… |
| Toolbar switch | chrome.sheet | Sheet |
| Switch on | chrome.wysiwygOn | On |
| Switch off | chrome.wysiwygOff | Off |

Visible toolbar label is **Sheet**, left of Print. On is the Letter sheet. Off is the full map. Default On. Print is still Letter either way. Fail if it says WYSIWYG On, or a raw key.

## Collar (print sheet)

Sheet row is still **Sheet**. DATUM is **WGS 84**. SCALE, GRID (MGRS), GRID ZONE, and the grid interval must be filled. Projection is `UTM {zone}{N|S}` for the frame. EXAMPLE is the current place + current center MGRS, or hidden if polar. North is **True north** only.

Fail: NAD 83. USNG. G–M rose. `9° 30′ W` on a non-DC sheet. Hardcoded Jefferson Pier on a non-DC sheet. Blank DATUM, SCALE, or GRID. Any raw key on screen.

Footer is two 6 pt lines: full `print.disclaimer`, then OTM/OSM attribution + `Not a USGS map.`

## North

True north arrow + **True north**. No magnetic / grid-north fork.

Fail: G–M diagram. Locked `9° 30′ W` / `convergence 1° 17′` as required copy. `0°38′W`.

## RF

First-load Jefferson Pier: sheet and HUD both **1:24 000**.

Fail: first-load RF ≠ HUD. Print → Cancel leaves the live collar at **1:12 000**. A 1:12 000 print capture. Print preview is a blank tan sheet with no collar.

## Print sheet

| When | Key | Expected |
|---|---|---|
| Empty / ocean frame | lbl.untitled | UNTITLED SHEET |
| Product (upper collar) | lbl.product | MGRS MAP VIEWER |
| Product line | app.name / print.subtitle | MGRS Viewer |
| Sheet size | print.sheetValue | 8.5 × 11 in |
| OpenTopoMap footer | lbl.attribution | Map data © OpenStreetMap contributors https://www.openstreetmap.org/copyright, SRTM. Style © OpenTopoMap (CC-BY-SA) opentopomap.org. Not a USGS map. Not for navigation. |
| OSM fallback footer | lbl.attributionOsm | Map data © OpenStreetMap contributors https://www.openstreetmap.org/copyright. Not a USGS map. Not for navigation. |

Attribution must include both URLs on the OpenTopoMap line, and the OSM copyright URL on the fallback line. If the 6 pt strip is tight, URLs stay; other words get cut first.

## Title length

lbl.sheetTitle is 12 pt Condensed Bold CAPS in a 2.18 in ident column. **~28 characters max.** Longer names truncate. Do not wrap.

Pass: `PINE RIDGE, VA` (14). Fail if a longer place name wraps or overflows the ident column.

Title must not sit on the map face. Fail: a tile sliver above the title. Bottom tick labels must be present.

## Date and corner grid

Printed year is **2026**. Fail: **2024**.

**18S UJ** on the corners only. Fail: extra center 18S UJ.
