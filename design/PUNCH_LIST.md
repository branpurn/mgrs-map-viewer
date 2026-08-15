# Punch list — 127.0.0.1:5173 vs DESIGN_SPEC.md
Reviewed from live HTML/CSS/JS on the shared machine, 2026-08-15. Spec wins.

## P0 — Print sheet (blocks a real USGS-style page)

1. **Collar is still the 1.1in stub.** `print.css` locks `.print-footer` at `flex: 0 0 1.1in`. Spec: **2.00in** lower collar (y 8.72–10.72) + footer under it (y 10.76–10.94).
2. **`@page { margin: 0.4in }`.** Spec: `margin: 0`. Insets are the neatline (L/R 0.38, top 0.58, bottom 2.28), not the browser margin.
3. **No neatline.** Map is a 9.1 × 7.7in flex child on `#fff`. Spec: 7.74 × 8.14in frame, 1.25pt `ink` square, paper `#F4EFE4`.
4. **No upper collar.** Spec: 0.33in bar, `MGRS Viewer` left, `print.title` right.
5. **Print grid is the screen overlay, not RF.** Spec lock: print lines by RF (≥75k → 10 km, 25–75k → 1 km, ≤25k → 100 m). Freeze that at Print.
6. **No print scale bar.** RF sits in Col A; Col B still needs the 1.84in metric bar + North / True north (not only an “N” glyph).
7. **Legend incomplete.** Has MGRS grid, Contours, Relief. Missing Roads, Water, Places (only drop a row if that layer is off).
8. **Sheet value** `US Letter 8.5 × 11 in` must wrap after “Letter” in the 1.30in Col D. Do not cut the string.

## P1 — Web chrome

9. **Toolbar taller than 48px.** `height: auto; min-height: 48px` plus brand, tagline, always-on helper. Spec: **48px** charcoal, search + Print only.
10. **Tagline in the header.** Out. Identity is the title and the grid spec, not a slogan on chrome.
11. **Extra Search submit.** Spec is the field (Enter submits). Clear-on-Esc can stay as an icon/control inside the 32px field.
12. **Helper is a second toolbar row.** Spec §5.3: overlay at `top: 52px`, width of the field, 18px, `gzd`, 3.0s + 150ms fade, **no layout shift**. Idle helper copy is not a chrome row.
13. **Search error color** `#e8b4b4`. Use `gzd` `#8B1E1E` on the 1px field outline and the helper.
14. **Focus gold** `--focus: #c4a35a`. Not a token. Focus = `ink` or `paper` @ 100%, 1px.
15. **Crosshair.** Not in spec. Remove.
16. **No favicon.** Drop in `design/icon/favicon-16.png` + `favicon-32.png` (+ 180/512). Theme color `#2B2924`.

## P2 — Readout + states

17. **Readout is label chips, not the spec stack.** Spec: Mono 13, `1:24 000` / `z{n}` + principal / `MGRS  18T WK 8712 0415` / scale bar 120–148px. “Scale” and “MGRS” are aria, not uppercase chips. Tile-source line can stay at 10px muted.
18. **Tiles-failed is a centered card.** Spec §5.2: 36px `collar` strip under the toolbar, retry 28×64 right.
19. **No-WebGL** is 14px centered text only. Spec §5.1: hide all chrome, 48px icon mark, 15px `ink`, max-width 320.
20. **Polar.** Hide overlay + live MGRS. Swap the MGRS line for **`lbl.gridUnavailable`** (`MGRS grid unavailable at this latitude.`). Do not wait on a `chrome.*` alias.

## P3 — Grid

21. **z 0–7 draws 100 km UTM lines.** Spec lock: **GZD only** at low zoom. `intervalForZoom(z<8)` currently returns 100 km and `buildGridGeoJSON` still emits those lines.
22. **GZD stroke 1.6px.** Spec: 2.5px @ 0.85.
23. **Grid labels are Open Sans** (MapLibre default). Spec: IBM Plex Mono + 2px `paper` halo. If the style glyphs don’t include Plex, add them or live with a stacked canvas label — don’t silently stay on Open Sans as the intended face.
24. **1 km band is z 11–13 in code, z 13–14 in spec.** Align to spec: 11–12 = 10 km, 13–14 = 1 km, 15–16 = 100 m, 17+ = 100 m (no 10 m). Good: no 10 m, ink + gzd (not blue).

## Matches (do not churn)

- CSS tokens `paper / collar / ink / chrome / gzd` are correct
- IBM Plex Sans / Condensed / Mono linked
- Print button 32×88, `paper` on `chrome`, 2px radius
- Search placeholder `Grid or place`
- Print-frame `aspect-ratio: 7.74 / 8.14` (keep; only the 72px top offset should follow the 48px toolbar)
- Zoom 36×36, bottom-left 16px, chrome fill
- HUD paper, 1px ink, 2px radius, 16px inset, allowed shadow
- Filename `mgrs-viewer-{mgrs}-{yyyy-mm-dd}`
- Copy pulled from strings.json for the strings that exist
- No 10 m grid, grid is not cyan/blue
