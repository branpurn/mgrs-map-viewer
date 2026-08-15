/** Locked copy: import strings.json only. Flat keys via t(). */

import strings from '../strings.json';

export const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

/**
 * Look up a flat key from strings.json and replace `{name}` tokens.
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, vars = {}) {
  const template = Object.prototype.hasOwnProperty.call(strings, key)
    ? strings[key]
    : key;
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

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

export default { t, API_BASE, formatScaleRatio, applyStaticCopy };
