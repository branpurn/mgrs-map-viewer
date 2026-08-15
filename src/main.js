import { API_BASE, COPY } from './copy.js';
import {
  createMap,
  activeTileSource,
  OT_ATTR_PRINT,
  OSM_ATTR_PRINT,
} from './map.js';
import {
  attachMgrsGrid,
  centerMgrs,
  centerMgrsCompact,
  intervalForZoom,
  precisionForZoom,
  formatMgrs,
} from './mgrs-grid.js';
import { attachScaleReadout, computeScale } from './scale.js';
import { attachSearch } from './search.js';

const state = {
  lastInterval: null,
  lastAccuracy: 2,
  lastScaleText: '',
  lastMgrs: '',
  lastLabel: '',
  frameSet: true,
};

function formatPrintedDate(d = new Date()) {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function printFilename(mgrsCompact) {
  const day = isoDate();
  if (mgrsCompact) return `mgrs-viewer-${mgrsCompact}-${day}`;
  return `mgrs-viewer-frame-${day}`;
}

function setMgrsReadout(text) {
  const el = document.getElementById('center-mgrs');
  if (!el) return;
  if (!text) {
    el.textContent = '';
    return;
  }
  el.textContent = text;
  state.lastMgrs = text;
}

function updateCenterHud(map) {
  const acc = precisionForZoom(map.getZoom());
  const text = centerMgrs(map, acc);
  if (text) setMgrsReadout(text);
}

let convertTimer = 0;
async function refreshRemoteMgrs(map) {
  if (!API_BASE) return;
  const c = map.getCenter();
  const precision = precisionForZoom(map.getZoom());
  const url = `${API_BASE}/api/convert?lat=${encodeURIComponent(c.lat)}&lon=${encodeURIComponent(c.lng)}&precision=${encodeURIComponent(precision)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const raw = data.mgrs || data.MGRS || data.value;
    if (raw) setMgrsReadout(formatMgrs(String(raw).replace(/\s+/g, '')));
  } catch {
    // keep last good value
  }
}

function fillPrintBlock(map) {
  const title = document.getElementById('print-title');
  const scaleEl = document.getElementById('print-scale');
  const intervalEl = document.getElementById('print-grid-interval');
  const intervalRow = document.getElementById('print-grid-interval-row');
  const dateEl = document.getElementById('print-date');
  const attr = document.getElementById('print-attr');

  const z = map.getZoom();
  const band = intervalForZoom(z);
  const acc = band.accuracy <= 2 ? band.accuracy : 2;
  const square = centerMgrs(map, acc);
  if (title) title.textContent = state.lastLabel || square || COPY.app.name;
  const scale = computeScale(map);
  state.lastScaleText = scale.text;
  if (scaleEl) scaleEl.textContent = scale.text;
  if (intervalEl) intervalEl.textContent = band.label;
  if (intervalRow) intervalRow.hidden = false;
  if (dateEl) dateEl.textContent = formatPrintedDate();
  if (attr) {
    attr.textContent =
      activeTileSource === 'opentopomap' ? OT_ATTR_PRINT : OSM_ATTR_PRINT;
  }
}

function attachPrint(map) {
  const btn = document.getElementById('print-btn');
  if (!btn) return;

  const prepare = () => {
    document.body.classList.add('printing');
    fillPrintBlock(map);
    const compact = centerMgrsCompact(map, precisionForZoom(map.getZoom()));
    document.title = printFilename(compact);
    map.resize();
  };

  const restore = () => {
    document.body.classList.remove('printing');
    document.title = COPY.app.documentTitle;
    map.resize();
  };

  window.addEventListener('beforeprint', prepare);
  window.addEventListener('afterprint', restore);

  btn.addEventListener('click', async () => {
    if (!state.frameSet) {
      const note = document.getElementById('search-note');
      if (note) {
        note.hidden = false;
        note.textContent = COPY.print.guardNoFrame;
        note.classList.add('is-error');
      }
      return;
    }
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = COPY.chrome.printing;
    prepare();
    try {
      await map.once('idle');
    } catch {
      // print anyway
    }
    try {
      window.print();
    } catch {
      const note = document.getElementById('search-note');
      if (note) {
        note.hidden = false;
        note.textContent = COPY.chrome.printBlocked;
        note.classList.add('is-error');
      }
    }
    btn.textContent = prev;
    btn.disabled = false;
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'p' || ev.key === 'P') {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
      ev.preventDefault();
      btn.click();
    }
    if (ev.key === '+' || ev.key === '=') {
      if (ev.target && ev.target.tagName === 'INPUT') return;
      map.zoomIn();
    }
    if (ev.key === '-' || ev.key === '_') {
      if (ev.target && ev.target.tagName === 'INPUT') return;
      map.zoomOut();
    }
  });
}

async function main() {
  const map = await createMap('map');
  if (!map) return;

  const scaleEl = document.getElementById('scale-readout');

  state.lastInterval = intervalForZoom(map.getZoom());

  attachMgrsGrid(map, ({ interval, accuracy }) => {
    state.lastInterval = { meters: interval, accuracy };
    state.lastAccuracy = accuracy;
  });
  attachScaleReadout(map, scaleEl);
  attachSearch(map, {
    onLocate: (info) => {
      state.frameSet = true;
      if (info.label) {
        const compact = String(info.mgrs || info.label).replace(/\s+/g, '');
        state.lastLabel = info.mgrs ? formatMgrs(compact) : info.label;
      }
    },
  });
  attachPrint(map);

  const hud = () => updateCenterHud(map);
  map.on('load', hud);
  map.on('move', hud);
  map.on('moveend', () => {
    window.clearTimeout(convertTimer);
    convertTimer = window.setTimeout(() => refreshRemoteMgrs(map), 120);
  });
  if (map.loaded()) hud();

}

main().catch((err) => {
  const status = document.getElementById('map-status');
  const text = status && status.querySelector('.status-text');
  if (status) {
    status.hidden = false;
    if (text) text.textContent = COPY.chrome.tilesFailed;
    else status.textContent = COPY.chrome.tilesFailed;
  }
  const retry = document.getElementById('tile-retry');
  if (retry) retry.hidden = false;
  console.error(err);
});
