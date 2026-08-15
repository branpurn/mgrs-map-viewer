import { COPY, formatScaleRatio } from './copy.js';

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

function roundRf(rf) {
  if (rf >= 100000) return Math.round(rf / 5000) * 5000;
  if (rf >= 20000) return Math.round(rf / 1000) * 1000;
  if (rf >= 5000) return Math.round(rf / 500) * 500;
  if (rf >= 1000) return Math.round(rf / 100) * 100;
  if (rf >= 100) return Math.round(rf / 10) * 10;
  return Math.round(rf);
}

export function computeScale(map) {
  const mpp = metersPerPixelAtCenter(map);
  if (mpp == null) {
    return { rf: null, text: '', metersPerPixel: null };
  }
  // 1 CSS px ≈ 1/96 in; 1 in = 0.0254 m. RF = ground / paper.
  const rf = (mpp * 96) / 0.0254;
  const nice = roundRf(rf);
  return {
    rf: nice,
    text: formatScaleRatio(nice),
    metersPerPixel: mpp,
  };
}

/**
 * Ground width of the printed neatline (7.74 in) at the current view.
 * Used to freeze a print RF if needed; screen readout uses computeScale.
 */
export function computePrintScale(map, frameWidthIn = 7.74) {
  const mpp = metersPerPixelAtCenter(map);
  if (mpp == null) return computeScale(map);
  const framePx = frameWidthIn * 96;
  const groundM = mpp * framePx;
  const rf = groundM / (frameWidthIn * 0.0254);
  const nice = roundRf(rf);
  return { rf: nice, text: formatScaleRatio(nice), metersPerPixel: mpp };
}

function renderScaleBar(el, mpp) {
  if (!el || mpp == null) return;
  const maxPx = 140;
  const maxM = mpp * maxPx;
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  let meters = nice[0];
  for (const n of nice) {
    if (n / mpp <= maxPx) meters = n;
  }
  const width = Math.max(24, meters / mpp);
  el.hidden = false;
  el.style.width = `${width}px`;
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  el.dataset.label = label;
  const cap = el.querySelector('.scale-bar-label');
  if (cap) cap.textContent = label;
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {HTMLElement} el
 */
export function attachScaleReadout(map, el) {
  const bar = document.getElementById('scale-bar');
  const render = () => {
    const { text, metersPerPixel } = computeScale(map);
    if (text) {
      el.textContent = text;
      el.setAttribute('aria-label', COPY.chrome.scaleLabel);
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
