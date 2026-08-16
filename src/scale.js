import { t, formatScaleRatio, roundToNice } from './copy.js';
import { orientGridNorth } from './north.js';
import {
  RF_PRESETS,
  DEFAULT_RF,
  isPresetRf,
  getLockedRf,
  getPrintRf,
  setPresetRf,
  setFreeRf,
  parseRfInput,
} from './rf.js';

export {
  RF_PRESETS,
  DEFAULT_RF,
  isPresetRf,
  getLockedRf,
  getPrintRf,
  setPresetRf,
  setFreeRf,
  parseRfInput,
};

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

export function frameWidthPx() {
  const mapEl = document.getElementById('map');
  const live = mapEl ? (mapEl.clientWidth || mapEl.getBoundingClientRect().width) : 0;
  const printing = typeof document !== 'undefined' && document.body.classList.contains('printing');
  const off = typeof document !== 'undefined' && document.body.classList.contains('wysiwyg-off');
  if (printing && live > 0) return live;
  if (!off && live > 40) {
    try { document.body.dataset.letterMapW = String(live); } catch { /* */ }
    return live;
  }
  // Sheet Off / search must not change RF — reuse the Letter neatline width.
  const cached = typeof document !== 'undefined' ? Number(document.body.dataset.letterMapW) : 0;
  if (cached > 40) return cached;
  if (live > 0) return live;
  return 7.74 * 96;
}

/** MapLibre world is 512 CSS px at z0 (not 256). */
export const MPP_Z0 = 78271.51696402048;
export const NEATLINE_IN = 7.74;

/** Zoom that makes the 7.74 in neatline read `target` RF at `widthPx`. */
export function zoomForPrintRf(lat, widthPx, target = DEFAULT_RF) {
  const w = Number(widthPx) > 8 ? Number(widthPx) : NEATLINE_IN * 96;
  const mpp = (target * NEATLINE_IN * 0.0254) / w;
  const z = Math.log2((MPP_Z0 * Math.cos((Number(lat) * Math.PI) / 180)) / mpp);
  if (!Number.isFinite(z)) return 13;
  return Math.min(18, Math.max(2, z));
}

export function computeViewScale(map) {
  // Same RF as the printed neatline (7.74 in) so HUD and collar match.
  return computePrintScale(map);
}

export function computeScale(map) {
  return computeViewScale(map);
}

/** Print principal grid from RF (not screen zoom). */
export function intervalForPrintRf(rf) {
  const n = Number(rf);
  if (!Number.isFinite(n) || n >= 75000) {
    return { meters: 10000, accuracy: 2, id: '10k', labelKey: 'print.gridInterval.10k' };
  }
  if (n >= 20000) {
    return { meters: 1000, accuracy: 3, id: '1k', labelKey: 'print.gridInterval.1k' };
  }
  return { meters: 100, accuracy: 4, id: '100m', labelKey: 'print.gridInterval.100m' };
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

export function buildPrintScaleBar(track, endEl, mpp, rf) {
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
  if (Number.isFinite(rf) && rf >= 15000 && rf <= 35000) total = 2000;
  const segs = 4;
  track.innerHTML = '';
  for (let i = 0; i < segs; i += 1) {
    track.appendChild(document.createElement('i'));
    if (i === 1) {
      const gap = document.createElement('i');
      gap.className = 'psb-gap';
      track.appendChild(gap);
    }
  }
  let widthPx = Math.min(maxPx, total / mpp);
  if (total === 2000 && widthPx < 0.9 * 96) widthPx = 1.6 * 96;
  track.parentElement.style.width = `${widthPx}px`;
  if (endEl) {
    endEl.textContent = total >= 1000 ? `${total / 1000} km` : `${total} m`;
  }
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {HTMLElement} el
 */
export function renderPrintScaleBar(el, mpp, rf) {
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
  buildPrintScaleBar(track, endEl, mpp, rf);
}

export function applyRfZoom(map, target) {
  const n = Number(target);
  if (!map || !Number.isFinite(n) || n < 100) return;
  const mapEl = document.getElementById('map');
  const w = (mapEl && mapEl.clientWidth) || frameWidthPx() || (NEATLINE_IN * 96);
  if (w < 8) return;
  const targetMpp = (n * NEATLINE_IN * 0.0254) / w;
  const currentMpp = metersPerPixelAtCenter(map);
  const z0 = map.getZoom();
  let z;
  if (currentMpp && currentMpp > 0 && Number.isFinite(z0)) {
    z = z0 + Math.log2(currentMpp / targetMpp);
  } else {
    z = zoomForPrintRf(map.getCenter().lat, w, n);
  }
  if (Number.isFinite(z)) map.setZoom(Math.min(18, Math.max(2, z)));
  orientGridNorth(map);
}

function syncScaleControl(liveRf) {
  const sel = document.getElementById('scale-preset');
  const input = document.getElementById('scale-free');
  if (!sel) return;
  if (isPresetRf()) {
    const rf = getLockedRf();
    const match = RF_PRESETS.includes(rf) ? String(rf) : 'free';
    sel.value = match;
    if (input) {
      input.hidden = match !== 'free';
      input.value = formatScaleRatio(rf);
    }
    return;
  }
  sel.value = 'free';
  if (input) {
    input.hidden = false;
    if (document.activeElement !== input) {
      const n = Number.isFinite(liveRf) ? liveRf : DEFAULT_RF;
      input.value = formatScaleRatio(n);
    }
  }
}

export function attachScaleControl(map) {
  const sel = document.getElementById('scale-preset');
  const input = document.getElementById('scale-free');
  if (!sel) return;
  const applyPreset = (rf) => {
    setPresetRf(rf);
    applyRfZoom(map, rf);
    syncScaleControl(rf);
  };
  sel.addEventListener('change', () => {
    if (sel.value === 'free') {
      setFreeRf();
      syncScaleControl(computeViewScale(map).rawRf);
      return;
    }
    applyPreset(Number(sel.value));
  });
  if (input) {
    const commit = () => {
      const n = parseRfInput(input.value);
      if (!n) {
        syncScaleControl(computeViewScale(map).rawRf);
        return;
      }
      if (RF_PRESETS.includes(n)) {
        applyPreset(n);
        return;
      }
      setFreeRf();
      applyRfZoom(map, n);
      input.value = formatScaleRatio(n);
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit();
      }
    });
    input.addEventListener('blur', commit);
  }
  syncScaleControl(DEFAULT_RF);
}

export function attachScaleReadout(map, el) {
  const bar = document.getElementById('scale-bar');
  const render = () => {
    const view = computeViewScale(map);
    const rf = getPrintRf(view.rf);
    const text = formatScaleRatio(rf) || view.text;
    if (el && text) {
      el.textContent = text;
      el.setAttribute('aria-label', t('chrome.scaleLabel'));
    }
    renderScaleBar(bar, view.metersPerPixel);
    syncScaleControl(view.rawRf);
  };
  map.on('load', render);
  map.on('move', render);
  map.on('zoom', render);
  map.on('resize', render);
  if (map.loaded()) render();
  return render;
}
