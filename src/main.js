import { t, applyStaticCopy, formatScaleRatio } from './copy.js';
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
  frameWidthPx,
} from './scale.js';
import { attachSearch } from './search.js';
import { attachCollarTicks } from './ticks.js';

if (typeof window.__mgrsNativePrint !== 'function') {
  window.__mgrsNativePrint = window.print.bind(window);
}
const REAL_PRINT = window.__mgrsNativePrint;
window.__mgrsAllowPrint = false;
window.print = function mgrsPrintDead() { return; };

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
  paintSheetToggle();
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
  setText('print-gm-angle', GM_ANGLE());
  setText('print-gm-conv', GM_CONV_FALLBACK);
  setText('grid-unavailable', t('lbl.gridUnavailable'));
  const mgrsEl = document.getElementById('center-mgrs');
  if (mgrsEl) mgrsEl.setAttribute('aria-label', t('chrome.mgrsAria'));
}

const GM_ANGLE = () => `${t('print.north.gm')} 9° 30' W`;
const GM_CONV_FALLBACK = "convergence 1° 17'";

function formatDmParts(deg) {
  if (!Number.isFinite(deg) || Math.abs(deg) > 180) return null;
  const abs = Math.abs(deg);
  let d = Math.floor(abs);
  let m = Math.round((abs - d) * 60);
  if (m === 60) {
    d += 1;
    m = 0;
  }
  if (!Number.isInteger(d) || !Number.isInteger(m) || m < 0 || m > 59 || d > 180) {
    return null;
  }
  return { d, m };
}

function formatConvergence(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return GM_CONV_FALLBACK;
  const zone = utmZone(lon);
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const phi = (lat * Math.PI) / 180;
  const dLon = ((lon - lon0) * Math.PI) / 180;
  if (!Number.isFinite(dLon) || Math.abs(dLon) > Math.PI / 2) return GM_CONV_FALLBACK;
  const deg = (Math.atan(Math.tan(dLon) * Math.sin(phi)) * 180) / Math.PI;
  const parts = formatDmParts(deg);
  if (!parts) return GM_CONV_FALLBACK;
  const out = `convergence ${parts.d}° ${parts.m}'`;
  if (!/^convergence \d{1,2}° [0-5]?\d'$/.test(out)) return GM_CONV_FALLBACK;
  return out;
}

let sheetLayoutBusy = false;
let lastSheetBox = '';
let liveMap = null;
/** User Sheet preference. Default ON. Search / print / layout must not write this. */
let sheetOn = true;
let printSavedSheetOn = true;

function isWysiwyg() {
  return sheetOn;
}

function paintSheetToggle() {
  const btn = document.getElementById('wysiwyg-btn');
  const on = sheetOn;
  const label = t('chrome.sheet') || t('print.sheet');
  if (btn) {
    btn.setAttribute('type', 'button');
    btn.removeAttribute('form');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('on', on);
    btn.classList.toggle('off', !on);
    btn.setAttribute('aria-label', t('chrome.ariaSheet') || t('chrome.ariaWysiwyg'));
    btn.setAttribute('title', t('chrome.ariaSheet') || t('chrome.ariaWysiwyg'));
  }
  setText('lbl-wysiwyg', label);
  setText('wysiwyg-state', on ? t('chrome.wysiwygOn') : t('chrome.wysiwygOff'));
}

function setWysiwyg(on) {
  sheetOn = !!on;
  document.body.classList.toggle('wysiwyg-off', !sheetOn);
  paintSheetToggle();
  lastSheetBox = '';
  if (!document.body.classList.contains('printing')) {
    layoutSheet(liveMap);
  }
}

function attachWysiwyg() {
  const btn = document.getElementById('wysiwyg-btn');
  if (!btn) return;
  btn.setAttribute('type', 'button');
  btn.removeAttribute('form');
  paintSheetToggle();
  const keepOffSearch = (ev) => {
    ev.stopPropagation();
  };
  btn.addEventListener('pointerdown', keepOffSearch);
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    setWysiwyg(!sheetOn);
  });
}

function layoutSheet(map) {
  const desk = document.getElementById('desk');
  const sheet = document.getElementById('sheet');
  if (!desk || !sheet || document.body.classList.contains('printing')) return;
  if (sheetLayoutBusy) return;
  if (!isWysiwyg()) {
    sheet.style.left = '0px';
    sheet.style.top = '0px';
    sheet.style.width = '100%';
    sheet.style.height = '100%';
    sheet.style.transform = 'none';
    sheet.style.aspectRatio = 'auto';
    const hud = document.getElementById('hud');
    const dock = document.getElementById('zoom-dock');
    if (hud) {
      hud.style.right = '18px';
      hud.style.bottom = '18px';
    }
    lastSheetBox = 'full';
    if (map) {
      sheetLayoutBusy = true;
      try { map.resize(); } catch { /* off */ }
      sheetLayoutBusy = false;
    }
    return;
  }
  const hud = document.getElementById('hud');
  const dock = document.getElementById('zoom-dock');
  const hudW = hud && !hud.hidden ? hud.offsetWidth : 168;
  const hudH = hud && !hud.hidden ? hud.offsetHeight : 88;
  const zoomW = 36;
  const zoomH = 74;
  const leftReserve = Math.max(36, 18 + zoomW);
  const rightReserve = Math.max(36, 18 + hudW);
  const topReserve = Math.max(24, 18 + zoomH);
  const bottomReserve = 24;
  const r = desk.getBoundingClientRect();
  if (r.width < 80 || r.height < 80) {
    lastSheetBox = '';
    return;
  }
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
  if (map) {
    sheetLayoutBusy = true;
    try { map.resize(); } catch { /* first layout */ }
    sheetLayoutBusy = false;
  }
}

