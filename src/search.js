import { toPoint } from 'mgrs';
import { t } from './copy.js';

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

function mapHit(hit) {
  if (!hit || typeof hit !== 'object') return null;
  const lat = parseFloat(hit.lat);
  const lon = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let bbox;
  if (Array.isArray(hit.bbox) && hit.bbox.length === 4) {
    bbox = hit.bbox;
  }
  const label = hit.label != null && String(hit.label).trim() ? String(hit.label).trim() : '';
  return {
    lat,
    lon,
    zoom: Number(hit.zoom) || 14,
    label,
    kind: hit.kind,
    mgrs: hit.mgrs,
    bbox,
  };
}

/**
 * Map API payload to place hits. Prefer data.results[]; if that is empty/missing
 * but the root object itself has finite lat+lon, treat the root as one hit.
 */
export function normalizeHits(data) {
  if (!data || typeof data !== 'object') return [];
  let raw = Array.isArray(data.results) ? data.results : [];
  if (
    raw.length === 0 &&
    Number.isFinite(parseFloat(data.lat)) &&
    Number.isFinite(parseFloat(data.lon))
  ) {
    raw = [data];
  }
  return raw.map(mapHit).filter(Boolean);
}

/**
 * Place search via same-origin GET /api/search. Do not call Nominatim from the renderer. MGRS / lat-long stay local.
 * @param {string} q
 */
export async function searchPlace(q) {
  const query = String(q == null ? '' : q).trim();
  if (!query) return { empty: true };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const err = new Error('offline');
    err.code = 'offline';
    throw err;
  }

  const origin =
    typeof location !== 'undefined' && location.origin && location.origin !== 'null'
      ? location.origin
      : '';
  const url = origin + '/api/search?q=' + encodeURIComponent(query);
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
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

  if (res.status === 200) {
    const mapped = normalizeHits(data);
    if (mapped.length === 0) {
      if (!query) return { empty: true };
      return { none: true, q: query };
    }
    if (mapped.length > 1) return { ambiguous: true, q: query, results: mapped };
    return mapped[0];
  }

  const kind = classifySearchError(res, data);
  return { error: kind, q: query };
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
 * @param {{ onLocate?: (info: { kind: string, label?: string }) => void }} [opts]
 */
