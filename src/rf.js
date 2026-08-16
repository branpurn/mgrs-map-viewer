export const RF_PRESETS = [25000, 50000, 100000, 250000];
export const DEFAULT_RF = 50000;

let rfMode = 'preset';
let lockedRf = DEFAULT_RF;

export function isPresetRf() {
  return rfMode === 'preset' && Number.isFinite(lockedRf);
}

export function getLockedRf() {
  return isPresetRf() ? lockedRf : null;
}

export function getPrintRf(liveRf) {
  if (isPresetRf()) return lockedRf;
  const n = Number(liveRf);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_RF;
}

export function setPresetRf(rf) {
  const n = Number(rf);
  if (!Number.isFinite(n) || n < 100) return;
  rfMode = 'preset';
  lockedRf = Math.round(n);
}

export function setFreeRf() {
  rfMode = 'free';
  lockedRf = null;
}

/** Parse `1:50 000`, `1/50000`, `50k`, or `50000`. */
export function parseRfInput(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s,\u202f]/g, '');
  if (!s) return null;
  const k = s.match(/^(?:1[:/])?(\d+(?:\.\d+)?)k$/);
  if (k) {
    const n = Math.round(Number(k[1]) * 1000);
    return n >= 100 && n <= 5000000 ? n : null;
  }
  const m = s.match(/^(?:1[:/])?(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 100 || n > 5000000) return null;
  return Math.round(n);
}
