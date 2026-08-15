/** Locked copy: import strings.json only. Flat keys via t(). Nested COPY.app.name via nest(). */

import strings from '../strings.json';

export const API_BASE = '';

/** Packaged AppImage may ship an older strings.json. Never show raw keys. */
const FALLBACKS = {
  'print.gridZone': 'GRID ZONE',
  'print.gridZoneValue': '{gzd}',
  'print.example': 'EXAMPLE',
  'print.example.place': 'Jefferson Pier',
  'print.example.grid': '18S UJ 2337 0652',
  'print.example.note': 'Read right, then up.',
  'print.north.gm': 'G–M',
  'print.north.grid': 'GN',
  'print.north.true': 'TN',
  'print.north.magnetic': 'MN',
  'print.north.note': 'Grid, magnetic, and true north at center of sheet.',
  'print.datum': 'DATUM',
  'print.datumValue': 'NAD 83',
  'print.grid': 'GRID',
  'print.gridValue': 'MGRS',
  'print.gridInterval': 'Grid interval',
  'print.gridInterval.1k': '1 km',
  'print.gridInterval.100m': '100 m',
  'print.gridInterval.10k': '10 km',
  'print.scale': 'SCALE',
  'print.projection': 'Projection',
  'print.projectionValue': 'UTM',
  'print.legend.roads': 'Roads',
  'print.legend.water': 'Water',
  'print.legend.contours': 'Contours',
  'print.legend.grid': 'MGRS grid',
  'print.legend.places': 'Places',
  'print.legend.relief': 'Relief',
  'app.name': 'MGRS Viewer',
  'print.attribution.notUsgs': 'Not a USGS map.',
  'chrome.wysiwyg': 'WYSIWYG',
  'chrome.wysiwygOn': 'On',
  'chrome.wysiwygOff': 'Off',
  'chrome.ariaWysiwyg': 'WYSIWYG. Default on.',
  'chrome.ariaWysiwygOn': 'WYSIWYG on. Screen matches the printed sheet.',
  'chrome.ariaWysiwygOff': 'WYSIWYG off.',
  'chrome.sheet': 'Sheet',
  'chrome.ariaSheet': 'Sheet view. On is the Letter sheet. Off is the full map.',
  'print.sheet': 'Sheet',
};

/**
 * Look up a flat key from strings.json and replace `{name}` tokens.
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, vars = {}) {
  let template;
  if (Object.prototype.hasOwnProperty.call(strings, key) && strings[key] !== '') {
    template = strings[key];
  } else if (Object.prototype.hasOwnProperty.call(FALLBACKS, key)) {
    template = FALLBACKS[key];
  } else {
    template = key;
  }
  if (template === 'WGS 84' && key === 'print.datumValue') template = 'NAD 83';
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function roundToNice(rf) {
  const steps = [1000,1250,1500,2000,2500,3000,4000,5000,6000,7500,8000,10000,12000,15000,20000,24000,25000,30000,40000,50000,62500,75000,100000];
  const n = Number(rf);
  if (!Number.isFinite(n) || n <= 0) return 24000;
  let best = steps[0];
  for (const s of steps) if (Math.abs(s - n) < Math.abs(best - n)) best = s;
  if (n > 100000) {
    const mag = 10 ** Math.round(Math.log10(n));
    return Math.round(n / mag) * mag;
  }
  return best;
}

function nest(prefix = '') {
  const leaf = () => (prefix ? t(prefix) : '');
  return new Proxy(leaf, {
    get(_, prop) {
      if (prop === 'toString' || prop === 'valueOf' || prop === Symbol.toPrimitive) {
        return () => (prefix ? t(prefix) : '');
      }
      if (typeof prop === 'symbol') return undefined;
      const key = prefix ? `${prefix}.${String(prop)}` : String(prop);
      if (Object.prototype.hasOwnProperty.call(strings, key)) return t(key);
      return nest(key);
    },
  });
}

/** Nested access: COPY.app.name → t('app.name'). */
export const COPY = nest();

/** RF display: `1:24 000` with a thin space in the number. */
export function formatScaleRatio(n) {
  const raw = Math.round(Number(n));
  if (!Number.isFinite(raw) || raw <= 0) return '';
  const grouped = String(raw).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return t('chrome.scale', { n: grouped });
}

export function applyStaticCopy(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
  if (root === document || root.documentElement) {
    document.title = t('app.documentTitle');
  }
}

export default { t, API_BASE, COPY, roundToNice, formatScaleRatio, applyStaticCopy };
