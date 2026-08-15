import { forward } from 'mgrs';
import { t } from './copy.js';

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


export function isGridAvailable(lat) {
  return Number.isFinite(lat) && lat >= -80 && lat <= 84;
}

export function isPolarLat(lat) {
  return !isGridAvailable(lat);
}

/** @type {{ meters: number, accuracy: number, id?: string, labelKey?: string, levels?: string[] } | null} */
let printOverride = null;
let gridApply = null;

/** Freeze the print RF band (or null to clear after print). */
export function setPrintInterval(band) {
  printOverride = band || null;
  if (typeof gridApply === 'function') gridApply();
}

export function setGridPrintMode(band) {
  setPrintInterval(band);
}

/** Print principal by RF (not screen zoom). */
export function intervalForRf(rf) {
  const n = Number(rf);
  if (!Number.isFinite(n) || n >= 75000) {
    return {
      meters: 10000,
      accuracy: 2,
      id: '10k',
      label: t('print.gridInterval.10k'),
      labelKey: 'print.gridInterval.10k',
      levels: ['gzd', '100km', '10km'],
    };
  }
  if (n >= 25000) {
    return {
      meters: 1000,
      accuracy: 3,
      id: '1k',
      label: t('print.gridInterval.1k'),
      labelKey: 'print.gridInterval.1k',
      levels: ['gzd', '100km', '1km'],
    };
  }
  return {
    meters: 100,
    accuracy: 4,
    id: '100m',
    label: t('print.gridInterval.100m'),
    labelKey: 'print.gridInterval.100m',
    levels: ['gzd', '100km', '1km', '100m'],
  };
}

/**
 * Zoom → principal screen interval. GZD stays at z 0–7. Finest is 100 m.
 */
export function intervalForZoom(zoom) {
  const z = Math.floor(zoom);
  if (z < 8) {
    return { meters: 0, accuracy: 0, id: 'gzd', label: '', labelKey: '', hidden: false, gzdOnly: true };
  }
  if (z <= 12) {
    return {
      meters: 10000,
      accuracy: 2,
      id: '10k',
      label: t('print.gridInterval.10k'),
      labelKey: 'print.gridInterval.10k',
      hidden: false,
    };
  }
  if (z <= 14) {
    return {
      meters: 1000,
      accuracy: 3,
      id: '1k',
      label: t('print.gridInterval.1k'),
      labelKey: 'print.gridInterval.1k',
      hidden: false,
    };
  }
  return {
    meters: 100,
    accuracy: 4,
    id: '100m',
    label: t('print.gridInterval.100m'),
    labelKey: 'print.gridInterval.100m',
    hidden: false,
  };
}

