import { latLonToUtm, utmToLatLon, utmZone, intervalForZoom, squareLettersAt } from './mgrs-grid.js';
import { intervalForPrintRf } from './scale.js';

const LEFT = 0.38;
const TOP = 0.58;
const MAP_W = 7.74;
const MAP_H = 8.14;
const OUT = 0.12;
const INN = 0.08;
const LAB = 0.04;

function snapUp(v, step) {
  return Math.ceil(v / step) * step;
}

function edgeLabel(meters, interval) {
  const km = Math.floor(meters / 1000);
  if (interval >= 10000) return String(km % 1000).padStart(2, '0');
  return String(km % 100).padStart(2, '0');
}

function utmCornerText(meters, kind) {
  const rounded = Math.round(meters / 1000) * 1000;
  return `${rounded}${kind === 'E' ? 'm.E' : 'm.N'}`;
}

function dms(value, pos, neg) {
  const hemi = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = Math.round((minFull - min) * 60);
  let d = deg;
  let m = min;
  let s = sec;
  if (s === 60) {
    s = 0;
    m += 1;
  }
  if (m === 60) {
    m = 0;
    d += 1;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d}° ${pad(m)}′ ${pad(s)}″ ${hemi}`;
}

function tick(el, style) {
  const d = document.createElement('div');
  d.className = 'tick';
  Object.assign(d.style, style);
  el.appendChild(d);
}

function lab(el, text, style) {
  const d = document.createElement('div');
  d.className = 'lab';
  d.textContent = text;
  Object.assign(d.style, style);
  el.appendChild(d);
}

function rebuild(map, host) {
  const printing = document.body.classList.contains('printing');
  const band = printing
    ? intervalForPrintRf(24000)
    : intervalForZoom(map.getZoom());
  const step = band.meters;
  if (!step || band.hidden || band.gzdOnly) {
    host.replaceChildren();
    return;
  }

  const mapEl = map.getContainer();
  const sheet = document.getElementById('sheet');
  const mw = mapEl.clientWidth || (sheet ? sheet.clientWidth * (MAP_W / 8.5) : 0);
  const mh = mapEl.clientHeight || (sheet ? sheet.clientHeight * (MAP_H / 11) : 0);
  if (mw < 8 || mh < 8) return;

  const c = map.getCenter();
  const zone = utmZone(c.lng);
  const utm = latLonToUtm(c.lng, c.lat, zone);
  const b = map.getBounds();
  const sw = latLonToUtm(b.getWest(), b.getSouth(), zone);
  const ne = latLonToUtm(b.getEast(), b.getNorth(), zone);
  const nw = latLonToUtm(b.getWest(), b.getNorth(), zone);
  const se = latLonToUtm(b.getEast(), b.getSouth(), zone);
  const minE = Math.min(sw.easting, ne.easting, nw.easting, se.easting);
  const maxE = Math.max(sw.easting, ne.easting, nw.easting, se.easting);
  const minN = Math.min(sw.northing, ne.northing, nw.northing, se.northing);
  const maxN = Math.max(sw.northing, ne.northing, nw.northing, se.northing);
  host.replaceChildren();
  const north = c.lat >= 0;

  const firstE = snapUp(minE, 10000);
  const firstN = snapUp(minN, 10000);

  for (let e = snapUp(minE, step); e <= maxE; e += step) {
    const p = utmToLatLon(zone, e, utm.northing, north);
    const px = map.project([p.lon, p.lat]);
    if (px.x < -2 || px.x > mw + 2) continue;
    const xIn = LEFT + (px.x / mw) * MAP_W;
    const x = `${(xIn / 8.5) * 100}%`;
    const principal = Math.abs(e - firstE) % 10000 < 1 || e === firstE;
    tick(host, { left: x, top: `${((TOP - OUT) / 11) * 100}%`, width: principal ? '0.9pt' : '0.6pt', height: `${((OUT + INN) / 11) * 100}%` });
    tick(host, { left: x, top: `${((TOP + MAP_H - INN) / 11) * 100}%`, width: principal ? '0.9pt' : '0.6pt', height: `${(INN / 11) * 100}%` });
    const text = edgeLabel(e, step);
    lab(host, text, {
      left: `${((xIn - 0.08) / 8.5) * 100}%`,
      top: `${((TOP + 0.03) / 11) * 100}%`,
      fontSize: '9pt',
    });
    lab(host, text, {
      left: `${((xIn - 0.08) / 8.5) * 100}%`,
      top: `${((TOP + MAP_H - 0.13) / 11) * 100}%`,
      fontSize: '9pt',
    });
  }

  for (let n = snapUp(minN, step); n <= maxN; n += step) {
    const p = utmToLatLon(zone, utm.easting, n, north);
    const px = map.project([p.lon, p.lat]);
    if (px.y < -2 || px.y > mh + 2) continue;
    const yIn = TOP + (px.y / mh) * MAP_H;
    const y = `${(yIn / 11) * 100}%`;
    const principal = Math.abs(n - firstN) % 10000 < 1 || n === firstN;
    tick(host, { top: y, left: `${((LEFT - OUT) / 8.5) * 100}%`, height: principal ? '0.9pt' : '0.6pt', width: `${((OUT + INN) / 8.5) * 100}%` });
    tick(host, { top: y, left: `${((LEFT + MAP_W - INN) / 8.5) * 100}%`, height: principal ? '0.9pt' : '0.6pt', width: `${((INN) / 8.5) * 100}%` });
    const text = edgeLabel(n, step);
    lab(host, text, { left: `${((LEFT - OUT - LAB - 0.14) / 8.5) * 100}%`, top: `${((yIn - 0.06) / 11) * 100}%`, fontSize: '9pt' });
    lab(host, text, { left: `${((LEFT + MAP_W + OUT + 0.02) / 8.5) * 100}%`, top: `${((yIn - 0.06) / 11) * 100}%`, fontSize: '9pt' });
  }

  const corners = [
    { utm: nw, xIn: LEFT, yIn: TOP, eAlign: 'left', nAlign: 'top' },
    { utm: ne, xIn: LEFT + MAP_W, yIn: TOP, eAlign: 'right', nAlign: 'top' },
    { utm: sw, xIn: LEFT, yIn: TOP + MAP_H, eAlign: 'left', nAlign: 'bottom' },
    { utm: se, xIn: LEFT + MAP_W, yIn: TOP + MAP_H, eAlign: 'right', nAlign: 'bottom' },
  ];
  for (const corner of corners) {
    const eText = utmCornerText(corner.utm.easting, 'E');
    const nText = utmCornerText(corner.utm.northing, 'N');
    const eLeft = corner.eAlign === 'left'
      ? `${((corner.xIn) / 8.5) * 100}%`
      : `${((corner.xIn - 0.72) / 8.5) * 100}%`;
    const eTop = corner.nAlign === 'top'
      ? `${((TOP - 0.20) / 11) * 100}%`
      : `${((TOP + MAP_H - 0.16) / 11) * 100}%`;
    lab(host, eText, { left: eLeft, top: eTop, fontSize: '6.5pt', className: 'lab lab-utm' });
    const nLeft = corner.eAlign === 'left'
      ? `${((LEFT - 0.36) / 8.5) * 100}%`
      : `${((LEFT + MAP_W + 0.02) / 8.5) * 100}%`;
    const nTop = corner.nAlign === 'top'
      ? `${((corner.yIn) / 11) * 100}%`
      : `${((corner.yIn - 0.10) / 11) * 100}%`;
    lab(host, nText, { left: nLeft, top: nTop, fontSize: '6.5pt' });
  }

  const geos = [
    { lon: b.getWest(), lat: b.getNorth(), left: `${((LEFT - 0.02) / 8.5) * 100}%`, top: `${((TOP - 0.32) / 11) * 100}%` },
    { lon: b.getEast(), lat: b.getNorth(), left: `${((LEFT + MAP_W - 0.70) / 8.5) * 100}%`, top: `${((TOP - 0.32) / 11) * 100}%` },
    { lon: b.getWest(), lat: b.getSouth(), left: `${((LEFT + 0.04) / 8.5) * 100}%`, top: `${((TOP + MAP_H - 0.22) / 11) * 100}%` },
    { lon: b.getEast(), lat: b.getSouth(), left: `${((LEFT + MAP_W - 0.70) / 8.5) * 100}%`, top: `${((TOP + MAP_H - 0.22) / 11) * 100}%` },
  ];
  for (const g of geos) {
    lab(host, `${dms(g.lat, 'N', 'S')}  ${dms(g.lon, 'E', 'W')}`, {
      left: g.left,
      top: g.top,
      fontSize: '6pt',
      color: '#4A4036',
      whiteSpace: 'nowrap',
    });
  }

  const km100 = 100000;
  for (let e = snapUp(minE, km100); e <= maxE; e += km100) {
    const midLat = (b.getNorth() + b.getSouth()) / 2;
    const p = utmToLatLon(zone, e, latLonToUtm(c.lng, midLat, zone).northing, north);
    const px = map.project([p.lon, p.lat]);
    if (px.x < -4 || px.x > mw + 4) continue;
    const letters = squareLettersAt(p.lon + 0.01, midLat);
    if (!letters) continue;
    const xIn = LEFT + (px.x / mw) * MAP_W;
    lab(host, letters, {
      left: `${((xIn - 0.10) / 8.5) * 100}%`,
      top: `${((TOP - 0.20) / 11) * 100}%`,
      fontSize: '8pt',
      fontWeight: '700',
      color: '#8B1E1E',
    });
  }
  for (let n = snapUp(minN, km100); n <= maxN; n += km100) {
    const midLon = (b.getWest() + b.getEast()) / 2;
    const p = utmToLatLon(zone, latLonToUtm(midLon, c.lat, zone).easting, n, north);
    const px = map.project([p.lon, p.lat]);
    if (px.y < -4 || px.y > mh + 4) continue;
    const letters = squareLettersAt(midLon, p.lat + 0.01);
    if (!letters) continue;
    const yIn = TOP + (px.y / mh) * MAP_H;
    lab(host, letters, {
      left: `${((LEFT - 0.28) / 8.5) * 100}%`,
      top: `${((yIn - 0.08) / 11) * 100}%`,
      fontSize: '8pt',
      fontWeight: '700',
      color: '#8B1E1E',
    });
  }
}

export function attachCollarTicks(map) {
  const host = document.getElementById('print-ticks');
  if (!host) return;
  const draw = () => rebuild(map, host);
  map.on('move', draw);
  map.on('zoom', draw);
  map.on('zoomend', draw);
  map.on('moveend', draw);
  map.on('resize', draw);
  if (map.loaded()) draw();
  else map.on('load', draw);
}
