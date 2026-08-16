import { latLonToUtm, utmToLatLon, utmZone, intervalForZoom } from './mgrs-grid.js';
import { squareLettersFromUtm } from './mgrs-letters.js';
import { intervalForPrintRf, getPrintRf, DEFAULT_RF } from './scale.js';

const INN_PX = 10;

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

/** Map-pixel → % of the sheet. Follows the live #map box, not a paper constant. */
function sheetMap(map) {
  const sheet = document.getElementById('sheet');
  const mapEl = map.getContainer();
  if (!sheet || !mapEl) return null;
  const sr = sheet.getBoundingClientRect();
  const mr = mapEl.getBoundingClientRect();
  const mw = mapEl.clientWidth;
  const mh = mapEl.clientHeight;
  if (sr.width < 8 || sr.height < 8 || mw < 8 || mh < 8) return null;
  return {
    mw,
    mh,
    x(px) {
      return `${((mr.left - sr.left + px) / sr.width) * 100}%`;
    },
    y(py) {
      return `${((mr.top - sr.top + py) / sr.height) * 100}%`;
    },
  };
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

function labPrefixed(el, letters, digits, style) {
  const d = document.createElement('div');
  d.className = 'lab';
  if (letters) {
    const pre = document.createElement('span');
    pre.className = 'lab-sq';
    pre.textContent = letters;
    d.appendChild(pre);
  }
  const num = document.createElement('span');
  num.textContent = digits;
  d.appendChild(num);
  Object.assign(d.style, style);
  el.appendChild(d);
}

function cornerBlock(el, lineA, lineB, style) {
  const d = document.createElement('div');
  d.className = 'lab lab-corner';
  const a = document.createElement('div');
  a.textContent = lineA;
  const b = document.createElement('div');
  b.textContent = lineB;
  d.append(a, b);
  Object.assign(d.style, style);
  el.appendChild(d);
}

function rebuild(map, host) {
  const printing = document.body.classList.contains('printing');
  const band = printing
    ? intervalForPrintRf(getPrintRf(DEFAULT_RF))
    : intervalForZoom(map.getZoom());
  const step = band.meters;
  if (!step || band.hidden || band.gzdOnly) {
    host.replaceChildren();
    return;
  }

  const box = sheetMap(map);
  if (!box) return;
  const { mw, mh } = box;

  const c = map.getCenter();
  const zone = utmZone(c.lng);
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
  const edge = 10;

  for (let e = snapUp(minE, step); e <= maxE; e += step) {
    const pTop = utmToLatLon(zone, e, nw.northing, north);
    const pBot = utmToLatLon(zone, e, sw.northing, north);
    const top = map.project([pTop.lon, pTop.lat]);
    const bot = map.project([pBot.lon, pBot.lat]);
    if (top.x < 56 || top.x > mw - 56) continue;
    const principal = Math.abs(e - firstE) % 10000 < 1 || e === firstE;
    const thick = principal ? '0.9pt' : '0.6pt';
    tick(host, {
      left: box.x(top.x),
      top: box.y(0),
      width: thick,
      height: `${INN_PX}px`,
    });
    tick(host, {
      left: box.x(bot.x),
      top: box.y(mh - INN_PX),
      width: thick,
      height: `${INN_PX}px`,
    });
    const digits = edgeLabel(e, step);
    labPrefixed(host, squareLettersFromUtm(zone, e, nw.northing), digits, {
      left: box.x(top.x),
      top: box.y(-14),
      fontSize: '7pt',
      transform: 'translateX(-50%)',
    });
    labPrefixed(host, squareLettersFromUtm(zone, e, sw.northing), digits, {
      left: box.x(bot.x),
      top: box.y(mh - 12),
      fontSize: '7pt',
      transform: 'translateX(-50%)',
    });
  }

  for (let n = snapUp(minN, step); n <= maxN; n += step) {
    const pL = utmToLatLon(zone, nw.easting, n, north);
    const pR = utmToLatLon(zone, ne.easting, n, north);
    const left = map.project([pL.lon, pL.lat]);
    const right = map.project([pR.lon, pR.lat]);
    if (left.y < 40 || left.y > mh - 40) continue;
    const principal = Math.abs(n - firstN) % 10000 < 1 || n === firstN;
    const thick = principal ? '0.9pt' : '0.6pt';
    tick(host, {
      top: box.y(left.y),
      left: box.x(0),
      height: thick,
      width: `${INN_PX}px`,
    });
    tick(host, {
      top: box.y(right.y),
      left: box.x(mw - INN_PX),
      height: thick,
      width: `${INN_PX}px`,
    });
    const digits = edgeLabel(n, step);
    labPrefixed(host, squareLettersFromUtm(zone, nw.easting, n), digits, {
      left: box.x(-4),
      top: box.y(left.y),
      fontSize: '7pt',
      transform: 'translate(-100%, -50%)',
    });
    labPrefixed(host, squareLettersFromUtm(zone, ne.easting, n), digits, {
      left: box.x(mw + 4),
      top: box.y(right.y),
      fontSize: '7pt',
      transform: 'translateY(-50%)',
    });
  }

  // Same two-line block at SW and NE: geographic DMS + UTM metres.
  cornerBlock(host, dms(b.getSouth(), 'N', 'S'), utmCornerText(sw.easting, 'E'), {
    left: box.x(4),
    top: box.y(mh - 28),
    fontSize: '6pt',
  });
  cornerBlock(host, dms(b.getNorth(), 'N', 'S'), utmCornerText(ne.easting, 'E'), {
    left: box.x(mw - 72),
    top: box.y(4),
    fontSize: '6pt',
    textAlign: 'right',
  });
  lab(host, dms(b.getWest(), 'E', 'W'), {
    left: box.x(4),
    top: box.y(-14),
    fontSize: '6pt',
    color: '#4A4036',
  });
  lab(host, dms(b.getEast(), 'E', 'W'), {
    left: box.x(mw - 72),
    top: box.y(-14),
    fontSize: '6pt',
    color: '#4A4036',
  });
  lab(host, utmCornerText(nw.northing, 'N'), {
    left: box.x(4),
    top: box.y(4),
    fontSize: '6pt',
  });
  lab(host, utmCornerText(se.northing, 'N'), {
    left: box.x(mw - 72),
    top: box.y(mh - 14),
    fontSize: '6pt',
  });
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
