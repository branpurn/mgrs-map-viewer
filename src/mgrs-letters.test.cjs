"use strict";
const assert = require("assert");
const mgrs = require("mgrs");

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const E4 = E2 * E2;
const E6 = E4 * E2;
const M1 = 1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256;
const M2 = 3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024;
const M3 = 15 * E4 / 256 + 45 * E6 / 1024;
const M4 = 35 * E6 / 3072;

function utmZone(lon) {
  let z = Math.floor((lon + 180) / 6) + 1;
  if (z < 1) z = 1;
  if (z > 60) z = 60;
  return z;
}

function latLonToUtm(lon, lat, zone) {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  const λ0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const sinφ = Math.sin(φ);
  const cosφ = Math.cos(φ);
  const tanφ = Math.tan(φ);
  const N = A / Math.sqrt(1 - E2 * sinφ * sinφ);
  const T = tanφ * tanφ;
  const C = EP2 * cosφ * cosφ;
  const AA = cosφ * (λ - λ0);
  const M = A * (M1 * φ - M2 * Math.sin(2 * φ) + M3 * Math.sin(4 * φ) - M4 * Math.sin(6 * φ));
  const easting =
    K0 * N * (AA + ((1 - T + C) * AA ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * AA ** 5) / 120) +
    500000;
  let northing =
    K0 *
    (M +
      N *
        tanφ *
        (AA ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C * C) * AA ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * AA ** 6) / 720));
  if (lat < 0) northing += 10000000;
  return { easting, northing, zone };
}

async function main() {
  const { squareLettersFromUtm } = await import("./mgrs-letters.js");

  const pts = [
    [-76.5764, 40.4347],
    [-77.9989, 39.9326],
    [-77.0353, 38.8895],
    [-75, 40],
    [151.2093, -33.8688],
    [-0.1278, 51.5074],
  ];

  for (const [lon, lat] of pts) {
    const compact = mgrs.forward([lon, lat]);
    const letters = compact.replace(/^\d{1,2}[C-HJ-NP-X]/, "").slice(0, 2);
    const zone = utmZone(lon);
    const u = latLonToUtm(lon, lat, zone);
    const got = squareLettersFromUtm(zone, u.easting, u.northing);
    assert.strictEqual(got, letters, `${lon},${lat} ${compact} → ${got}`);
  }

  // West of 78°W: geographic MGRS is 17S QE; a zone-18 sheet stays TK.
  const u18 = latLonToUtm(-78.05, 39.9326, 18);
  assert.strictEqual(squareLettersFromUtm(18, u18.easting, u18.northing), "TK");
  assert.match(mgrs.forward([-78.05, 39.9326]), /^17S/);

  console.log("mgrs-letters.test.cjs ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
