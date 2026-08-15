import { forward } from 'mgrs';

/**
 * Viewport MGRS graticule as a MapLibre GeoJSON source + line/symbol layers.
 * Lines are true UTM easting/northing (not lat/lon boxes). Density steps
 * 100 km → 10 km → 1 km → 100 m with zoom. Only the padded viewport is drawn.
 */

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const E4 = E2 * E2;
const E6 = E4 * E2;
const M1 = 1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256;
const M2 = 3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024;
const M3 = 15 * E4 / 256 + 45 * E6 / 1024;
const M4 = 35 * E6 / 3072;

const SOURCE_ID = 'mgrs-grid';
const LINE_LAYER = 'mgrs-grid-lines';
const LABEL_LAYER = 'mgrs-grid-labels';
const GZD_LINE_LAYER = 'mgrs-gzd-lines';
const GZD_LABEL_LAYER = 'mgrs-gzd-labels';

const BANDS = 'CDEFGHJKLMNPQRSTUVWX';

export function utmZone(lon) {
  let z = Math.floor((lon + 180) / 6) + 1;
  if (z < 1) z = 1;
  if (z > 60) z = 60;
  return z;
}

function zoneLon0(zone) {
  return ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
}

export function zoneLonRange(zone) {
  const min = (zone - 1) * 6 - 180;
  return [min, min + 6];
}

export function latLonToUtm(lon, lat, zone) {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  const λ0 = zoneLon0(zone);
  const sinφ = Math.sin(φ);
  const cosφ = Math.cos(φ);
  const tanφ = Math.tan(φ);
  const N = A / Math.sqrt(1 - E2 * sinφ * sinφ);
  const T = tanφ * tanφ;
  const C = EP2 * cosφ * cosφ;
  const AA = cosφ * (λ - λ0);
  const M =
    A *
    (M1 * φ - M2 * Math.sin(2 * φ) + M3 * Math.sin(4 * φ) - M4 * Math.sin(6 * φ));
  const easting =
    K0 *
      N *
      (AA +
        ((1 - T + C) * AA ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * AA ** 5) / 120) +
    500000;
  let northing =
    K0 *
    (M +
      N *
        tanφ *
        (AA ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C * C) * AA ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * AA ** 6) / 720));
  if (lat < 0) northing += 10000000;
  return { easting, northing, zone, north: lat >= 0 };
}

export function utmToLatLon(zone, easting, northing, north) {
  const x = easting - 500000;
  let y = northing;
  if (!north) y -= 10000000;
  const λ0 = zoneLon0(zone);
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const μ = y / K0 / (A * M1);
  const φ1 =
    μ +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * μ) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * μ) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * μ) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * μ);
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const tanφ1 = Math.tan(φ1);
  const N1 = A / Math.sqrt(1 - E2 * sinφ1 * sinφ1);
  const T1 = tanφ1 * tanφ1;
  const C1 = EP2 * cosφ1 * cosφ1;
  const R1 = (A * (1 - E2)) / (1 - E2 * sinφ1 * sinφ1) ** 1.5;
  const D = x / (N1 * K0);
  const φ =
    φ1 -
    ((N1 * tanφ1) / R1) *
      (D * D / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) *
          D ** 6) /
          720);
  const λ =
    λ0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) /
        120) /
      cosφ1;
  return { lon: (λ * 180) / Math.PI, lat: (φ * 180) / Math.PI };
}

export function latToBand(lat) {
  if (lat < -80 || lat >= 84) return lat >= 84 ? 'X' : null;
  if (lat >= 72) return 'X';
  const idx = Math.floor((lat + 80) / 8);
  return BANDS[Math.max(0, Math.min(idx, 19))] || null;
}

