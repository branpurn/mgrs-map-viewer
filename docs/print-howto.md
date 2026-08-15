# Print the sheet

Field use. No account. No wizard.

## Set the frame

1. Search a grid or place (`18T WK 8712 0415`, `38.889, -77.035`, or a name).
2. The dashed rectangle is US Letter, portrait. It does not move.
3. Pan and zoom the map under that frame until the ground you want is inside it.
4. Print. The browser print dialog is the sheet. Default name follows `mgrs-viewer-{mgrs}-{yyyy-mm-dd}`.

Print still makes the US Letter sheet when Sheet is Off.

Empty or ocean frames still print. The title is UNTITLED SHEET.

`P` prints. `+` / `-` zoom. `/` focuses search.

## What lands on the page

US Letter, 8.5 × 11 in, portrait. USGS-style collar, not a screenshot of the toolbar.

- Map inside a neatline, MGRS overlay frozen at the print scale
- Upper collar: MGRS MAP VIEWER, sheet title, date
- Lower collar: feature legend, north (true north only), metric scale bar, RF, MGRS grid legend, title block
- Footer: attribution (OSM / OpenTopoMap credit, copyright URLs, not a USGS map, not for navigation)

Grid interval on the sheet follows RF: 10 km, 1 km, or 100 m. No 10 m grid.

## Limits

- Not an official USGS or military product. Verify in the field.
- Polar / UPS (frame center outside 80°S–84°N): no grid, no live MGRS.
- Needs a current browser with WebGL.
- One sheet. No landscape, no bleed, no crop marks.