function setZoomForPrintRf(map, target = 24000) {
  const printing = document.body.classList.contains('printing');
  const mapEl = document.getElementById('map');
  const live = (mapEl && mapEl.clientWidth)
    || (map.getCanvas() && map.getCanvas().clientWidth)
    || 0;
  // Same width as frameWidthPx in scale.js. Call AFTER map.resize() so
  // #map.clientWidth is the Letter neatline, not a stale desk width
  // (32dc7fb hardcoded 7.74*96 and leaked 1:12 000 on capture).
  const measured = live > 8 ? live : frameWidthPx();
  const letterPx = 7.74 * 96;
  const nearLetter = Math.abs(measured - letterPx) / letterPx < 0.12;
  // Always the print-neatline formula (same as computePrintScale / HUD).
  // If printing but #map is still full-bleed, do not use that width (1:12 000 leak).
  const w = (printing && !nearLetter) ? letterPx : measured;
  const mpp = (7.74 * 0.0254 * target) / Math.max(1, w);
  const lat = map.getCenter().lat;
  const z = Math.log2((156543.03392804097 * Math.cos((lat * Math.PI) / 180)) / mpp);
  if (Number.isFinite(z)) map.setZoom(Math.min(18, Math.max(2, z)));
}

function afterLetterLayout(map, fn) {
  const run = () => {
    try { map.resize(); } catch { /* layout */ }
    fn();
  };
  try { map.resize(); } catch { /* layout */ }
  requestAnimationFrame(() => {
    try { map.resize(); } catch { /* layout */ }
    requestAnimationFrame(run);
  });
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
  const printing = document.body.classList.contains('printing');
  const rf = printing ? 24000 : (view.rf || 24000);
  const text = printing ? formatScaleRatio(24000) : (view.text || formatScaleRatio(rf));
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
  setText('print-gm-angle', GM_ANGLE());
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

  window.print = function mgrsPrintDead() { return; };

  const prepareSync = () => {
    printSavedSheetOn = sheetOn;
    document.body.classList.add('printing');
    document.documentElement.classList.add('printing');
    try { map.resize(); } catch { /* print size */ }
    setZoomForPrintRf(map, 24000);
    setPrintInterval(intervalForPrintRf(24000));
    fillPrintBlock(map);
    const compact = centerMgrsCompact(map, precisionForZoom(map.getZoom()));
    document.title = printFilename(compact);
  };

  let printArmed = false;
  const restore = () => {
    if (!printArmed && !document.body.classList.contains('printing')) return;
    printArmed = false;
    window.__mgrsAllowPrint = false;
    setPrintInterval(null);
    document.body.classList.remove('printing');
    document.documentElement.classList.remove('printing');
    document.title = t('app.documentTitle');
    sheetOn = printSavedSheetOn;
    document.body.classList.toggle('wysiwyg-off', !sheetOn);
    paintSheetToggle();
    lastSheetBox = '';
    try { map.resize(); } catch { /* restore */ }
    layoutSheet(liveMap);
    requestAnimationFrame(() => {
      try { map.resize(); } catch { /* restore */ }
      layoutSheet(liveMap);
    });
  };

  window.addEventListener('beforeprint', () => {});
  window.addEventListener('afterprint', restore);
  if (window.matchMedia) {
    const mq = window.matchMedia('print');
    const onMq = (e) => { if (!e.matches && printArmed) restore(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  const blockNativePrint = (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'p' || ev.key === 'P' || ev.code === 'KeyP')) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', blockNativePrint, true);
  document.addEventListener('keydown', blockNativePrint, true);

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    printSavedSheetOn = sheetOn;
    printArmed = true;
    document.body.classList.add('printing');
    document.documentElement.classList.add('printing');
    const fire = () => {
      prepareSync();
      try {
        REAL_PRINT.call(window);
      } catch {
        const note = document.getElementById('search-note');
        if (note) {
          note.hidden = false;
          note.textContent = t('chrome.printBlocked');
          note.classList.add('is-error');
        }
        restore();
      }
    };
    afterLetterLayout(map, fire);
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
  attachWysiwyg();
  layoutSheet();
  window.addEventListener('resize', () => {
    if (document.body.classList.contains('printing')) return;
    layoutSheet(liveMap);
  });

  const map = await createMap('map');
  if (!map) return;
  liveMap = map;
  layoutSheet(map);
  try { map.resize(); } catch { /* first layout */ }
  setZoomForPrintRf(map, 24000);
  attachCollarTicks(map);
  fillPrintBlock(map);
  afterLetterLayout(map, () => {
    layoutSheet(map);
    setZoomForPrintRf(map, 24000);
    fillPrintBlock(map);
  });
  if (/[?&]print=1\b/.test(location.search)) {
    const go = async () => {
      document.body.classList.add('printing');
      document.documentElement.classList.add('printing');
      afterLetterLayout(map, () => {
        setZoomForPrintRf(map, 24000);
        fillPrintBlock(map);
      });
      try { await map.once('idle'); } catch { /* layout only — never print */ }
      setZoomForPrintRf(map, 24000);
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
    if (!document.body.classList.contains('printing')) layoutSheet(map);
    fillPrintBlock(map);
  };
  map.on('load', () => {
    layoutSheet(map);
    try { map.resize(); } catch { /* load */ }
    setZoomForPrintRf(map, 24000);
    hud();
  });
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