export function formatMgrs(compact) {
  const m = String(compact || '')
    .toUpperCase()
    .match(/^(\d{1,2}[C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d*)$/);
  if (!m) return compact || '';
  const [, gzd, sq, digits] = m;
  if (!digits) return `${gzd} ${sq}`;
  const half = digits.length / 2;
  return `${gzd} ${sq} ${digits.slice(0, half)} ${digits.slice(half)}`;
}

function labelForAccuracy(compact, accuracy) {
  const formatted = formatMgrs(compact);
  if (accuracy <= 0) return formatted;
  const parts = String(formatted).split(' ');
  if (parts.length >= 4) return `${parts[2]} ${parts[3]}`;
  return formatted;
}


/**
 * Zoom → grid interval (meters) and mgrs.forward accuracy digits.
 * 0 = 100 km, 1 = 10 km, 2 = 1 km, 3 = 100 m
 */
export function intervalForZoom(zoom) {
  const z = Math.floor(zoom);
  if (z < 8) return { meters: 100000, accuracy: 0, id: '100k', label: '100 km' };
  if (z <= 10) return { meters: 10000, accuracy: 1, id: '10k', label: '10 km' };
  if (z <= 13) return { meters: 1000, accuracy: 2, id: '1k', label: '1 km' };
  if (z <= 16) return { meters: 100, accuracy: 3, id: '100m', label: '100 m' };
  return { meters: 100, accuracy: 3, id: '100m', label: '100 m' };
}

/** Live MGRS / convert precision from MapLibre zoom. */
export function precisionForZoom(zoom) {
  return intervalForZoom(zoom).accuracy;
}

function padBounds(b, frac = 0.12) {
  const dLon = (b.getEast() - b.getWest()) * frac;
  const dLat = (b.getNorth() - b.getSouth()) * frac;
  return {
    west: b.getWest() - dLon,
    east: b.getEast() + dLon,
    south: b.getSouth() - dLat,
    north: b.getNorth() + dLat,
  };
}

function zonesIn(west, east) {
  const out = new Set();
  let w = west;
  let e = east;
  if (e < w) e += 360;
  for (let lon = w; lon <= e + 0.05; lon += 2) {
    let L = lon;
    while (L > 180) L -= 360;
    while (L < -180) L += 360;
    out.add(utmZone(L));
  }
  return [...out];
}

function snapUp(v, step) {
  return Math.ceil(v / step) * step;
}

function inZone(lon, zone, slop = 0.2) {
  const [a, b] = zoneLonRange(zone);
  return lon >= a - slop && lon <= b + slop;
}

function sampleStep(interval) {
  if (interval >= 100000) return 25000;
  if (interval >= 10000) return 5000;
  if (interval >= 1000) return 500;
  return 100;
}

function lineFeature(coords, level) {
  if (!coords || coords.length < 2) return null;
  return {
    type: 'Feature',
    properties: { kind: 'line', level },
    geometry: { type: 'LineString', coordinates: coords },
  };
}

function pointFeature(lon, lat, label, level) {
  return {
    type: 'Feature',
    properties: { kind: 'label', label, level },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  };
}

function buildUtmLines(zone, northHem, bounds, interval) {
  const features = [];
  const corners = [
    [bounds.west, bounds.south],
    [bounds.east, bounds.south],
    [bounds.west, bounds.north],
    [bounds.east, bounds.north],
    [(bounds.west + bounds.east) / 2, bounds.south],
    [(bounds.west + bounds.east) / 2, bounds.north],
    [bounds.west, (bounds.south + bounds.north) / 2],
    [bounds.east, (bounds.south + bounds.north) / 2],
  ];
  let minE = Infinity;
  let maxE = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  for (const [lon, lat] of corners) {
    const u = latLonToUtm(lon, lat, zone);
    minE = Math.min(minE, u.easting);
    maxE = Math.max(maxE, u.easting);
    minN = Math.min(minN, u.northing);
    maxN = Math.max(maxN, u.northing);
  }
  minE = Math.max(100000, minE - interval);
  maxE = Math.min(900000, maxE + interval);
  minN = Math.max(northHem ? 0 : 0, minN - interval);
  maxN = maxN + interval;

  const spanE = maxE - minE;
  const spanN = maxN - minN;
  let step = interval;
  const maxLines = 48;
  while ((spanE / step > maxLines || spanN / step > maxLines) && step < 100000) {
    step *= 10;
  }

  const ds = sampleStep(step);
  const [zWest, zEast] = zoneLonRange(zone);
  const latMin = Math.max(bounds.south - 1, northHem ? 0 : -80);
  const latMax = Math.min(bounds.north + 1, northHem ? 84 : 0);

  const levelFor = (v) => {
    if (v % 100000 === 0) return '100km';
    if (v % 10000 === 0) return '10km';
    if (v % 1000 === 0) return '1km';
    return '100m';
  };

  for (let e = snapUp(minE, step); e <= maxE; e += step) {
    const coords = [];
    for (let n = minN; n <= maxN + ds; n += ds) {
      const p = utmToLatLon(zone, e, n, northHem);
      if (
        p.lat >= latMin &&
        p.lat <= latMax &&
        p.lon >= zWest - 0.05 &&
        p.lon <= zEast + 0.05 &&
        p.lon >= bounds.west - 1 &&
        p.lon <= bounds.east + 1
      ) {
        coords.push([p.lon, p.lat]);
      } else if (coords.length >= 2) {
        const f = lineFeature(coords.splice(0), levelFor(e));
        if (f) features.push(f);
        coords.length = 0;
      } else {
        coords.length = 0;
      }
    }
    const f = lineFeature(coords, levelFor(e));
    if (f) features.push(f);
  }

  for (let n = snapUp(minN, step); n <= maxN; n += step) {
    const coords = [];
    for (let e = minE; e <= maxE + ds; e += ds) {
      const p = utmToLatLon(zone, e, n, northHem);
      if (
        p.lat >= latMin &&
        p.lat <= latMax &&
        inZone(p.lon, zone, 0.05) &&
        p.lon >= bounds.west - 1 &&
        p.lon <= bounds.east + 1
      ) {
        coords.push([p.lon, p.lat]);
      } else if (coords.length >= 2) {
        const f = lineFeature(coords.splice(0), levelFor(n));
        if (f) features.push(f);
        coords.length = 0;
      } else {
        coords.length = 0;
      }
    }
    const f = lineFeature(coords, levelFor(n));
    if (f) features.push(f);
  }

  return { features, step };
}

function buildLabels(zone, northHem, bounds, interval, accuracy) {
  const features = [];
  const midLat = (bounds.south + bounds.north) / 2;
  const midLon = (bounds.west + bounds.east) / 2;
  const sw = latLonToUtm(bounds.west, bounds.south, zone);
  const ne = latLonToUtm(bounds.east, bounds.north, zone);
  const minE = Math.max(100000, Math.min(sw.easting, ne.easting) - interval);
  const maxE = Math.min(900000, Math.max(sw.easting, ne.easting) + interval);
  const minN = Math.min(sw.northing, ne.northing) - interval;
  const maxN = Math.max(sw.northing, ne.northing) + interval;

  let step = interval;
  const maxLabels = 64;
  while (
    ((maxE - minE) / step) * ((maxN - minN) / step) > maxLabels &&
    step < 100000
  ) {
    step *= 2;
  }

  const [zWest, zEast] = zoneLonRange(zone);

  for (let e = snapUp(minE, step); e < maxE; e += step) {
    for (let n = snapUp(minN, step); n < maxN; n += step) {
      const p = utmToLatLon(zone, e + step / 2, n + step / 2, northHem);
      if (
        p.lat < bounds.south ||
        p.lat > bounds.north ||
        p.lon < bounds.west ||
        p.lon > bounds.east ||
        p.lon < zWest ||
        p.lon > zEast
      ) {
        continue;
      }
      if (utmZone(p.lon) !== zone) continue;
      try {
        const compact = forward([p.lon, p.lat], accuracy);
        features.push(pointFeature(p.lon, p.lat, labelForAccuracy(compact, accuracy), 'cell'));
      } catch {
        // polar / invalid
      }
    }
  }

  // Always keep a label near the visual center so the HUD and grid agree.
  void midLat;
  void midLon;
  return features;
}

function bandSouth(letter) {
  const i = BANDS.indexOf(letter);
  if (i < 0) return null;
  if (letter === 'X') return 72;
  return -80 + i * 8;
}

function bandNorth(letter) {
  if (letter === 'X') return 84;
  const i = BANDS.indexOf(letter);
  return -80 + (i + 1) * 8;
}

function buildGzd(bounds, zoom) {
  const features = [];
  const west = Math.max(-180, bounds.west - 1);
  const east = Math.min(180, bounds.east + 1);
  const south = Math.max(-80, bounds.south - 1);
  const north = Math.min(84, bounds.north + 1);

  const z0 = utmZone(west);
  const z1 = utmZone(east);
  for (let z = z0; z <= z1 + (z1 < z0 ? 60 : 0); z += 1) {
    const zone = ((z - 1) % 60) + 1;
    const [, zEast] = zoneLonRange(zone);
    if (zEast >= west && zEast <= east + 0.01) {
      features.push(
        lineFeature(
          [
            [zEast, south],
            [zEast, north],
          ],
          'gzd',
        ),
      );
    }
  }

  for (const letter of BANDS) {
    const lat = bandNorth(letter);
    if (lat > south && lat < north) {
      features.push(
        lineFeature(
          [
            [west, lat],
            [east, lat],
          ],
          'gzd',
        ),
      );
    }
  }

  if (zoom < 8) {
    const zStart = utmZone(bounds.west);
    const zEnd = utmZone(bounds.east);
    for (let z = zStart; z <= zEnd; z += 1) {
      const [a, b] = zoneLonRange(z);
      const lon = (Math.max(a, bounds.west) + Math.min(b, bounds.east)) / 2;
      for (const letter of BANDS) {
        const s = bandSouth(letter);
        const n = bandNorth(letter);
        if (n < bounds.south || s > bounds.north) continue;
        const lat = (Math.max(s, bounds.south) + Math.min(n, bounds.north)) / 2;
        features.push(pointFeature(lon, lat, `${z}${letter}`, 'gzd'));
      }
    }
  }

  return features.filter(Boolean);
}

export function buildGridGeoJSON(map) {
  const zoom = map.getZoom();
  const { meters, accuracy } = intervalForZoom(zoom);
  const bounds = padBounds(map.getBounds(), 0.1);
  bounds.south = Math.max(-80, bounds.south);
  bounds.north = Math.min(84, bounds.north);

  const features = [];
  features.push(...buildGzd(bounds, zoom).filter(Boolean));

  const hems = [];
  if (bounds.north > 0) hems.push(true);
  if (bounds.south < 0) hems.push(false);

  let usedStep = meters;
  for (const zone of zonesIn(bounds.west, bounds.east)) {
    for (const northHem of hems) {
      const { features: lines, step } = buildUtmLines(
        zone,
        northHem,
        bounds,
        meters,
      );
      usedStep = Math.max(usedStep, step);
      features.push(...lines);
      features.push(
        ...buildLabels(zone, northHem, bounds, step, accuracy),
      );
    }
  }

  return {
    data: { type: 'FeatureCollection', features: features.filter(Boolean) },
    interval: usedStep,
    accuracy,
  };
}

export function centerMgrs(map, accuracy) {
  const c = map.getCenter();
  const acc = Number.isFinite(accuracy) ? accuracy : precisionForZoom(map.getZoom());
  try {
    return formatMgrs(forward([c.lng, c.lat], acc));
  } catch {
    return '';
  }
}

export function centerMgrsCompact(map, accuracy) {
  const c = map.getCenter();
  const acc = Number.isFinite(accuracy) ? accuracy : precisionForZoom(map.getZoom());
  try {
    return String(forward([c.lng, c.lat], acc) || '').replace(/\s+/g, '').toUpperCase();
  } catch {
    return '';
  }
}

function emptyFC() {
  return { type: 'FeatureCollection', features: [] };
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {(info: { interval: number, accuracy: number }) => void} [onUpdate]
 */
export function attachMgrsGrid(map, onUpdate) {
  const apply = () => {
    const { data, interval, accuracy } = buildGridGeoJSON(map);
    const src = map.getSource(SOURCE_ID);
    if (src) src.setData(data);
    if (onUpdate) onUpdate({ interval, accuracy });
  };

  const addLayers = () => {
    if (map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, { type: 'geojson', data: emptyFC() });

    map.addLayer({
      id: GZD_LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'level'], 'gzd'],
      paint: {
        'line-color': '#8b1e1e',
        'line-width': 1.6,
        'line-opacity': 0.85,
      },
    });

    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: SOURCE_ID,
      filter: [
        'all',
        ['==', ['get', 'kind'], 'line'],
        ['!=', ['get', 'level'], 'gzd'],
      ],
      paint: {
        'line-color': '#1C1914',
        'line-width': [
          'match',
          ['get', 'level'],
          '100km',
          1.5,
          '10km',
          0.9,
          '1km',
          0.6,
          0.4,
        ],
        'line-opacity': [
          'match',
          ['get', 'level'],
          '100km',
          0.75,
          '10km',
          0.4,
          '1km',
          0.4,
          0.28,
        ],
      },
    });

    map.addLayer({
      id: GZD_LABEL_LAYER,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['==', ['get', 'level'], 'gzd'],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 13,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': false,
        'text-padding': 4,
      },
      paint: {
        'text-color': '#6b1515',
        'text-halo-color': 'rgba(255,255,248,0.9)',
        'text-halo-width': 1.6,
      },
    });

    map.addLayer({
      id: LABEL_LAYER,
      type: 'symbol',
      source: SOURCE_ID,
      filter: [
        'all',
        ['==', ['get', 'kind'], 'label'],
        ['!=', ['get', 'level'], 'gzd'],
      ],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-allow-overlap': false,
        'text-padding': 2,
      },
      paint: {
        'text-color': '#1C1914',
        'text-halo-color': 'rgba(255,255,248,0.88)',
        'text-halo-width': 1.5,
      },
    });

    apply();
  };

  if (map.isStyleLoaded()) addLayers();
  map.on('load', addLayers);
  map.on('moveend', apply);
  map.on('zoomend', apply);

  return { refresh: apply };
}
