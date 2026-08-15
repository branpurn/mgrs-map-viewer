/** Locked copy-sheet keys. Field / planning tone. */

export const COPY = {
  'app.name': 'MGRS Viewer',
  'app.nameFormal': 'MGRS Map Viewer',
  'app.tagline': 'Search a grid or place. Print the sheet.',
  'app.documentTitle': 'MGRS Viewer',

  'search.placeholder': 'Grid or place',
  'search.helper': 'MGRS, lat/long, or a place name',
  'search.ariaLabel': 'Search by grid, coordinates, or place',
  'search.submit': 'Search',
  'search.clear': 'Clear',
  'search.hint': 'Examples: 18T WK 8712 0415 · 38.889, -77.035 · Arlington VA',
  'search.matches': 'Matches',
  'search.matchesTooMany': 'Showing the first {n} matches.',
  'search.shortcutLine': 'Enter search · Esc clear',
  'search.ariaSubmit': 'Search. Enter to submit.',
  'search.ariaClear': 'Clear search. Escape to clear.',
  'search.formats.heading': 'Formats',
  'search.formats.mgrs100': '100 m · 18T WK 8712 0415',
  'search.formats.mgrs1k': '1 km · 18T WK 871 041',
  'search.formats.mgrs10k': '10 km · 18T WK 87 04',
  'search.formats.decimal': 'Lat, long · 38.889, -77.035',
  'search.formats.dms': 'DMS · 38°53′20″N 77°02′06″W',
  'search.formats.place': 'Place · Arlington VA',
  'search.needsApi': 'Place search needs the API.',

  'search.error.empty': 'Enter a grid, coordinates, or place name.',
  'search.error.unrecognized': 'Unrecognized coordinates.',
  'search.error.unrecognizedHint': 'Use MGRS (18T WK 8712 0415) or decimal lat, long.',
  'search.error.unrecognizedQuery': 'Unrecognized query.',
  'search.error.noPlace': 'No place found for “{q}”.',
  'search.error.ambiguous': 'Several matches for “{q}”. Select one.',
  'search.error.failed': 'Search failed. Try again.',
  'search.error.offline': 'Search needs a connection.',

  'chrome.print': 'Print',
  'chrome.printTitle': 'Print this frame (US Letter)',
  'chrome.printing': 'Preparing sheet…',
  'chrome.printBlocked': 'Allow printing in the browser, then try again.',
  'chrome.scale': '1:{n}',
  'chrome.scaleLabel': 'Scale',
  'chrome.empty': 'Search a grid or place to set the frame.',
  'chrome.loading': 'Loading map…',
  'chrome.loadingTiles': 'Loading tiles…',
  'chrome.tilesFailed': 'Map tiles failed to load.',
  'chrome.retry': 'Retry',
  'chrome.mgrsLabel': 'MGRS',
  'chrome.mgrs': '{mgrs}',
  'chrome.mgrsAria': 'MGRS at frame center',
  'chrome.tiles.opentopomap': 'Using OpenTopoMap tiles',
  'chrome.tiles.osm': 'Using OpenStreetMap tiles',
  'chrome.tiles.switchedOsm': 'Using OpenStreetMap tiles',
  'chrome.tiles.switchedTopo': 'Using OpenTopoMap tiles',

  'print.series': 'Topographic',
  'print.subtitle': 'MGRS Viewer',
  'print.scale': 'Scale',
  'print.grid': 'Grid',
  'print.gridInterval': 'Grid interval',
  'print.gridIntervalValue': '{n} m',
  'print.datum': 'Datum',
  'print.datumValue': 'WGS 84',
  'print.projection': 'Projection',
  'print.projectionValue': 'UTM',
  'print.printed': 'Printed',
  'print.sheet': 'Sheet',
  'print.sheetValue': 'US Letter 8.5 × 11 in',
  'print.north': 'North',
  'print.trueNorth': 'True north',
  'print.legend': 'Legend',
  'print.legend.roads': 'Roads',
  'print.legend.water': 'Water',
  'print.legend.contours': 'Contours',
  'print.legend.grid': 'MGRS grid',
  'print.legend.places': 'Places',
  'print.legend.relief': 'Relief',
  'print.disclaimer':
    'Not an official USGS or military product. Verify in the field. Do not use as the sole navigation source.',
  'print.disclaimerShort': 'Not official. Verify in the field.',
  'print.attr.otm':
    'Map data © OpenStreetMap contributors, SRTM. Style © OpenTopoMap (CC-BY-SA). Not a USGS map.',
  'print.attr.osm': 'Map data © OpenStreetMap contributors. Not a USGS map.',
  'print.filename': 'mgrs-viewer-{mgrs}-{yyyy-mm-dd}',
  'print.filenameFallback': 'mgrs-viewer-frame-{yyyy-mm-dd}',
  'print.saveAs': 'Save as {filename}',
  'print.downloading': 'Downloading {filename}',
};

/**
 * Replace `{name}` tokens in a template.
 * @param {string} template
 * @param {Record<string, string|number>} [vars]
 */
export function fmt(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

export default COPY;
