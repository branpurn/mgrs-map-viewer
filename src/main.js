import { API_BASE, t, applyStaticCopy } from './copy.js';
import {
  createMap,
  activeTileSource,
  attrPrint,
} from './map.js';
import {
  attachMgrsGrid,
  centerMgrs,
  centerMgrsCompact,
  intervalForZoom,
  precisionForZoom,
  formatMgrs,
  isGridAvailable,
  setPrintInterval,
} from './mgrs-grid.js';
import {
  attachScaleReadout,
  computePrintScale,
  intervalForPrintRf,
  buildPrintScaleBar,
  renderPrintScaleBar,
} from './scale.js';
import { attachSearch } from './search.js';

const TITLE_MAX = 28;

const state = {
  lastInterval: null,
  lastAccuracy: 2,
  lastScaleText: '',
  lastMgrs: '',
  lastLabel: '',
  polar: false,
  gridHidden: false,
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

function truncateTitle(raw) {
  const s = String(raw || '').trim() || t('lbl.untitled');
  if (s.length <= TITLE_MAX) return s;
  return `${s.slice(0, TITLE_MAX - 1)}…`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value == null ? '' : String(value);
}

function applyChromeCopy() {
  applyStaticCopy(document);
  setText('app-name', t('app.name'));
  setText('search-aria-label', t('search.ariaLabel'));
  const input = document.getElementById('search-input');
  if (input) {
    input.placeholder = t('ph.search');
    input.setAttribute('aria-label', t('search.ariaLabel'));
    input.title = t('search.examples');
  }
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) {
    clearBtn.textContent = t('search.clear');
    clearBtn.setAttribute('aria-label', t('search.ariaClear'));
  }
  const submit = document.getElementById('search-submit');
  if (submit) {
    submit.textContent = t('search.submit');
    submit.setAttribute('aria-label', t('search.ariaSubmit'));
  }
  const printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.textContent = t('chrome.print');
    printBtn.title = t('chrome.printTitle');
    printBtn.setAttribute('aria-label', t('chrome.ariaPrint'));
  }
  setText('search-helper', t('search.helper'));
  setText('formats-heading', t('search.formats.heading'));
  setText('fmt-mgrs100', t('search.formats.mgrs100'));
  setText('fmt-mgrs1k', t('search.formats.mgrs1k'));
  setText('fmt-mgrs10k', t('search.formats.mgrs10k'));
  setText('fmt-decimal', t('search.formats.decimal'));
  setText('fmt-dms', t('search.formats.dms'));
  setText('fmt-place', t('search.formats.place'));
  const retry = document.getElementById('tile-retry');
  if (retry) retry.textContent = t('chrome.retry');
  const noWeb = document.getElementById('no-webgl');
  if (noWeb) {
    const p = noWeb.querySelector('p') || noWeb;
    p.textContent = t('chrome.noWebGL');
  }
  setText('print-product', t('lbl.product'));
  setText('print-series', t('print.series'));
  setText('print-subtitle', t('print.subtitle'));
  setText('lbl-print-scale', t('print.scale'));
  setText('lbl-print-grid', t('print.grid'));
  setText('print-grid-value', t('print.gridValue'));
  setText('lbl-print-grid-interval', t('print.gridInterval'));
  setText('lbl-print-datum', t('print.datum'));
  setText('print-datum-value', t('print.datumValue'));
  setText('lbl-print-projection', t('print.projection'));
  setText('print-projection-value', t('print.projectionValue'));
  setText('lbl-print-north', t('print.north'));
  setText('lbl-print-true-north', t('print.northTrue'));
  setText('lbl-print-legend', t('print.legend'));
  setText('leg-roads', t('print.legend.roads'));
  setText('leg-water', t('print.legend.water'));
  setText('leg-contours', t('print.legend.contours'));
  setText('leg-grid', t('print.legend.grid'));
  setText('leg-places', t('print.legend.places'));
  setText('leg-relief', t('print.legend.relief'));
  setText('lbl-print-printed', t('print.printed'));
  setText('lbl-print-sheet', t('print.sheet'));
  setText('print-sheet-value', t('print.sheetValue'));
  setText('print-disclaimer', t('print.disclaimer'));
  setText('grid-unavailable', t('chrome.gridUnavailable'));
  const mgrsEl = document.getElementById('center-mgrs');
  if (mgrsEl) mgrsEl.setAttribute('aria-label', t('chrome.mgrsAria'));
}

function layoutPrintFrame() {
  const frame = document.getElementById('print-frame');
  if (!frame || frame.hidden) return;
  const toolbar = 48;
  const inset = 24;
  const zoomW = 36 + 16;
  const hud = document.getElementById('hud');
  const hudH = hud && !hud.hidden ? hud.getBoundingClientRect().height : 88;
  const hudW = hud && !hud.hidden ? hud.getBoundingClientRect().width : 168;
  const top = toolbar + inset;
  const left = inset;
  const right = inset;
  const bottom = Math.max(inset, 16 + hudH + inset, 16 + 74 + inset);
  const availW = Math.max(40, window.innerWidth - left - right);
  const availH = Math.max(40, window.innerHeight - top - bottom);
  const ar = 7.74 / 8.14;
  let w = availW;
  let h = w / ar;
  if (h > availH) {
    h = availH;
    w = h * ar;
  }
  const x = left + (availW - w) / 2;
  const y = top + (availH - h) / 2;
  frame.style.position = 'fixed';
  frame.style.top = `${Math.round(y)}px`;
  frame.style.left = `${Math.round(x)}px`;
  frame.style.width = `${Math.round(w)}px`;
  frame.style.height = `${Math.round(h)}px`;
  frame.style.right = 'auto';
  frame.style.bottom = 'auto';
  frame.style.margin = '0';
  frame.style.pointerEvents = 'none';
  void hudW;
  void zoomW;
}