/** Live MGRS / convert precision from MapLibre zoom. */
export function precisionForZoom(zoom) {
  const a = intervalForZoom(zoom).accuracy;
  return a < 0 ? 1 : a;
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

function cssPxForMeters(map, meters) {
  const canvas = map.getCanvas();
  const x = canvas.clientWidth / 2;
  const y = canvas.clientHeight / 2;
  const a = map.unproject([x - 50, y]);
  const b = map.unproject([x + 50, y]);
  const span = a.distanceTo(b);
  if (!Number.isFinite(span) || span <= 0) return 0;
  return meters / (span / 100);
}

/** Levels whose lines are ≥ 24 CSS px apart, plus GZD whenever overlay is on. */
export function allowedLevels(map) {
  const ok = (m) => cssPxForMeters(map, m) >= 24;
  const out = ['gzd'];
  if (printOverride) {
    const m = Number(printOverride.meters) || 0;
    if (m > 0 && ok(100000)) out.push('100km');
    if (m > 0 && m <= 10000 && ok(10000)) out.push('10km');
    if (m > 0 && m <= 1000 && ok(1000)) out.push('1km');
    if (m > 0 && m <= 100 && ok(100)) out.push('100m');
    return out;
  }
  const z = Math.floor(map.getZoom());
  if (z < 8) return out;
  if (ok(100000)) out.push('100km');
  if (ok(10000)) out.push('10km');
  if (ok(1000)) out.push('1km');
  if (ok(100)) out.push('100m');
  return out;
}

function finestMeters(levels) {
  if (levels.includes('100m')) return 100;
  if (levels.includes('1km')) return 1000;
  if (levels.includes('10km')) return 10000;
  if (levels.includes('100km')) return 100000;
  return 0;
}

function levelFor(v) {
  if (v % 100000 === 0) return '100km';
  if (v % 10000 === 0) return '10km';
  if (v % 1000 === 0) return '1km';
  return '100m';
}

function buildUtmLines(zone, northHem, bounds, interval, allowed) {
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
  minN = Math.max(0, minN - interval);
  maxN = maxN + interval;

  const step = interval;
  const ds = sampleStep(step);
  const [zWest, zEast] = zoneLonRange(zone);
  const latMin = Math.max(bounds.south - 1, northHem ? 0 : -80);
  const latMax = Math.min(bounds.north + 1, northHem ? 84 : 0);

  const keep = (v) => allowed.includes(levelFor(v));

  for (let e = snapUp(minE, step); e <= maxE; e += step) {
    if (!keep(e)) continue;
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
    if (!keep(n)) continue;
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

function squareLetters(compact) {
  const m = String(compact || '')
    .toUpperCase()
    .match(/^\d{1,2}[C-HJ-NP-X]([A-HJ-NP-Z]{2})/);
  return m ? m[1] : '';
}

function buildLabels(zone, northHem, bounds, interval, accuracy) {
  const features = [];
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
  const everyFifth = interval <= 100;

  for (let e = snapUp(minE, step); e < maxE; e += step) {
    for (let n = snapUp(minN, step); n < maxN; n += step) {
      if (everyFifth && (e % 500 !== 0 || n % 500 !== 0)) continue;
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
      // Interior easting/northing type is dead (DESIGN_SPEC §0).
      // Edge labels live in the white collar via ticks.js.
      void accuracy;
    }
  }

  if (interval <= 100000) {
    const sqStep = 100000;
    for (let e = snapUp(minE, sqStep); e < maxE; e += sqStep) {
      for (let n = snapUp(minN, sqStep); n < maxN; n += sqStep) {
        const p = utmToLatLon(zone, e + sqStep / 2, n + sqStep / 2, northHem);
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
        try {
          const compact = forward([p.lon, p.lat], 0);
          const letters = squareLetters(compact);
          if (letters) features.push(pointFeature(p.lon, p.lat, letters, '100km'));
        } catch {
          // skip
        }
      }
    }
  }

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

  if (zoom >= 8) {
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
  const center = map.getCenter();
  const polar = isPolarLat(center.lat);

  if (polar) {
    return {
      data: emptyFC(),
      interval: 0,
      accuracy: -1,
      hidden: true,
      polar: true,
      labelKey: '',
    };
  }

  const band = printOverride || intervalForZoom(zoom);
  const levels = allowedLevels(map);
  const meters = printOverride && printOverride.meters
    ? printOverride.meters
    : finestMeters(levels);
  const bounds = padBounds(map.getBounds(), 0.1);
  bounds.south = Math.max(-80, bounds.south);
  bounds.north = Math.min(84, bounds.north);

  const features = [];
  if (levels.includes('gzd')) {
    features.push(...buildGzd(bounds, zoom).filter(Boolean));
  }

  const hems = [];
  if (bounds.north > 0) hems.push(true);
  if (bounds.south < 0) hems.push(false);

  let usedStep = meters;
  if (meters > 0) {
    for (const zone of zonesIn(bounds.west, bounds.east)) {
      for (const northHem of hems) {
        const { features: lines, step } = buildUtmLines(
          zone,
          northHem,
          bounds,
          meters,
          levels,
        );
        usedStep = Math.max(usedStep, step);
        features.push(...lines);
        features.push(
          ...buildLabels(zone, northHem, bounds, step, band.accuracy),
        );
      }
    }
  }

  return {
    data: { type: 'FeatureCollection', features: features.filter(Boolean) },
    interval: usedStep,
    accuracy: band.accuracy,
    hidden: false,
    polar: false,
    labelKey: band.labelKey,
  };
}

export function centerMgrs(map, accuracy) {
  const c = map.getCenter();
  if (!isGridAvailable(c.lat)) return '';
  const acc = Number.isFinite(accuracy) ? accuracy : precisionForZoom(map.getZoom());
  try {
    return formatMgrs(forward([c.lng, c.lat], acc));
  } catch {
    return '';
  }
}

export function centerMgrsCompact(map, accuracy) {
  const c = map.getCenter();
  if (!isGridAvailable(c.lat)) return '';
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

const GZD_CASE_LAYER = 'mgrs-gzd-case';
const LINE_CASE_LAYER = 'mgrs-grid-case';
const VIS_LAYERS = [
  GZD_CASE_LAYER,
  LINE_CASE_LAYER,
  GZD_LINE_LAYER,
  LINE_LAYER,
  GZD_LABEL_LAYER,
  LABEL_LAYER,
];

const INK = '#000000';
const GZD = '#8B1E1E';
const PAPER = '#FFFFFF';

function setOverlayVisible(map, on) {
  const vis = on ? 'visible' : 'none';
  for (const id of VIS_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  }
}

function dropGridLayers(map) {
  for (const id of VIS_LAYERS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {(info: { interval: number, accuracy: number, hidden?: boolean, polar?: boolean, labelKey?: string }) => void} [onUpdate]
 */
export function attachMgrsGrid(map, onUpdate) {
  const apply = () => {
    const { data, interval, accuracy, hidden, polar, labelKey } = buildGridGeoJSON(map);
    const src = map.getSource(SOURCE_ID);
    if (src) src.setData(data);
    setOverlayVisible(map, !hidden);
    if (onUpdate) onUpdate({ interval, accuracy, hidden, polar, labelKey });
    paintInk();
  };

  const paintInk = () => {
    const printing = !!printOverride;
    if (map.getLayer(GZD_CASE_LAYER)) {
      map.setPaintProperty(GZD_CASE_LAYER, 'line-color', PAPER);
      map.setPaintProperty(GZD_CASE_LAYER, 'line-width', printing ? 6 : 5);
      map.setPaintProperty(GZD_CASE_LAYER, 'line-opacity', printing ? 1 : 0.92);
    }
    if (map.getLayer(LINE_CASE_LAYER)) {
      map.setPaintProperty(LINE_CASE_LAYER, 'line-color', PAPER);
      map.setPaintProperty(
        LINE_CASE_LAYER,
        'line-width',
        printing
          ? [
              'match',
              ['get', 'level'],
              '100km',
              4.2,
              '10km',
              3.4,
              '1km',
              2.8,
              2.4,
            ]
          : [
              'match',
              ['get', 'level'],
              '100km',
              3.6,
              '10km',
              2.8,
              '1km',
              2.2,
              1.8,
            ],
      );
      map.setPaintProperty(LINE_CASE_LAYER, 'line-opacity', printing ? 1 : 0.9);
    }
    if (map.getLayer(GZD_LINE_LAYER)) {
      map.setPaintProperty(GZD_LINE_LAYER, 'line-color', GZD);
      map.setPaintProperty(GZD_LINE_LAYER, 'line-width', 2.5);
      map.setPaintProperty(GZD_LINE_LAYER, 'line-opacity', 0.85);
    }
    if (map.getLayer(LINE_LAYER)) {
      map.setPaintProperty(LINE_LAYER, 'line-color', INK);
      map.setPaintProperty(
        LINE_LAYER,
        'line-opacity',
        printing
          ? 0.85
          : [
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
      );
    }
    if (map.getLayer(GZD_LABEL_LAYER)) {
      map.setPaintProperty(GZD_LABEL_LAYER, 'text-color', GZD);
      map.setPaintProperty(GZD_LABEL_LAYER, 'text-halo-color', PAPER);
    }
    if (map.getLayer(LABEL_LAYER)) {
      map.setPaintProperty(LABEL_LAYER, 'text-color', INK);
      map.setPaintProperty(LABEL_LAYER, 'text-halo-color', PAPER);
    }
  };

  let adding = false;
  const addLayers = () => {
    if (adding) return;
    adding = true;
    try {
      dropGridLayers(map);
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: 'geojson', data: emptyFC() });
      }

      map.addLayer({
        id: GZD_CASE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'level'], 'gzd'],
        layout: { 'line-cap': 'butt', 'line-join': 'miter' },
        paint: {
          'line-color': PAPER,
          'line-width': 5,
          'line-opacity': 0.92,
        },
      });

      map.addLayer({
        id: LINE_CASE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        filter: [
          'all',
          ['==', ['get', 'kind'], 'line'],
          ['!=', ['get', 'level'], 'gzd'],
        ],
        layout: { 'line-cap': 'butt', 'line-join': 'miter' },
        paint: {
          'line-color': PAPER,
          'line-width': [
            'match',
            ['get', 'level'],
            '100km',
            3.6,
            '10km',
            2.8,
            '1km',
            2.2,
            1.8,
          ],
          'line-opacity': 0.9,
        },
      });

      map.addLayer({
        id: GZD_LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'level'], 'gzd'],
        layout: { 'line-cap': 'butt', 'line-join': 'miter' },
        paint: {
          'line-color': GZD,
          'line-width': 2.5,
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
        layout: { 'line-cap': 'butt', 'line-join': 'miter' },
        paint: {
          'line-color': INK,
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
          'text-allow-overlap': true,
          'text-padding': 2,
        },
        paint: {
          'text-color': GZD,
          'text-halo-color': PAPER,
          'text-halo-width': 3.5,
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
          'text-color': INK,
          'text-halo-color': PAPER,
          'text-halo-width': 2,
        },
      });

      paintInk();
      apply();
    } finally {
      adding = false;
    }
  };

  gridApply = apply;

  if (map.isStyleLoaded()) addLayers();
  map.on('load', addLayers);
  map.on('style.load', addLayers);
  map.on('styledata', () => {
    if (!map.isStyleLoaded()) return;
    if (!map.getLayer(LINE_LAYER)) addLayers();
    else paintInk();
  });
  map.on('moveend', apply);
  map.on('zoomend', apply);

  return { refresh: apply };
}
