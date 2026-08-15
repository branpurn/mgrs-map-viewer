MGRS Viewer is a browser tool for field and planning work.

Search a Military Grid Reference, lat/long, or a place name. The map
shows an MGRS grid over topographic tiles. Set the frame, then print
a US Letter (8.5 x 11 in) sheet with scale, grid spec, and a title block.

No account. Scale follows zoom. Tiles are OpenTopoMap, with OpenStreetMap
as fallback. Not an official USGS or military product. Verify in the field.

## Run

Install dependencies, then start the dev server on port 5173:

    npm install
    npm run dev

Dev server: http://localhost:5173 (bound to 0.0.0.0).

    npm run build
    npm run preview

## Place search and convert

Copy env.example to a local env file. Set VITE_API_BASE if a backend is available.

When set, the viewer calls:

- GET {base}/api/search?q= for place names that are not coordinates
- GET {base}/api/convert?lat=&lon=&precision= on moveend

Leave it empty to stay local-only. MGRS and decimal lat/long still parse in the browser.
Place names are not geocoded without the API.

## Stack

- Vite + vanilla HTML / JS / CSS
- MapLibre GL JS
- mgrs (local forward / toPoint)
- OpenTopoMap raster tiles
- OpenStreetMap fallback

No auth. Package name: mgrs-map-viewer.
