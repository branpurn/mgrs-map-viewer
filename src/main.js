import { t, applyStaticCopy } from './copy.js';
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
  isGridAvailable,
  setPrintInterval,
  utmZone,
} from './mgrs-grid.js';
import {
  attachScaleReadout,
  computePrintScale,
  computeViewScale,
  intervalForPrintRf,
  buildPrintScaleBar,
  renderPrintScaleBar,
} from './scale.js';
import { attachSearch } from './search.js';
import { attachCollarTicks } from './ticks.js';

const TITLE_MAX = 28;

const state = {
  lastInterval: null,
  lastAccuracy: 2,
  lastScaleText: '',
  lastMgrs: '',
  lastLabel: 'Washington, District of Columbia',
  exampleLocked: true,
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

function isLatLonLabel(s) {
  const v = String(s || '').trim();
  if (!v) return false;
  if (/^-?\d+(?:\.\d+)?\s*[,;\s]\s*-?\d+(?:\.\d+)?$/.test(v)) return true;
  if (/^-?\d+(?:\.\d+)?\s*[NSns]\s*[,;\s]\s*-?\d+(?:\.\d+)?\s*[EWew]$/.test(v)) return true;
  return false;
}

function sheetTitle(square) {
  const raw = String(state.lastLabel || '').trim();
  if (raw && !isLatLonLabel(raw)) return truncateTitle(raw);
  if (square) return truncateTitle(square);
  return t('lbl.untitled');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value == null ? '' : String(value);
}

function applyChromeCopy() {
  applyStaticCopy(document);
  setText('app-name', t('app.name'));
  document.title = t('app.documentTitle');
  setText('search-aria-label', t('search.ariaLabel'));
  const input = document.getElementById('search-input');
  if (input) {
    input.placeholder = t('ph.search');
    input.setAttribute('aria-label', t('search.ariaLabel'));
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
  setText('lbl-print-north', t('print.north.gm'));
  setText('print-gm-note', t('print.north.note'));
  setText('lbl-print-gzd', t('print.gridZone'));
  setText('lbl-print-example', t('print.example'));
  setText('print-example-place', t('print.example.place'));
  setText('print-example-grid', t('print.example.grid'));
  setText('print-example-note', t('print.example.note'));
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
  setText('print-disclaimer', `${t('app.name')} · ${t('print.attribution.notUsgs')}`);
  setText('print-attr', '');
  setText('lbl-north-grid', t('print.north.grid'));
  setText('lbl-north-true', t('print.north.true'));
  setText('lbl-north-magnetic', t('print.north.magnetic'));
  setText('print-gm-angle', `${t('print.north.gm')} 9° 30' W`);
  setText('print-gm-conv', 'convergence 1° 17\'');
  setText('grid-unavailable', t('lbl.gridUnavailable'));
  const mgrsEl = document.getElementById('center-mgrs');
  if (mgrsEl) mgrsEl.setAttribute('aria-label', t('chrome.mgrsAria'));
}

function formatConvergence(lon, lat) {
  const zone = utmZone(lon);
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const phi = (lat * Math.PI) / 180;
  const dLon = ((lon - lon0) * Math.PI) / 180;
  const deg = (Math.atan(Math.tan(dLon) * Math.sin(phi)) * 180) / Math.PI;
  if (!Number.isFinite(deg)) return "convergence 1° 17'";
  const abs = Math.abs(deg);
  let d = Math.floor(abs);
  let m = Math.round((abs - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  return `convergence ${d}° ${m}'`;
}

let sheetLayoutBusy = false;
let lastSheetBox = '';

function layoutSheet(map) {
  const desk = document.getElementById('desk');
  const sheet = document.getElementById('sheet');
  if (!desk || !sheet || document.body.classList.contains('printing')) return;
  if (sheetLayoutBusy) return;
  const hud = document.getElementById('hud');
  const dock = document.getElementById('zoom-dock');
  const hudW = hud && !hud.hidden ? hud.offsetWidth : 168;
  const hudH = hud && !hud.hidden ? hud.offsetHeight : 88;
  const zoomW = 36;
  const zoomH = 74;
  const leftReserve = Math.max(36, 18 + zoomW);
  const rightReserve = Math.max(36, 18 + hudW);
  const topReserve = 24;
  const bottomReserve = 24;
  const r = desk.getBoundingClientRect();
  const availW = Math.max(40, r.width - leftReserve - rightReserve);
  const availH = Math.max(40, r.height - topReserve - bottomReserve);
  const natW = 8.5 * 96;
  const natH = 11 * 96;
  const scale = Math.min(availW / natW, availH / natH, 1);
  const w = natW * scale;
  const h = natH * scale;
  const x = leftReserve + (availW - w) / 2;
  const y = topReserve + (availH - h) / 2;
  const box = `${Math.round(w)}x${Math.round(h)}@${Math.round(x)},${Math.round(y)}`;
  if (box === lastSheetBox) return;
  lastSheetBox = box;
  sheet.style.width = `${Math.round(w)}px`;
  sheet.style.height = `${Math.round(h)}px`;
  sheet.style.left = `${Math.round(x)}px`;
  sheet.style.top = `${Math.round(y)}px`;
  sheet.style.transform = 'none';
  sheet.style.aspectRatio = 'auto';
  if (hud) {
    hud.style.right = '18px';
    hud.style.bottom = '18px';
    hud.style.left = 'auto';
    hud.style.top = 'auto';
  }
  if (dock) {
    dock.style.left = '18px';
    dock.style.bottom = '18px';
    dock.style.top = 'auto';
  }
  if (map) {
    sheetLayoutBusy = true;
    try { map.resize(); } catch { /* first layout */ }
    sheetLayoutBusy = false;
  }
}

function setZoomForPrintRf(map, target = 24000) {
  const mapEl = document.getElementById('map');
  const w = (mapEl && mapEl.clientWidth)
    || (map.getCanvas() && map.getCanvas().clientWidth)
    || 7.74 * 96;
  const groundM = 7.74 * 0.0254 * target;
  const mpp = groundM / Math.max(1, w);
  const lat = map.getCenter().lat;
  const z = Math.log2((156543.03392804097 * Math.cos((lat * Math.PI) / 180)) / mpp);
  if (Number.isFinite(z)) map.setZoom(Math.min(18, Math.max(2, z)));
}

function setMgrsReadout(text, polar = false) {
  const el = document.getElementById('center-mgrs');
  const unavail = document.getElementById('grid-unavailable');
  if (!el) return;
  if (polar || !text) {
    el.textContent = polar ? t('lbl.gridUnavailable') : '';
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


function fillPrintBlock(map) {
  const view = computeViewScale(map);
  const scale = computePrintScale(map);
  const rf = view.rf || scale.rf;
  const text = view.text || scale.text;
  state.lastScaleText = text;
  const rfBand = intervalForPrintRf(rf);
  const square = centerMgrs(map, rfBand.accuracy);
  const title = sheetTitle(square);
  setText('print-title', title);
  setText('print-title-upper', title);
  setText('print-upper-title', title);
  setText('print-scale', text);
  setText('print-grid-value', t('print.gridValue'));
  setText('print-datum-value', t('print.datumValue'));
  setText('print-grid-interval', t(rfBand.labelKey));
  const intervalRow = document.getElementById('print-grid-interval-row');
  if (intervalRow) intervalRow.hidden = !!state.polar;
  setText('print-date', formatPrintedDate());
  setText('print-attr', '');
  setText('print-product', t('app.name'));
  setText('print-sheet-value', t('print.sheetValue'));
  setText('print-disclaimer', `${t('app.name')} · ${t('print.attribution.notUsgs')}`);
  const gzd = String(square || '').trim().split(/\s+/)[0] || '';
  setText('print-gzd', gzd ? t('print.gridZoneValue', { gzd }) : '');
  const c = map.getCenter();
  setText('print-gm-angle', `${t('print.north.gm')} 9° 30' W`);
  setText('print-gm-conv', formatConvergence(c.lng, c.lat));
  if (state.exampleLocked) {
    setText('print-example-place', t('print.example.place'));
    setText('print-example-grid', t('print.example.grid'));
  } else {
    setText('print-example-place', title);
    setText('print-example-grid', square || '');
  }
  renderPrintScaleBar(document.getElementById('print-scale-bar'), scale.metersPerPixel, rf);
  return rfBand;
}

function attachPrint(map) {
  const btn = document.getElementById('print-btn');
  if (!btn) return;
  btn.setAttribute('type', 'button');
  btn.removeAttribute('form');

  let fromButton = false;
  const nativePrint = window.__mgrsNativePrint || window.print.bind(window);
  window.print = function mgrsPrintGuard() {
    if (!fromButton && !window.__mgrsAllowPrint) return;
    nativePrint();
  };

  const prepare = () => {
    document.body.classList.add('printing');
    try { map.resize(); } catch { /* print size */ }
    setZoomForPrintRf(map, 24000);
    const scale = computeViewScale(map);
    setPrintInterval(intervalForPrintRf(scale.rf || 24000));
    fillPrintBlock(map);
    const compact = centerMgrsCompact(map, precisionForZoom(map.getZoom()));
    document.title = printFilename(compact);
  };

  const restore = () => {
    fromButton = false;
    window.__mgrsAllowPrint = false;
    setPrintInterval(null);
    document.body.classList.remove('printing');
    document.title = t('app.documentTitle');
    map.resize();
    layoutSheet();
  };

  window.addEventListener('beforeprint', () => {
    if (!fromButton) return;
    prepare();
  });
  window.addEventListener('afterprint', restore);

  const blockNativePrint = (ev) => {
    const key = ev.key;
    const code = ev.code;
    if ((ev.ctrlKey || ev.metaKey) && (key === 'p' || key === 'P' || code === 'KeyP')) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', blockNativePrint, true);
  document.addEventListener('keydown', blockNativePrint, true);

  btn.addEventListener('click', (ev) => {
    if (!ev.isTrusted) return;
    if (ev.target !== btn && !btn.contains(ev.target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (btn.disabled) return;
    fromButton = true;
    window.__mgrsAllowPrint = true;
    prepare();
    try {
      nativePrint();
    } catch {
      fromButton = false;
      window.__mgrsAllowPrint = false;
      const note = document.getElementById('search-note');
      if (note) {
        note.hidden = false;
        note.textContent = t('chrome.printBlocked');
        note.classList.add('is-error');
      }
    }
  });

  document.addEventListener('keydown', (ev) => {
    const key = ev.key;
    const inField = ev.target && (
      ev.target.tagName === 'INPUT'
      || ev.target.tagName === 'TEXTAREA'
      || ev.target.tagName === 'SELECT'
      || ev.target.tagName === 'BUTTON'
      || ev.target.isContentEditable
    );
    if (inField) return;
    if (key === '+' || key === '=') map.zoomIn();
    if (key === '-' || key === '_') map.zoomOut();
  });
}

async function main() {
  applyChromeCopy();
  layoutSheet();
  window.addEventListener('resize', () => layoutSheet());

  const map = await createMap('map');
  if (!map) return;
  layoutSheet(map);
  try {
    map.resize();
  } catch {
    // first layout
  }
  setZoomForPrintRf(map, 24000);
  attachCollarTicks(map);
  fillPrintBlock(map);
  if (/[?&]print=1\b/.test(location.search)) {
    const go = async () => {
      document.body.classList.add('printing');
      try { map.resize(); } catch { /* print layout */ }
      setZoomForPrintRf(map, 24000);
      fillPrintBlock(map);
      try { await map.once('idle'); } catch { /* print anyway */ }
      fillPrintBlock(map);
    };
    go();
  }

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
      state.exampleLocked = false;
      if (info && info.kind === 'place' && info.label && !isLatLonLabel(info.label)) {
        state.lastLabel = info.label;
      } else {
        state.lastLabel = '';
      }
    },
  });
  attachPrint(map);

  const hud = () => {
    updateCenterHud(map);
    layoutSheet(map);
    fillPrintBlock(map);
  };
  map.on('load', hud);
  map.on('move', () => {
    updateCenterHud(map);
    fillPrintBlock(map);
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
