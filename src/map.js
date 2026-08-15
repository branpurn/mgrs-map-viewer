import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { t } from './copy.js';

/** Jefferson Pier / Washington DC — RF target 1:24 000 after first layout. */
export const DEFAULT_CENTER = { lon: -77.0353, lat: 38.8895 };
export const DEFAULT_ZOOM = 14.23;

export const OT_TILES = [
  'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
  'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
  'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
];

export const OSM_TILES = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

export const OT_ATTR_SHORT =
  'Map data © OpenStreetMap contributors, SRTM. Style © OpenTopoMap (CC-BY-SA). Not a USGS map.';
export const OSM_ATTR_SHORT = 'Map data © OpenStreetMap contributors. Not a USGS map.';

export function attrPrint() {
  return activeTileSource === 'opentopomap' ? t('lbl.attribution') : t('lbl.attributionOsm');
}

const OT_PROBE = 'https://a.tile.opentopomap.org/12/1171/1566.png';

/** @typedef {'opentopomap' | 'osm'} TileSourceId */

/** @type {TileSourceId} */
export let activeTileSource = 'opentopomap';

const listeners = new Set();

export function onTileSourceChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitTileSource() {
  for (const fn of listeners) fn(activeTileSource);
  const el = document.getElementById('tile-source');
  if (el) {
    el.textContent =
      activeTileSource === 'opentopomap'
        ? t('chrome.tiles.opentopomap')
        : t('chrome.tiles.osm');
  }
  const attr = document.getElementById('print-attr');
  if (attr) attr.textContent = attrPrint();
}

export function setStatus(text, { retry = false } = {}) {
  const status = document.getElementById('map-status');
  const retryBtn = document.getElementById('tile-retry');
  if (!status) return;
  if (!retry || !text) {
    status.hidden = true;
    const textEl = status.querySelector('.status-text');
    if (textEl) textEl.textContent = '';
    if (retryBtn) retryBtn.hidden = true;
    return;
  }
  status.hidden = false;
  const textEl = status.querySelector('.status-text');
  if (textEl) textEl.textContent = text;
  else status.textContent = text;
  if (retryBtn) retryBtn.hidden = false;
}

/**
 * Probe OpenTopoMap. Image tiles are used as MapLibre raster textures,
 * so CORS must succeed. Fall back to OSM on failure.
 */
export async function detectBaseTiles(timeoutMs = 1500) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : 0;
  try {
    const res = await fetch(OT_PROBE, {
      mode: 'cors',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (res.ok) {
      activeTileSource = 'opentopomap';
      return activeTileSource;
    }
  } catch {
    // network / CORS / blocked / timeout
  } finally {
    if (timer) clearTimeout(timer);
  }
  activeTileSource = 'osm';
  return activeTileSource;
}

function rasterSource(id) {
  const ot = id === 'opentopomap';
  return {
    type: 'raster',
    tiles: ot ? OT_TILES : OSM_TILES,
    tileSize: 256,
    attribution: ot ? OT_ATTR_SHORT : OSM_ATTR_SHORT,
    maxzoom: ot ? 17 : 19,
  };
}

export function buildStyle(tileId = activeTileSource) {
  return {
    version: 8,
    name: 'MGRS Topo',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: rasterSource(tileId),
    },
    layers: [
      {
        id: 'well',
        type: 'background',
        paint: { 'background-color': '#E8D9B8' },
      },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      },
    ],
  };
}

export function applyTileSource(map, id) {
  activeTileSource = id;
  const source = map.getSource('basemap');
  if (source && typeof source.setTiles === 'function') {
    source.setTiles(id === 'opentopomap' ? OT_TILES : OSM_TILES);
  }
  emitTileSource();
}

/**
 * Switch the live map to OSM if OpenTopoMap tiles start failing after load.
 * @param {maplibregl.Map} map
 */
function tilesHavePainted(map) {
  try {
    if (typeof map.areTilesLoaded === 'function' && map.areTilesLoaded()) return true;
  } catch {
    // ignore
  }
  try {
    if (typeof map.isSourceLoaded === 'function' && map.isSourceLoaded('basemap')) return true;
  } catch {
    // ignore
  }
  return false;
}