function setMgrsReadout(text, polar = false) {
  const el = document.getElementById('center-mgrs');
  const unavail = document.getElementById('grid-unavailable');
  if (!el) return;
  if (polar || !text) {
    el.textContent = polar ? t('chrome.gridUnavailable') : '';
    el.classList.toggle('is-unavailable', polar);
    if (unavail) unavail.hidden = true;
    if (polar) state.lastMgrs = '';
    return;
  }
  el.classList.remove('is-unavailable');
  el.textContent = `${t('chrome.mgrsLabel')}  ${text}`;
  state.lastMgrs = text;
}

function updateCenterHud(map) {
  const z = map.getZoom();
  const band = intervalForZoom(z);
  const lat = map.getCenter().lat;
  const polar = !isGridAvailable(lat);
  state.polar = polar;
  state.gridHidden = band.hidden || polar;
  const acc = precisionForZoom(z);
  const text = polar || band.hidden ? '' : centerMgrs(map, acc);
  setMgrsReadout(text, polar);

  const bandEl = document.getElementById('hud-zoom-interval');
  if (bandEl) {
    if (band.hidden || polar) {
      bandEl.textContent = `z${Math.floor(z)}`;
    } else {
      const label = band.labelKey ? t(band.labelKey) : '';
      bandEl.textContent = `z${Math.floor(z)}\u202f${label}`;
    }
  }
}

let convertTimer = 0;
async function refreshRemoteMgrs(map) {
  if (!API_BASE) return;
  const c = map.getCenter();
  if (!isGridAvailable(c.lat)) return;
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
  const scale = computePrintScale(map);
  state.lastScaleText = scale.text;
  const rfBand = intervalForPrintRf(scale.rf);
  const square = centerMgrs(map, rfBand.accuracy);
  const title = truncateTitle(state.lastLabel || square || t('lbl.untitled'));
  setText('print-title', title);
  setText('print-title-upper', title);
  setText('print-upper-title', title);
  setText('print-scale', scale.text);
  setText('print-grid-interval', t(rfBand.labelKey));
  const intervalRow = document.getElementById('print-grid-interval-row');
  if (intervalRow) intervalRow.hidden = !!state.polar;
  setText('print-date', formatPrintedDate());
  setText('print-attr', attrPrint());
  setText('print-product', t('app.name'));
  setText('print-sheet-value', t('print.sheetValue'));
  renderPrintScaleBar(document.getElementById('print-scale-bar'), scale.metersPerPixel);
  return rfBand;
}

function attachPrint(map) {
  const btn = document.getElementById('print-btn');
  if (!btn) return;

  const prepare = () => {
    document.body.classList.add('printing');
    fillPrintBlock(map);
    const scale = computePrintScale(map);
    setGridPrintMode(intervalForPrintRf(scale.rf));
    const compact = centerMgrsCompact(map, precisionForZoom(map.getZoom()));
    document.title = printFilename(compact);
    map.resize();
  };

  const restore = () => {
    setGridPrintMode(null);
    document.body.classList.remove('printing');
    document.title = t('app.documentTitle');
    map.resize();
    layoutPrintFrame();
  };

  window.addEventListener('beforeprint', prepare);
  window.addEventListener('afterprint', restore);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = t('chrome.printing');
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
        note.textContent = t('chrome.printBlocked');
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
  applyChromeCopy();
  layoutPrintFrame();
  window.addEventListener('resize', layoutPrintFrame);

  const map = await createMap('map');
  if (!map) return;

  const scaleEl = document.getElementById('scale-readout');

  state.lastInterval = intervalForZoom(map.getZoom());

  attachMgrsGrid(map, ({ interval, accuracy, hidden, polar, labelKey }) => {
    state.lastInterval = { meters: interval, accuracy, labelKey };
    state.lastAccuracy = accuracy;
    state.gridHidden = !!hidden;
    state.polar = !!polar;
    updateCenterHud(map);
  });
  attachScaleReadout(map, scaleEl);
  attachSearch(map, {
    onLocate: (info) => {
      if (info.label) {
        const compact = String(info.mgrs || info.label).replace(/\s+/g, '');
        state.lastLabel = info.mgrs ? formatMgrs(compact) : info.label;
      }
    },
  });
  attachPrint(map);

  const hud = () => {
    updateCenterHud(map);
    layoutPrintFrame();
  };
  map.on('load', hud);
  map.on('move', () => updateCenterHud(map));
  map.on('resize', layoutPrintFrame);
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
    if (text) text.textContent = t('chrome.tilesFailed');
    else status.textContent = t('chrome.tilesFailed');
  }
  const retry = document.getElementById('tile-retry');
  if (retry) retry.hidden = false;
  console.error(err);
});
