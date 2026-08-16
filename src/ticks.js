import { latLonToUtm, utmToLatLon, utmZone, intervalForZoom, squareLettersAt } from './mgrs-grid.js';
import { intervalForPrintRf } from './scale.js';

const LEFT = 0.38;
const TOP = 0.58;
const MAP_W = 7.74;
const MAP_H = 8.14;
const PAGE_W = 8.5;
const PAGE_H = 11;
const SAFE = 0.26;
const INN = 0.10;

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
  return `${d}°\u202f${pad(m)}′\u202f${pad(s)}″\u202f${hemi}`;
}

function pctX(xIn) {
  return `${(xIn / PAGE_W) * 100}%`;
}
function pctY(yIn) {
  return `${(yIn / PAGE_H) * 100}%`;
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
  const mw = mapEl.clientWidth || (sheet ? sheet.clientWidth * (MAP_W / PAGE_W) : 0);
  const mh = mapEl.clientHeight || (sheet ? sheet.clientHeight * (MAP_H / PAGE_H) : 0);
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
    if (px.x < 8 || px.x > mw - 8) continue;
    const xIn = LEFT + (px.x / mw) * MAP_W;
    if (xIn < LEFT + 0.16 || xIn > LEFT + MAP_W - 0.16) continue;
    const principal = Math.abs(e - firstE) % 10000 < 1 || e === firstE;
    tick(host, {
      left: pctX(xIn),
      top: pctY(TOP),
      width: principal ? '0.9pt' : '0.6pt',
      height: `${(INN / PAGE_H) * 100}%`,
    });
    tick(host, {
      left: pctX(xIn),
      top: pctY(TOP + MAP_H - INN),
      width: principal ? '0.9pt' : '0.6pt',
      height: `${(INN / PAGE_H) * 100}%`,
    });
    const text = edgeLabel(e, step);
    lab(host, text, { left: pctX(xIn - 0.06), top: pctY(TOP - 0.18), fontSize: '7pt' });
    lab(host, text, { left: pctX(xIn - 0.06), top: pctY(TOP + MAP_H - 0.02), fontSize: '7pt' });
  }

  for (let n = snapUp(minN, step); n <= maxN; n += step) {
    const p = utmToLatLon(zone, utm.easting, n, north);
    const px = map.project([p.lon, p.lat]);
    if (px.y < 8 || px.y > mh - 8) continue;
    const yIn = TOP + (px.y / mh) * MAP_H;
    if (yIn < TOP + 0.16 || yIn > TOP + MAP_H - 0.16) continue;
    const principal = Math.abs(n - firstN) % 10000 < 1 || n === firstN;
    tick(host, {
      top: pctY(yIn),
      left: pctX(LEFT),
      height: principal ? '0.9pt' : '0.6pt',
      width: `${(INN / PAGE_W) * 100}%`,
    });
    tick(host, {
      top: pctY(yIn),
      left: pctX(LEFT + MAP_W - INN),
      height: principal ? '0.9pt' : '0.6pt',
      width: `${(INN / PAGE_W) * 100}%`,
    });
    const text = edgeLabel(n, step);
    lab(host, text, { left: pctX(LEFT - 0.16), top: pctY(yIn - 0.05), fontSize: '7pt' });
    lab(host, text, { left: pctX(LEFT + MAP_W + 0.02), top: pctY(yIn - 0.05), fontSize: '7pt' });
  }

  lab(host, utmCornerText(sw.easting, 'E'), {
    left: pctX(LEFT + 0.02), top: pctY(TOP + MAP_H - 0.10), fontSize: '6pt',
  });
  lab(host, utmCornerText(se.easting, 'E'), {
    left: pctX(LEFT + MAP_W - 0.68), top: pctY(TOP + MAP_H - 0.10), fontSize: '6pt',
  });
  lab(host, utmCornerText(nw.northing, 'N'), {
    left: pctX(LEFT + 0.02), top: pctY(TOP + 0.02), fontSize: '6pt',
  });
  lab(host, utmCornerText(ne.northing, 'N'), {
    left: pctX(LEFT + MAP_W - 0.68), top: pctY(TOP + 0.02), fontSize: '6pt',
  });

  const geo = [
    { text: dms(b.getWest(), 'E', 'W'), left: LEFT + 0.02, top: TOP - 0.18 },
    { text: dms(b.getEast(), 'E', 'W'), left: LEFT + MAP_W - 0.72, top: TOP - 0.18 },
    { text: dms(b.getNorth(), 'N', 'S'), left: LEFT - 0.16, top: TOP + 0.16 },
    { text: dms(b.getSouth(), 'N', 'S'), left: LEFT - 0.16, top: TOP + MAP_H - 0.20 },
  ];
  for (const g of geo) {
    lab(host, g.text, {
      left: pctX(g.left),
      top: pctY(g.top),
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
    if (px.x < 12 || px.x > mw - 12) continue;
    const letters = squareLettersAt(p.lon + 0.01, midLat);
    if (!letters) continue;
    const xIn = LEFT + (px.x / mw) * MAP_W;
    if (xIn < LEFT + 0.20 || xIn > LEFT + MAP_W - 0.20) continue;
    lab(host, letters, {
      left: pctX(xIn - 0.08),
      top: pctY(TOP + 0.42),
      fontSize: '8pt',
      fontWeight: '700',
      color: '#8B1E1E',
    });
  }
  for (let n = snapUp(minN, km100); n <= maxN; n += km100) {
    const midLon = (b.getWest() + b.getEast()) / 2;
    const p = utmToLatLon(zone, latLonToUtm(midLon, c.lat, zone).easting, n, north);
    const px = map.project([p.lon, p.lat]);
    if (px.y < 12 || px.y > mh - 12) continue;
    const letters = squareLettersAt(midLon, p.lat + 0.01);
    if (!letters) continue;
    const yIn = TOP + (px.y / mh) * MAP_H;
    if (yIn < TOP + 0.28 || yIn > TOP + MAP_H - 0.28) continue;
    lab(host, letters, {
      left: pctX(LEFT + 0.18),
      top: pctY(yIn - 0.06),
      fontSize: '8pt',
      fontWeight: '700',
      color: '#8B1E1E',
    });
  }
  void SAFE;
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
