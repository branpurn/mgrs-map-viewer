# QA — expected copy

Source: strings.json. No new product copy. Fail if the UI shows different words.

## Sheet toggle

Toolbar label is **Sheet**. On is the Letter sheet. Off is the full map. Default On.

Print is still US Letter (8.5 × 11 in) either way.

Collar unchanged: **NAD 83**, **GRID ZONE**, **G–M**. Sheet row still **Sheet**.

Fail: WYSIWYG On, WGS 84, a raw key on screen.

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

Sheet row is still **Sheet**. Unchanged. DATUM is **NAD 83**. SCALE, GRID ZONE, EXAMPLE, and the grid interval must be filled. Legend heading is **Legend**. Legend rows have labels. Legend heading must be the resolved string; fail on raw print.legend. Footer is one line: `MGRS Viewer · Not a USGS map.`

Fail: WGS 84. Blank DATUM, SCALE, or GRID. Legend heading missing or the raw key. Unlabeled legend. Footer split (product in the collar, “Not a USGS map.” only on attribution). Any raw key on screen.

## G–M

On the DC / 18S UJ sheet: **G–M 9° 30′ W** and **convergence 1° 17′**.

Fail: garbled `0.4° 7' 93' W`. Truncated G–M. Missing convergence.

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