export function attachSearch(map, opts = {}) {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');

  let matches = document.getElementById('search-matches');
  if (!matches) {
    matches = document.createElement('div');
    matches.id = 'search-matches';
    matches.className = 'search-matches';
    matches.hidden = true;
  }
  document.body.appendChild(matches);

  let note = document.getElementById('search-note');
  if (!note) {
    note = document.createElement('p');
    note.id = 'search-note';
    note.className = 'search-note';
    note.hidden = true;
  }
  document.body.appendChild(note);

  let missTimer = 0;
  let fadeTimer = 0;

  const pinToInput = (el, topPx) => {
    if (!el || !input) return;
    const r = input.getBoundingClientRect();
    const w = r.width > 0 ? r.width : 320;
    el.style.position = 'fixed';
    el.style.left = `${Math.round(r.left)}px`;
    el.style.width = `${Math.round(w)}px`;
    el.style.maxWidth = `${Math.round(w)}px`;
    el.style.right = 'auto';
    el.style.top = `${topPx}px`;
    el.style.zIndex = '40';
    if (el.id === 'search-note') el.style.height = '18px';
    else el.style.height = 'auto';
  };

  const hideNote = () => {
    window.clearTimeout(missTimer);
    window.clearTimeout(fadeTimer);
    if (note) {
      note.hidden = true;
      note.textContent = '';
      note.classList.remove('is-fading');
    }
    if (input) input.classList.remove('is-miss');
  };

  const showMiss = (text, { persist = false } = {}) => {
    if (!note || !text) {
      hideNote();
      return;
    }
    window.clearTimeout(missTimer);
    window.clearTimeout(fadeTimer);
    note.hidden = false;
    note.removeAttribute('hidden');
    pinToInput(note, 52);
    note.textContent = text;
    note.classList.remove('is-fading');
    input.classList.add('is-miss');
    if (persist) return;
    missTimer = window.setTimeout(() => {
      note.classList.add('is-fading');
      input.classList.remove('is-miss');
      fadeTimer = window.setTimeout(() => {
        note.hidden = true;
        note.classList.remove('is-fading');
      }, 150);
    }, 3000);
  };

  const hideMatches = () => {
    if (!matches) return;
    matches.hidden = true;
    matches.innerHTML = '';
  };

  const showMatches = (items, q) => {
    if (!matches || !items || items.length < 2) return;
    document.body.appendChild(matches);
    matches.hidden = false;
    matches.removeAttribute('hidden');
    pinToInput(matches, 74);
    matches.innerHTML = '';
    const heading = document.createElement('p');
    heading.className = 'matches-h';
    heading.textContent = t('search.matches');
    matches.appendChild(heading);
    items.slice(0, 8).forEach((hit) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const raw = String(hit.label || '').trim();
      const text = raw.length <= 28 ? raw : raw.slice(0, 27) + '…';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        hideMatches();
        hideNote();
        fitOrFly(map, hit);
        if (opts.onLocate) {
          opts.onLocate({ kind: 'place', label: hit.label });
        }
      });
      matches.appendChild(btn);
    });
    if (items.length > 8) {
      const extra = document.createElement('p');
      extra.className = 'matches-h';
      extra.textContent = t('search.matchesTooMany', { n: 8 });
      matches.appendChild(extra);
    }
    matches.hidden = false;
  };

  const syncClear = () => {
    if (clearBtn) clearBtn.hidden = !String(input.value || '').trim();
  };

  const clear = () => {
    input.value = '';
    hideNote();
    hideMatches();
    syncClear();
    input.focus();
  };

  const missKey = (kind, q) => {
    if (kind === 'empty') return t('search.error.empty');
    if (kind === 'unrecognized') return t('search.error.unrecognized');
    if (kind === 'unrecognizedQuery') return t('search.error.unrecognizedQuery');
    if (kind === 'noPlace') return t('lbl.searchMiss', { q }) || t('search.error.noPlace', { q });
    if (kind === 'ambiguous') return t('search.error.ambiguous', { q });
    if (kind === 'offline') return t('search.error.offline');
    return t('search.error.failed');
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    hideMatches();
    const parsed = parseQuery(input.value);

    if (parsed.type === 'empty') {
      showMiss(missKey('empty'));
      return;
    }
    if (parsed.type === 'bad') {
      showMiss(missKey('unrecognized'));
      return;
    }
    if (parsed.type === 'll' || parsed.type === 'mgrs') {
      hideNote();
      flyTo(map, parsed.lon, parsed.lat, parsed.zoom);
      if (opts.onLocate) {
        opts.onLocate({ kind: parsed.type });
      }
      return;
    }

    try {
      const result = await searchPlace(parsed.q);
      if (result && result.empty) {
        showMiss(missKey('empty'));
        return;
      }
      if (result && result.needsApi) {
        showMiss(missKey('unrecognizedQuery'));
        return;
      }
      if (result && (result.none || result.error === 'noPlace')) {
        showMiss(missKey('noPlace', parsed.q));
        return;
      }
      if (result && result.ambiguous) {
        showMiss(missKey('ambiguous', parsed.q), { persist: true });
        showMatches(result.results || [], parsed.q);
        return;
      }
      if (result && result.error === 'unrecognizedQuery') {
        showMiss(missKey('unrecognizedQuery'));
        return;
      }
      if (result && result.error === 'unrecognized') {
        showMiss(missKey('unrecognized'));
        return;
      }
      if (result && result.error) {
        showMiss(missKey(result.error, parsed.q));
        return;
      }
      if (result && Number.isFinite(result.lat) && Number.isFinite(result.lon)) {
        hideNote();
        fitOrFly(map, result);
        if (opts.onLocate) {
          opts.onLocate({ kind: 'place', label: result.label });
        }
        return;
      }
      showMiss(missKey('failed'));
    } catch (err) {
      if (err && err.code === 'offline') showMiss(missKey('offline'));
      else showMiss(missKey('failed'));
    }
  });

  form.addEventListener('pointerdown', (ev) => {
    if (clearBtn && (ev.target === clearBtn || clearBtn.contains(ev.target))) return;
    input.focus();
  }, true);
  input.addEventListener('pointerdown', () => {
    input.focus();
  });

  input.addEventListener('input', () => {
    hideNote();
    hideMatches();
    syncClear();
  });

  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });


  if (clearBtn) {
    clearBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      clear();
    });
  }

  window.addEventListener('resize', () => {
    if (note && !note.hidden) pinToInput(note, 52);
    if (matches && !matches.hidden) pinToInput(matches, 74);
  });

  document.addEventListener('keydown', (ev) => {
    const key = ev.key;
    const ctrlA = (ev.ctrlKey || ev.metaKey) && (key === 'a' || key === 'A');
    if (ctrlA) {
      if (ev.target === input) return;
      const tag = ev.target && ev.target.tagName;
      const inOther = ev.target
        && (tag === 'TEXTAREA' || tag === 'SELECT' || ev.target.isContentEditable);
      if (!inOther) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        input.focus();
        const v = String(input.value || '');
        input.setSelectionRange(0, v.length);
      }
      return;
    }
    if (key === 'Escape' && (ev.target === input || form.contains(ev.target))) {
      ev.preventDefault();
      clear();
    }
    if (key === '/' && ev.target !== input && ev.target.tagName !== 'INPUT') {
      ev.preventDefault();
      input.focus();
      input.select();
    }
  }, true);

  syncClear();
}
