import { latLonToUtm, utmToLatLon, utmZone, intervalForZoom } from './mgrs-grid.js';

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
  host.replaceChildren();
  const band = intervalForZoom(map.getZoom());
  const step = band.meters;
  if (!step || band.hidden || band.gzdOnly) return;

  const c = map.getCenter();
  const zone = utmZone(c.lng);
  const utm = latLonToUtm(c.lng, c.lat, zone);
  const b = map.getBounds();
  const sw = latLonToUtm(b.getWest(), b.getSouth(), zone);
  const ne = latLonToUtm(b.getEast(), b.getNorth(), zone);
  const minE = Math.min(sw.easting, ne.easting);
  const maxE = Math.max(sw.easting, ne.easting);
  const minN = Math.min(sw.northing, ne.northing);
  const maxN = Math.max(sw.northing, ne.northing);
  const mapEl = map.getContainer();
  const mw = mapEl.clientWidth || 1;
  const mh = mapEl.clientHeight || 1;
  const north = c.lat >= 0;

  for (let e = snapUp(minE, step); e <= maxE; e += step) {
    const p = utmToLatLon(zone, e, utm.northing, north);
    const px = map.project([p.lon, p.lat]);
    if (px.x < -2 || px.x > mw + 2) continue;
    const xIn = LEFT + (px.x / mw) * MAP_W;
    const x = `${xIn}in`;
    tick(host, { left: x, top: `${TOP - OUT}in`, width: '0.6pt', height: `${OUT + INN}in` });
    tick(host, { left: x, top: `${TOP + MAP_H - INN}in`, width: '0.6pt', height: `${OUT + INN}in` });
    const text = edgeLabel(e, step);
    lab(host, text, { left: `${xIn - 0.08}in`, top: `${TOP - OUT - LAB - 0.08}in` });
    lab(host, text, { left: `${xIn - 0.08}in`, top: `${TOP + MAP_H + OUT + 0.02}in` });
  }

  for (let n = snapUp(minN, step); n <= maxN; n += step) {
    const p = utmToLatLon(zone, utm.easting, n, north);
    const px = map.project([p.lon, p.lat]);
    if (px.y < -2 || px.y > mh + 2) continue;
    const yIn = TOP + (px.y / mh) * MAP_H;
    const y = `${yIn}in`;
    tick(host, { top: y, left: `${LEFT - OUT}in`, height: '0.6pt', width: `${OUT + INN}in` });
    tick(host, { top: y, left: `${LEFT + MAP_W - INN}in`, height: '0.6pt', width: `${OUT + INN}in` });
    const text = edgeLabel(n, step);
    lab(host, text, { left: `${LEFT - OUT - LAB - 0.14}in`, top: `${yIn - 0.06}in` });
    lab(host, text, { left: `${LEFT + MAP_W + OUT + 0.02}in`, top: `${yIn - 0.06}in` });
  }
}

export function attachCollarTicks(map) {
  const host = document.getElementById('print-ticks');
  if (!host) return;
  const draw = () => rebuild(map, host);
  map.on('move', draw);
  map.on('zoom', draw);
  map.on('resize', draw);
  if (map.loaded()) draw();
  else map.on('load', draw);
}
