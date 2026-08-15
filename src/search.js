import { toPoint } from 'mgrs';
import { API_BASE, t, noPlaceCopy, ambiguousCopy } from './copy.js';

const DECIMAL = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/;
const HEMI_SUFFIX =
  /^(\d+(?:\.\d+)?)\s*([NSns])\s*[,;\s]\s*(\d+(?:\.\d+)?)\s*([EWew])$/;
const HEMI_PREFIX =
  /^([NSns])\s*(\d+(?:\.\d+)?)\s*[,;\s]\s*([EWew])\s*(\d+(?:\.\d+)?)$/;
const MGRS_LOOSE =
  /^(\d{1,2})\s*([C-HJ-NP-Xc-hj-np-x])\s*([A-HJ-NP-Za-hj-np-z]{2})\s*(\d{0,10})$/;
const DMS =
  /^(\d{1,3})\s*[°\s]\s*(\d{1,2})\s*[′'’\s]\s*(\d{1,2}(?:\.\d+)?)\s*[″"”]?\s*([NSns])\s*[,;\s]+\s*(\d{1,3})\s*[°\s]\s*(\d{1,2})\s*[′'’\s]\s*(\d{1,2}(?:\.\d+)?)\s*[″"”]?\s*([EWew])$/;
const DDM =
  /^(\d{1,3})\s*[°\s]\s*(\d{1,2}(?:\.\d+)?)\s*[′']?\s*([NSns])\s*[,;\s]+\s*(\d{1,3})\s*[°\s]\s*(\d{1,2}(?:\.\d+)?)\s*[′']?\s*([EWew])$/;

const ZOOM_FROM_PRECISION = {
  0: 8,
  1: 10,
  2: 13,
  3: 15,
  4: 17,
  5: 18,
};

function validLatLon(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function dmsToDec(d, m, s, hemi) {
  let v = Number(d) + Number(m) / 60 + Number(s || 0) / 3600;
  const h = String(hemi).toUpperCase();
  if (h === 'S' || h === 'W') v = -Math.abs(v);
  else v = Math.abs(v);
  return v;
}

function mgrsPrecision(compact) {
  const m = compact.match(/^\d{1,2}[C-HJ-NP-X][A-HJ-NP-Z]{2}(\d*)$/);
  if (!m) return 0;
  return Math.min(5, Math.floor(m[1].length / 2));
}

/**
 * @param {string} raw
 * @returns {{ type: 'll', lat: number, lon: number, zoom: number } | { type: 'mgrs', lat: number, lon: number, mgrs: string, precision: number, zoom: number } | { type: 'place', q: string } | { type: 'empty' } | { type: 'bad' }}
 */
export function parseQuery(raw) {
  const q = String(raw || '').trim();
  if (!q) return { type: 'empty' };

  let m = q.match(HEMI_SUFFIX);
  if (m) {
    let lat = parseFloat(m[1]);
    let lon = parseFloat(m[3]);
    if (m[2].toUpperCase() === 'S') lat = -Math.abs(lat);
    else lat = Math.abs(lat);
    if (m[4].toUpperCase() === 'W') lon = -Math.abs(lon);
    else lon = Math.abs(lon);
    return validLatLon(lat, lon) ? { type: 'll', lat, lon, zoom: 14 } : { type: 'bad' };
  }

  m = q.match(HEMI_PREFIX);
  if (m) {
    let lat = parseFloat(m[2]);
    let lon = parseFloat(m[4]);
    if (m[1].toUpperCase() === 'S') lat = -Math.abs(lat);
    else lat = Math.abs(lat);
    if (m[3].toUpperCase() === 'W') lon = -Math.abs(lon);
    else lon = Math.abs(lon);
    return validLatLon(lat, lon) ? { type: 'll', lat, lon, zoom: 14 } : { type: 'bad' };
  }

  m = q.match(DMS);
  if (m) {
    const lat = dmsToDec(m[1], m[2], m[3], m[4]);
    const lon = dmsToDec(m[5], m[6], m[7], m[8]);
    return validLatLon(lat, lon) ? { type: 'll', lat, lon, zoom: 14 } : { type: 'bad' };
  }

  m = q.match(DDM);
  if (m) {
    const lat = dmsToDec(m[1], m[2], 0, m[3]);
    const lon = dmsToDec(m[4], m[5], 0, m[6]);
    return validLatLon(lat, lon) ? { type: 'll', lat, lon, zoom: 14 } : { type: 'bad' };
  }

  m = q.match(DECIMAL);
  if (m) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    if (validLatLon(a, b)) return { type: 'll', lat: a, lon: b, zoom: 14 };
    if (validLatLon(b, a)) return { type: 'll', lat: b, lon: a, zoom: 14 };
    return { type: 'bad' };
  }

  const compact = q.replace(/\s+/g, '').toUpperCase();
  if (MGRS_LOOSE.test(compact) || MGRS_LOOSE.test(q)) {
    try {
      const [lon, lat] = toPoint(compact);
      if (validLatLon(lat, lon)) {
        const precision = mgrsPrecision(compact);
        return {
          type: 'mgrs',
          lat,
          lon,
          mgrs: compact,
          precision,
          zoom: ZOOM_FROM_PRECISION[precision] ?? 13,
        };
      }
    } catch {
      // fall through
    }
  }

  return { type: 'place', q };
}

function classifySearchError(res, data) {
  const code = data && (data.error || data.code);
  if (code === 'unrecognized_query') return 'unrecognizedQuery';
  if (code === 'invalid_coordinates') return 'unrecognized';
  if (code === 'not_found') return 'noPlace';
  if (code === 'upstream') return 'failed';
  if (res.status === 404) return 'noPlace';
  if (res.status === 400) return code === 'unrecognized_query' ? 'unrecognizedQuery' : 'unrecognized';
  return 'failed';
}

/**
 * Remote place search. Does not invent a geocoder when VITE_API_BASE is empty.
 * @param {string} q
 */
export async function searchPlace(q) {
  if (!API_BASE) {
    return { needsApi: true };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err = new Error('offline');
    err.code = 'offline';
    throw err;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
  } catch (e) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const err = new Error('offline');
      err.code = 'offline';
      throw err;
    }
    throw e;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 200 && data) {
    if (Array.isArray(data.results) && data.results.length === 0) {
      return { none: true, q };
    }
    if (Array.isArray(data.results) && data.results.length > 1) {
      return { ambiguous: true, q, results: data.results };
    }
    const hit = Array.isArray(data.results) ? data.results[0] : data;
    if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) {
      return {
        lat: hit.lat,
        lon: hit.lon,
        zoom: hit.zoom,
        mgrs: hit.mgrs,
        label: hit.label || hit.query || q,
        precision: hit.precision,
        bbox: hit.bbox,
      };
    }
    return { none: true, q };
  }

  const kind = classifySearchError(res, data);
  return { error: kind, q };
}

