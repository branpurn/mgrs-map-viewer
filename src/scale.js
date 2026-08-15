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

function frameWidthPx() {
  const frame = document.getElementById('print-frame');
  if (frame) {
    const w = frame.getBoundingClientRect().width;
    if (w > 0) return w;
  }
  return 7.74 * 96;
}

export function computeScale(map) {
  return computePrintScale(map);
}

/** Print principal grid from RF (not screen zoom). */
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

/**
 * Ground width of the printed neatline (7.74 in) at the current view.
 */
export function computePrintScale(map, frameWidthIn = 7.74) {
  const mpp = metersPerPixelAtCenter(map);
  if (mpp == null) {
    return { rf: null, rawRf: null, text: '', metersPerPixel: null, groundWidthMeters: null };
  }
  const framePx = frameWidthPx();
  const groundM = mpp * framePx;
  const rawRf = groundM / (frameWidthIn * 0.0254);
  const nice = roundToNice(rawRf);
  return {
    rf: nice,
    rawRf,
    text: formatScaleRatio(nice),
    metersPerPixel: mpp,
    groundWidthMeters: groundM,
  };
}

function renderScaleBar(el, mpp) {
  if (!el || mpp == null) return;
  const maxPx = 140;
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  let meters = nice[0];
  for (const n of nice) {
    if (n / mpp <= maxPx) meters = n;
  }
  const width = Math.max(24, Math.min(148, meters / mpp));
  el.hidden = false;
  el.style.width = `${width}px`;
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  el.dataset.label = label;
  const track = el.querySelector('.scale-bar-track');
  if (track) {
    track.replaceChildren();
    for (let i = 0; i < 5; i += 1) track.appendChild(document.createElement('i'));
  }
  const cap = el.querySelector('.scale-bar-label');
  if (cap) cap.textContent = label;
}

export function buildPrintScaleBar(track, endEl, mpp) {
  if (!track || mpp == null) return;
  const maxPx = 1.84 * 96;
  const maxM = mpp * maxPx;
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  let total = nice[0];
  for (const n of nice) {
    const px = n / mpp;
    if (px <= maxPx * 0.95 && n >= maxM * 0.6) {
      total = n;
      break;
    }
    if (px <= maxPx) total = n;
  }
  const segs = 4;
  track.innerHTML = '';
  for (let i = 0; i < segs; i += 1) {
    track.appendChild(document.createElement('i'));
  }
  const widthPx = Math.min(maxPx, total / mpp);
  track.parentElement.style.width = `${widthPx}px`;
  if (endEl) {
    endEl.textContent = total >= 1000 ? `${total / 1000} km` : `${total} m`;
  }
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {HTMLElement} el
 */
export function renderPrintScaleBar(el, mpp) {
  if (!el || mpp == null) return;
  let track = el.querySelector('#print-scale-track') || el.querySelector('.psb-track');
  let labels = el.querySelector('.psb-labels');
  if (!track) {
    track = document.createElement('div');
    track.className = 'psb-track';
    track.id = 'print-scale-track';
    el.appendChild(track);
  }
  if (!labels) {
    labels = document.createElement('div');
    labels.className = 'psb-labels';
    const zero = document.createElement('span');
    zero.textContent = '0';
    const end = document.createElement('span');
    end.id = 'print-scale-end';
    labels.append(zero, end);
    el.appendChild(labels);
  }
  const endEl = el.querySelector('#print-scale-end') || labels.lastElementChild;
  buildPrintScaleBar(track, endEl, mpp);
}

export function attachScaleReadout(map, el) {
  const bar = document.getElementById('scale-bar');
  const render = () => {
    const { text, metersPerPixel } = computePrintScale(map);
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
