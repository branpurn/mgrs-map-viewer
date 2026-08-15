import { t, applyStaticCopy, formatScaleRatio } from './copy.js';
import {
  createMap,
  dockZoom,
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
} from './mgrs-grid.js';
import {
  attachScaleReadout,
  computePrintScale,
  computeViewScale,
  intervalForPrintRf,
  buildPrintScaleBar,
  renderPrintScaleBar,
  frameWidthPx,
  metersPerPixelAtCenter,
  zoomForPrintRf,
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

const PRINT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPrintedDate() {
  // Live clock only. Never accept a frozen 2024 argument.
  const dt = new Date();
  return `${dt.getDate()} ${PRINT_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

function datumValue() {
  const v = t('print.datumValue');
  if (!v || v === 'print.datumValue' || /WGS\s*84/i.test(v)) return 'NAD 83';
  return v;
}

function writeDatum() {
  // Every #print-datum-value write is t('print.datumValue') NAD 83.
  setText('print-datum-value', datumValue());
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

const GM_ANGLE = () => t('print.north.gmAngle');
const GM_CONV = () => t('print.north.convergence');

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
  writeDatum();
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
  setText('print-date', formatPrintedDate());
  setText('lbl-print-sheet', t('print.sheet'));
  setText('print-sheet-value', t('print.sheetValue'));
  setText('print-disclaimer', `${t('app.name')} · ${t('print.attribution.notUsgs')}`);
  setText('print-attr', '');
  setText('lbl-north-grid', t('print.north.grid'));
  setText('lbl-north-true', t('print.north.true'));
  setText('lbl-north-magnetic', t('print.north.magnetic'));
  setText('print-gm-angle', GM_ANGLE());
  setText('print-gm-conv', GM_CONV());
  setText('grid-unavailable', t('lbl.gridUnavailable'));
  const mgrsEl = document.getElementById('center-mgrs');
  if (mgrsEl) mgrsEl.setAttribute('aria-label', t('chrome.mgrsAria'));
}

let sheetLayoutBusy = false;
let lastSheetBox = '';
let liveMap = null;
/** User Sheet preference. Default ON. Search / print / layout must not write this. */
let sheetOn = true;
let printSavedSheetOn = true;
let allowAutoRf = true;
let printArmed = false;

function isWysiwyg() {
  return sheetOn;
}

function sheetLabel() {
  const s = t('chrome.sheet');
  if (!s || s === 'chrome.sheet' || /wysiwyg/i.test(s)) return 'Sheet';
  return s;
}

function sheetOnOff(on) {
  const s = on ? t('chrome.wysiwygOn') : t('chrome.wysiwygOff');
  if (!s || /wysiwyg/i.test(s)) return on ? 'On' : 'Off';
  return s;
}

function readSheetOn() {
  try {
    const v = sessionStorage.getItem('mgrs-sheet');
    if (v === 'off') return false;
    if (v === 'on') return true;
  } catch { /* private mode */ }
  return true;
}

function writeSheetOn(on) {
  // Only setWysiwyg (Sheet click). Zoom / print-cancel must never call this.
  try { sessionStorage.setItem('mgrs-sheet', on ? 'on' : 'off'); } catch { /* */ }
}

function paintSheetToggle() {
  const btn = document.getElementById('wysiwyg-btn');
  const on = sheetOn;
  if (btn) {
    btn.setAttribute('type', 'button');
    btn.removeAttribute('form');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('on', on);
    btn.classList.toggle('off', !on);
    btn.setAttribute('aria-label', t('chrome.ariaSheet'));
    btn.setAttribute('title', t('chrome.ariaSheet'));
  }
  setText('lbl-wysiwyg', sheetLabel());
  setText('wysiwyg-state', sheetOnOff(on));
}

function setWysiwyg(on) {
  sheetOn = !!on;
  writeSheetOn(sheetOn);
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
  sheetOn = readSheetOn();
  document.body.classList.toggle('wysiwyg-off', !sheetOn);
  paintSheetToggle();
  // Whole control toggles: label + track + thumb. Zoom never writes sheetOn.
  btn.querySelectorAll('.sheet-track, .sheet-thumb, #lbl-wysiwyg, #wysiwyg-state').forEach((el) => {
    el.style.pointerEvents = 'auto';
  });
  const zoomDock = document.getElementById('zoom-dock');
  if (zoomDock) {
    ['pointerdown', 'mousedown', 'click', 'touchstart'].forEach((type) => {
      zoomDock.addEventListener(type, (ev) => ev.stopPropagation());
    });
    zoomDock.querySelectorAll('button').forEach((b) => {
      b.setAttribute('type', 'button');
    });
  }
  btn.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation();
  });
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    // Zoom / search / Print never write sheetOn. Only this control does.
    if (ev.target && ev.target.closest('#zoom-dock, #search-form, #search-input, #search-clear, #clear, #print-btn')) return;
    if (!btn.contains(ev.target)) return;
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
  const hudW = hud && !hud.hidden ? hud.offsetWidth : 168;
  const leftReserve = 24;
  const rightReserve = Math.max(24, 18 + hudW);
  const topReserve = 16;
  const bottomReserve = 16;
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
  // AFTER Letter layout. Use live #map.clientWidth (7.74 in neatline).
  // MapLibre z0 world is 512 px — 156543 (256) was 1:6 000 / 1:12 000.
  // Restore must never call this (that leaked print zoom onto the desk).
  const mapEl = document.getElementById('map');
  const w = (mapEl && mapEl.clientWidth) || frameWidthPx() || (7.74 * 96);
  if (w < 8) return;
  const targetMpp = (target * 7.74 * 0.0254) / w;
  const currentMpp = metersPerPixelAtCenter(map);
  const z0 = map.getZoom();
  let z;
  if (currentMpp && currentMpp > 0 && Number.isFinite(z0)) {
    z = z0 + Math.log2(currentMpp / targetMpp);
  } else {
    z = zoomForPrintRf(map.getCenter().lat, w, target);
  }
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

function letterMapWidth() {
  const mapEl = document.getElementById('map');
  if (mapEl) void mapEl.clientWidth;
  const w = mapEl ? mapEl.clientWidth : 0;
  if (!w || w < 40) return 0;
  if (isWysiwyg()) {
    const desk = document.getElementById('desk');
    const deskW = desk ? desk.clientWidth : 0;
    // Full-bleed width is too wide → setZoomForPrintRf over-zooms to z14 / 1:6 000.
    if (deskW > 80 && w > deskW * 0.82) return 0;
  }
  return w;
}

function lockDemoRf(map) {
  if (!allowAutoRf || printArmed || document.body.classList.contains('printing')) return;
  layoutSheet(map);
  try { map.resize(); } catch { /* lock */ }
  if (!letterMapWidth()) return;
  setZoomForPrintRf(map, 24000);
  fillPrintBlock(map);
  allowAutoRf = false;
}

function waitForMapPaint(map, ms = 2400) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const painted = () => {
      try {
        if (typeof map.areTilesLoaded === 'function' && !map.areTilesLoaded()) {
          setTimeout(painted, 80);
          return;
        }
      } catch { /* */ }
      requestAnimationFrame(() => requestAnimationFrame(finish));
    };
    try {
      if (typeof map.triggerRepaint === 'function') map.triggerRepaint();
    } catch { /* */ }
    try {
      map.once('idle', painted);
    } catch {
      painted();
    }
    setTimeout(finish, ms);
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
  const raw = view.rawRf;
  const locked = Number.isFinite(raw) && raw >= 23200 && raw <= 24800;
  const rf = printing ? 24000 : (locked ? 24000 : (view.rf || 24000));
  const text = printing || locked ? formatScaleRatio(24000) : (view.text || formatScaleRatio(rf));
  state.lastScaleText = text;
  const rfBand = intervalForPrintRf(rf);
  const square = centerMgrs(map, rfBand.accuracy);
  const title = sheetTitle(square);
  setText('print-title', title);
  setText('print-title-upper', title);
  setText('print-upper-title', title);
  setText('print-scale', text);
  setText('print-grid-value', t('print.gridValue'));
  writeDatum();
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
  setText('print-gm-angle', GM_ANGLE());
  setText('print-gm-conv', GM_CONV());
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


function snapshotPrintMapFace(map) {
  const mapEl = document.getElementById('map');
  if (!mapEl || !map) return false;
  let url = '';
  try {
    const canvas = typeof map.getCanvas === 'function' ? map.getCanvas() : null;
    if (canvas && typeof canvas.toDataURL === 'function') {
      url = canvas.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  if (!url || url.length < 32) return false;
  let img = document.getElementById('print-map-face');
  if (!img) {
    img = document.createElement('img');
    img.id = 'print-map-face';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    mapEl.appendChild(img);
  }
  img.src = url;
  document.body.classList.add('has-print-face');
  return true;
}

function removePrintMapFace() {
  const img = document.getElementById('print-map-face');
  if (img && img.parentNode) img.parentNode.removeChild(img);
  document.body.classList.remove('has-print-face');
}

function attachPrint(map) {
  const btn = document.getElementById('print-btn');
  if (!btn) return;
  btn.setAttribute('type', 'button');
  btn.removeAttribute('form');

  window.print = function mgrsPrintDead() { return; };

  let prePrint = null;
  let restored = false;
  const captureView = () => {
    const c = map.getCenter();
    return {
      zoom: map.getZoom(),
      center: { lng: c.lng, lat: c.lat },
      sheetOn: !!sheetOn,
    };
  };

  const applySavedView = (saved) => {
    if (!saved) return;
    // Camera only. Print-cancel must not restore/force the Letter sheet.
    if (!saved.center || !Number.isFinite(saved.zoom)) return;
    try {
      const c = saved.center;
      const lng = c && (c.lng ?? c.lon);
      const lat = c && c.lat;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        map.jumpTo({ center: [lng, lat], zoom: saved.zoom });
      } else {
        map.setZoom(saved.zoom);
      }
    } catch {
      try { map.setZoom(saved.zoom); } catch { /* keep */ }
    }
  };

  const prepareSync = () => {
    if (!prePrint) prePrint = captureView();
    printSavedSheetOn = prePrint.sheetOn;
    document.body.classList.add('printing');
    document.documentElement.classList.add('printing');
    try { map.resize(); } catch { /* print size */ }
    const mapEl = document.getElementById('map');
    if (mapEl) void mapEl.clientWidth;
    setZoomForPrintRf(map, 24000);
    setPrintInterval(intervalForPrintRf(24000));
    fillPrintBlock(map);
    const compact = centerMgrsCompact(map, precisionForZoom(map.getZoom()));
    document.title = printFilename(compact);
  };

  const restore = () => {
    if (restored) return;
    if (!printArmed && !document.body.classList.contains('printing')) return;
    restored = true;
    printArmed = false;
    window.__mgrsAllowPrint = false;
    removePrintMapFace();
    setPrintInterval(null);
    document.body.classList.remove('printing');
    document.documentElement.classList.remove('printing');
    document.title = t('app.documentTitle');
    const saved = prePrint || { zoom: null, center: null, sheetOn: printSavedSheetOn };
    prePrint = null;
    lastSheetBox = '';
    // Layout first, then put the pre-print zoom back. Never setZoomForPrintRf
    // on this path (that is the 1:12 000 leak). Do not write sheetOn.
    try { map.resize(); } catch { /* restore */ }
    layoutSheet(liveMap);
    dockZoom(map);
    applySavedView(saved);
    fillPrintBlock(map);
    requestAnimationFrame(() => {
      try { map.resize(); } catch { /* restore */ }
      layoutSheet(liveMap);
      dockZoom(map);
      applySavedView(saved);
      fillPrintBlock(map);
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

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && (printArmed || document.body.classList.contains('printing'))) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      restore();
    }
  }, true);

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    const hit = ev.target;
    if (hit && hit.closest && hit.closest('#search-form, #search-input, #search-clear, #wysiwyg-btn, #zoom-dock')) return;
    if (ev.currentTarget !== btn || !btn.contains(hit)) return;
    restored = false;
    prePrint = captureView();
    printSavedSheetOn = sheetOn;
    allowAutoRf = false;
    printArmed = true;
    document.body.classList.add('printing');
    document.documentElement.classList.add('printing');
    const fire = () => {
      if (!printArmed) return;
      prepareSync();
      try { map.resize(); } catch { /* print size */ }
      let printed = false;
      const snapAndPrint = (force=false) => {
        if (!printArmed || printed) return;
        const ok = snapshotPrintMapFace(map);
        if (!ok && !force) return;
        printed = true;
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
      // Paint first (not idle) so toDataURL sees tiles. 012: button-only print.
      try { map.once('render', () => snapAndPrint(false)); } catch { /* */ }
      try {
        if (typeof map.triggerRepaint === 'function') map.triggerRepaint();
      } catch { /* */ }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => snapAndPrint(true));
      });
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
    if (printArmed) return;
    if (key === '+' || key === '=') map.zoomIn();
    if (key === '-' || key === '_') map.zoomOut();
  });
}

async function main() {
  applyChromeCopy();
  attachWysiwyg();
  layoutSheet();
  window.addEventListener('resize', () => {
    if (document.body.classList.contains('printing') || printArmed) return;
    layoutSheet(liveMap);
  });

  const map = await createMap('map');
  if (!map) return;
  liveMap = map;
  layoutSheet(map);
  try { map.resize(); } catch { /* first layout */ }
  attachCollarTicks(map);
  fillPrintBlock(map);
  afterLetterLayout(map, () => {
    if (printArmed) return;
    layoutSheet(map);
    try { map.resize(); } catch { /* first layout */ }
    lockDemoRf(map);
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
      // Search must not write sheetOn / chrome.sheet.
      state.exampleLocked = false;
      if (info && info.kind === 'place' && info.label && !isLatLonLabel(info.label)) {
        state.lastLabel = info.label;
      } else {
        state.lastLabel = '';
      }
    },
  });
  attachPrint(map);
  const zoomDock = document.getElementById('zoom-dock');
  if (zoomDock) {
    zoomDock.querySelectorAll('button').forEach((b) => {
      b.setAttribute('type', 'button');
      b.addEventListener('click', (ev) => ev.stopPropagation());
    });
  }

  const hud = () => {
    updateCenterHud(map);
    if (!document.body.classList.contains('printing') && !printArmed) layoutSheet(map);
    fillPrintBlock(map);
  };
  map.on('load', () => {
    if (printArmed) return;
    layoutSheet(map);
    try { map.resize(); } catch { /* load */ }
    lockDemoRf(map);
    hud();
  });
  map.once('idle', () => {
    if (printArmed) return;
    lockDemoRf(map);
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