function flyTo(map, lon, lat, zoom) {
  map.flyTo({
    center: [lon, lat],
    zoom,
    essential: true,
  });
}

function fitOrFly(map, hit) {
  if (Array.isArray(hit.bbox) && hit.bbox.length === 4) {
    const [west, south, east, north] = hit.bbox;
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 48, maxZoom: 16, essential: true },
    );
    return;
  }
  flyTo(map, hit.lon, hit.lat, Number.isFinite(hit.zoom) ? hit.zoom : 14);
}

/**
 * @param {import('maplibre-gl').Map} map
 * @param {{ onLocate?: (info: { label: string, mgrs?: string }) => void }} [opts]
 */
export function attachSearch(map, opts = {}) {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const note = document.getElementById('search-note');
  const hint = document.getElementById('search-hint');
  const clearBtn = document.getElementById('search-clear');
  const formats = document.getElementById('search-formats');

  const showNote = (text, isError = false) => {
    if (!note) return;
    if (!text) {
      note.hidden = true;
      note.textContent = '';
      note.classList.remove('is-error');
      return;
    }
    note.hidden = false;
    note.textContent = text;
    note.classList.toggle('is-error', isError);
  };

  const showHint = (text) => {
    if (!hint) return;
    if (!text) {
      hint.hidden = true;
      hint.textContent = '';
      return;
    }
    hint.hidden = false;
    hint.textContent = text;
  };

  const syncClear = () => {
    if (clearBtn) clearBtn.hidden = !String(input.value || '').trim();
  };

  const clear = () => {
    input.value = '';
    showNote('');
    showHint('');
    syncClear();
    input.focus();
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const parsed = parseQuery(input.value);
    showHint('');

    if (parsed.type === 'empty') {
      showNote(t('search.error.empty'), true);
      return;
    }
    if (parsed.type === 'bad') {
      showNote(t('search.error.unrecognized'), true);
      showHint(t('search.error.unrecognizedHint'));
      return;
    }
    if (parsed.type === 'll' || parsed.type === 'mgrs') {
      showNote('');
      flyTo(map, parsed.lon, parsed.lat, parsed.zoom);
      if (opts.onLocate) {
        opts.onLocate({
          label: parsed.type === 'mgrs' ? parsed.mgrs : `${parsed.lat}, ${parsed.lon}`,
          mgrs: parsed.mgrs,
        });
      }
      return;
    }

    try {
      const result = await searchPlace(parsed.q);
      if (result && result.needsApi) {
        showNote(t('search.error.unrecognizedQuery'), false);
        showHint(t('search.error.unrecognizedHint'));
        return;
      }
      if (result && result.none) {
        showNote(noPlaceCopy(parsed.q), true);
        return;
      }
      if (result && result.ambiguous) {
        showNote(ambiguousCopy(parsed.q), true);
        return;
      }
      if (result && result.error === 'noPlace') {
        showNote(noPlaceCopy(parsed.q), true);
        return;
      }
      if (result && result.error === 'unrecognizedQuery') {
        showNote(t('search.error.unrecognizedQuery'), true);
        showHint(t('search.helper'));
        return;
      }
      if (result && result.error === 'unrecognized') {
        showNote(t('search.error.unrecognized'), true);
        showHint(t('search.error.unrecognizedHint'));
        return;
      }
      if (result && result.error) {
        showNote(t('search.error.failed'), true);
        return;
      }
      if (result && Number.isFinite(result.lat) && Number.isFinite(result.lon)) {
        showNote('');
        fitOrFly(map, result);
        if (opts.onLocate) {
          opts.onLocate({ label: result.label, mgrs: result.mgrs });
        }
        return;
      }
      showNote(t('search.error.failed'), true);
    } catch (err) {
      if (err && err.code === 'offline') {
        showNote(t('search.error.offline'), true);
      } else {
        showNote(t('search.error.failed'), true);
      }
    }
  });

  input.addEventListener('input', () => {
    if (note && !note.hidden) showNote('');
    if (hint && !hint.hidden) showHint('');
    syncClear();
  });

  input.addEventListener('focus', () => {
    if (formats) formats.hidden = false;
  });
  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (formats && document.activeElement !== input) formats.hidden = true;
    }, 150);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      clear();
    });
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && (ev.target === input || form.contains(ev.target))) {
      ev.preventDefault();
      clear();
    }
    if (ev.key === '/' && ev.target !== input && ev.target.tagName !== 'INPUT') {
      ev.preventDefault();
      input.focus();
      input.select();
    }
  });

  syncClear();
}
