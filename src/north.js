import { magvar } from 'magvar';

const DEG = Math.PI / 180;

export function utmZone(lon) {
  let z = Math.floor((Number(lon) + 180) / 6) + 1;
  if (z < 1) z = 1;
  if (z > 60) z = 60;
  return z;
}

/** UTM central meridian (degrees). */
export function zoneLon0Deg(zone) {
  return (Number(zone) - 1) * 6 - 180 + 3;
}

/**
 * Grid convergence (degrees, east-positive): angle from true north to grid north.
 * Snyder: γ = atan(tan(λ−λ0) sin φ).
 */
export function gridConvergenceDeg(lon, lat, zone = utmZone(lon)) {
  const φ = Number(lat) * DEG;
  const Δλ = (Number(lon) - zoneLon0Deg(zone)) * DEG;
  if (!Number.isFinite(φ) || !Number.isFinite(Δλ)) return 0;
  return (Math.atan(Math.tan(Δλ) * Math.sin(φ)) / DEG);
}

/** WMM 2025 declination (degrees, east-positive) at the point. */
export function declinationDeg(lon, lat, when = new Date()) {
  void when;
  const d = magvar(Number(lat), Number(lon));
  return Number.isFinite(d) ? d : 0;
}

function toDmsParts(deg) {
  const abs = Math.abs(Number(deg)) || 0;
  let d = Math.floor(abs);
  let m = Math.round((abs - d) * 60);
  if (m === 60) {
    m = 0;
    d += 1;
  }
  return { d, m };
}

/** `9° 30′ W` / `1° 17′ E` */
export function formatAngleDms(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return '0° 00′';
  const { d, m } = toDmsParts(n);
  const hemi = n > 0.008 ? 'E' : n < -0.008 ? 'W' : '';
  const core = `${d}° ${String(m).padStart(2, '0')}′`;
  return hemi ? `${core} ${hemi}` : core;
}

/**
 * Live north diagram numbers at the frame center.
 * G–M is magnetic minus grid (east-positive): the angle from GN to MN.
 */
export function northAt(lon, lat) {
  const zone = utmZone(lon);
  const decl = declinationDeg(lon, lat);
  const conv = gridConvergenceDeg(lon, lat, zone);
  const gm = decl - conv;
  return {
    zone,
    decl,
    conv,
    gm,
    declText: formatAngleDms(decl),
    convText: formatAngleDms(conv),
    gmText: `G–M ${formatAngleDms(gm)}`,
    convLine: `convergence ${formatAngleDms(conv)}`,
  };
}

/** SVG point from the diagram base, east-positive degrees from up. */
export function ray(cx, by, deg, len) {
  const rad = (Number(deg) || 0) * DEG;
  return [cx + len * Math.sin(rad), by - len * Math.cos(rad)];
}