export function attachTileFallback(map) {
  let errors = 0;
  let switched = activeTileSource !== 'opentopomap';
  let painted = false;

  const dismiss = () => {
    painted = true;
    setStatus('');
  };

  const basemapReady = (e) => {
    if (!e || e.sourceId !== 'basemap') return;
    if (e.isSourceLoaded || e.sourceDataType === 'idle') dismiss();
  };
  map.on('sourcedata', basemapReady);
  map.on('data', (e) => {
    if (e && e.sourceId === 'basemap' && e.dataType === 'source' && e.isSourceLoaded) {
      dismiss();
    }
  });

  map.on('error', (e) => {
    const src = e?.sourceId || e?.source?.id;
    const msg = String(e?.error?.message || e?.error || '');
    if (src && src !== 'basemap') return;
    if (/glyph|font|\.pbf/i.test(msg)) return;
    if (painted) {
      dismiss();
      return;
    }

    if (!switched) {
      errors += 1;
      if (errors < 3) return;
      switched = true;
      applyTileSource(map, 'osm');
      map.once('idle', () => {
        if (painted || tilesHavePainted(map)) dismiss();
        else setStatus(t('chrome.tilesFailed'), { retry: true });
      });
      return;
    }

    if (!painted) setStatus(t('chrome.tilesFailed'), { retry: true });
  });
}

export async function retryTiles(map) {
  setStatus('');
  const id = await detectBaseTiles();
  applyTileSource(map, id);
  try {
    await map.once('idle');
    setStatus('');
  } catch {
    setStatus(t('chrome.tilesFailed'), { retry: true });
  }
}

function showNoWebGL() {
  document.body.classList.add('no-webgl-active');
  const banner = document.getElementById('no-webgl');
  const chrome = document.getElementById('chrome');
  const hud = document.getElementById('hud');
  const desk = document.getElementById('desk');
  const mapEl = document.getElementById('map');
  const status = document.getElementById('map-status');
  if (banner) {
    banner.hidden = false;
    const p = banner.querySelector('p');
    if (p) p.textContent = t('chrome.noWebGL');
  }
  if (chrome) chrome.hidden = true;
  if (hud) hud.hidden = true;
  if (desk) desk.hidden = true;
  if (mapEl) mapEl.hidden = true;
  if (status) status.hidden = true;
}

/**
 * @param {string} containerId
 * @returns {Promise<maplibregl.Map | null>}
 */
export async function createMap(containerId = 'map') {
  if (typeof maplibregl.supported === 'function' && !maplibregl.supported()) {
    showNoWebGL();
    return null;
  }

  // Do not block first paint on the tile probe (Electron AppImage was a blank
  // canvas until a later search forced a camera move). Start on OpenTopoMap;
  // probe in the background and fall back if it fails.
  activeTileSource = 'opentopomap';

  const map = new maplibregl.Map({
    container: containerId,
    style: buildStyle(activeTileSource),
    center: [DEFAULT_CENTER.lon, DEFAULT_CENTER.lat],
    zoom: DEFAULT_ZOOM,
    minZoom: 2,
    maxZoom: 18,
    maxPitch: 0,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: false,
    hash: false,
  });

  detectBaseTiles().then((id) => {
    if (id !== 'opentopomap') applyTileSource(map, id);
  });

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
    'top-left',
  );
  dockZoom(map);

  attachTileFallback(map);
  emitTileSource();

  const retryBtn = document.getElementById('tile-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      retryTiles(map);
    });
  }

  map.on('idle', () => {
    if (tilesHavePainted(map) || map.isSourceLoaded?.('basemap')) setStatus('');
  });

  const kickResize = () => {
    try {
      map.resize();
    } catch {
      // map not ready
    }
  };
  map.on('load', kickResize);
  window.addEventListener('resize', kickResize);
  requestAnimationFrame(() => {
    kickResize();
    requestAnimationFrame(kickResize);
  });
  const el = map.getContainer();
  if (typeof ResizeObserver === 'function' && el) {
    const ro = new ResizeObserver(() => kickResize());
    ro.observe(el);
  }

  return map;
}

export function dockZoom(map) {
  const dock = document.getElementById('zoom-dock');
  if (!dock || !map) return;
  const root = map.getContainer();
  const group = root.querySelector('.maplibregl-ctrl-group');
  if (group && !dock.contains(group)) dock.appendChild(group);
  root.querySelectorAll('.maplibregl-ctrl').forEach((el) => {
    if (!dock.contains(el)) el.style.display = 'none';
  });
}

export function getCenterLngLat(map) {
  const c = map.getCenter();
  return { lon: c.lng, lat: c.lat };
}

export { maplibregl };
