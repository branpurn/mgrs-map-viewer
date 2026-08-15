# QA — expected copy

Source: strings.json. No new product copy. Fail if the UI shows different words.

## This pass

Toolbar: **Sheet**, **On** / **Off**. Default On. Fail if the control says WYSIWYG On, or a raw key.

Print is still US Letter (8.5 × 11 in) either way.

Collar sheet row: still **Sheet**. Unchanged. Size still 8.5 × 11 in.

DATUM is **NAD 83**. Fail: WGS 84. Any raw key on screen.

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

Visible toolbar label is **Sheet**, left of Print. Switch reads **On** / **Off**. Default On. Print is still Letter either way. Fail if it says WYSIWYG On, or a raw key.

## Collar (print sheet)

Sheet row is still **Sheet**. Unchanged. DATUM is **NAD 83**. SCALE, GRID ZONE, EXAMPLE, and the grid interval must be filled. Legend rows have labels. Footer is one line: `MGRS Viewer · Not a USGS map.`

Fail: WGS 84. Blank DATUM, SCALE, or GRID. Unlabeled legend. Footer split (product in the collar, “Not a USGS map.” only on attribution). Any raw key on screen.

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
