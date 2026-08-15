import { t, formatScaleRatio, roundToNice } from './copy.js';

/**
 * Meters per CSS pixel at the map center, from MapLibre's transform
 * (unproject a 100 px span and divide).
 */
export function metersPerPixelAtCenter(map) {
  const canvas = map.getCanvas();
  const x = canvas.clientWidth / 2;
  const y = canvas.clientHeight / 2;
  const left = map.unproject([x - 50, y]);
  const right = map.unproject([x + 50, y]);
  const meters = left.distanceTo(right);
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return meters / 100;
}

/** Ground width in metres of the viewport-fixed print frame (or 7.74in fallback). */
export function mapFrameGroundWidth(map) {
  const frame = document.getElementById('print-frame');
  const canvas = map.getCanvas();
  if (frame && canvas) {
    const fr = frame.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    if (fr.width > 8 && cr.width > 8) {
      const y = fr.top + fr.height / 2 - cr.top;
      const left = map.unproject([fr.left - cr.left, y]);
      const right = map.unproject([fr.right - cr.left, y]);
      const meters = left.distanceTo(right);
      if (Number.isFinite(meters) && meters > 0) return meters;
    }
  }
  const mpp = metersPerPixelAtCenter(map);
  if (mpp == null) return null;
  return mpp * 7.74 * 96;
}

/**
 * Print / HUD RF: groundWidth / (7.74in in metres), then roundToNice.
 */
export function computePrintScale(map) {
  const ground = mapFrameGroundWidth(map);
  if (ground == null) {
    return { rf: null, text: '', metersPerPixel: null, groundWidth: null };
  }
  const rf = ground / (7.74 * 0.0254);
  const nice = roundToNice(rf);
  const mpp = metersPerPixelAtCenter(map);
  return {
    rf: nice,
    rawRf: rf,
    text: formatScaleRatio(nice),
    metersPerPixel: mpp,
    groundWidth: ground,
  };
}

export function computeScale(map) {
  return computePrintScale(map);
}

/**
 * Print principal grid from RF (not screen zoom).
 * RF ≥ 1:75 000 → 10 km; 1:25 000–1:74 999 → 1 km; ≤ 1:24 999 → 100 m.
 */
export function intervalForPrintRf(rf) {
  const n = Number(rf);
  if (!Number.isFinite(n) || n >= 75000) {
    return { meters: 10000, accuracy: 1, id: '10k', labelKey: 'print.gridInterval.10k' };
  }
  if (n >= 25000) {
    return { meters: 1000, accuracy: 2, id: '1k', labelKey: 'print.gridInterval.1k' };
  }
  return { meters: 100, accuracy: 3, id: '100m', labelKey: 'print.gridInterval.100m' };
}

const NICE_BAR = [];
for (let exp = 0; exp < 8; exp += 1) {
  for (const c of [1, 2, 5]) NICE_BAR.push(c * 10 ** exp);
}

export function pickScaleBar(mpp, maxPx, minFrac = 0.6, maxFrac = 0.95) {
  if (mpp == null || mpp <= 0) return null;
  let best = NICE_BAR[0];
  for (const m of NICE_BAR) {
    const px = m / mpp;
    if (px <= maxPx * maxFrac) best = m;
    if (px >= maxPx * minFrac && px <= maxPx * maxFrac) best = m;
  }
  const width = Math.max(24, Math.min(maxPx, best / mpp));
  const segs = 5;
  return { totalM: best, widthPx: width, segs };
}

function formatBarMeters(m) {
  if (m >= 1000) return `${m / 1000} km`;
  return `${m} m`;
}

function renderSegmentTrack(el, segs) {
  let track = el.querySelector('.scale-bar-track');
  if (!track) {
    track = document.createElement('span');
    track.className = 'scale-bar-track';
    el.insertBefore(track, el.firstChild);
  }
  track.replaceChildren();
  for (let i = 0; i < segs; i += 1) {
    const bit = document.createElement('i');
    bit.className = i % 2 === 0 ? 'seg-ink' : 'seg-paper';
    track.appendChild(bit);
  }
}

function renderScaleBar(el, mpp) {
  if (!el || mpp == null) return;
  const picked = pickScaleBar(mpp, 148);
  if (!picked) return;
  el.hidden = false;
  el.style.width = `${picked.widthPx}px`;
  const label = formatBarMeters(picked.totalM);
  el.dataset.label = label;
  renderSegmentTrack(el, picked.segs);
  const cap = el.querySelector('.scale-bar-label');
  if (cap) cap.textContent = label;
}

export function renderPrintScaleBar(el, mpp) {
  if (!el || mpp == null) return;
  const maxPx = 1.84 * 96;
  const picked = pickScaleBar(mpp, maxPx);
  if (!picked) {
    el.replaceChildren();
    return;
  }
  el.style.width = `${picked.widthPx}px`;
  const track = document.createElement('div');
  track.className = 'psb-track';
  for (let i = 0; i < picked.segs; i += 1) {
    const bit = document.createElement('i');
    bit.className = i % 2 === 0 ? 'seg-ink' : 'seg-paper';
    track.appendChild(bit);
  }
  const labels = document.createElement('div');
  labels.className = 'psb-labels';
  const zero = document.createElement('span');
  zero.textContent = '0';
  const end = document.createElement('span');
  end.textContent = formatBarMeters(picked.totalM);
  labels.append(zero, end);
  el.replaceChildren(track, labels);
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {HTMLElement} el
 */
export function attachScaleReadout(map, el) {
  const bar = document.getElementById('scale-bar');
  const render = () => {
    const { text, metersPerPixel } = computeScale(map);
    if (el && text) {
      el.textContent = text;
      el.setAttribute('aria-label', t('chrome.scaleLabel'));
    }
    renderScaleBar(bar, metersPerPixel);
  };
  map.on('load', render);
  map.on('move', render);
  map.on('zoom', render);
  map.on('resize', render);
  if (map.loaded()) render();
  return render;
}
