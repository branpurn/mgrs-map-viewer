"use strict";
const assert = require("assert");

async function main() {
  const { northAt, formatAngleDms, gridConvergenceDeg } = await import("./north.js");

  const dc = northAt(-77.0353, 38.8895);
  assert.ok(dc.decl < -9 && dc.decl > -12, `DC decl ${dc.decl}`);
  assert.ok(dc.conv < -0.8 && dc.conv > -1.8, `DC conv ${dc.conv}`);
  assert.ok(dc.gm < -8 && dc.gm > -11, `DC G-M ${dc.gm}`);
  assert.match(dc.gmText, /^G–M \d+° \d{2}′ W$/);
  assert.match(dc.convLine, /^convergence \d+° \d{2}′ W$/);

  const ftig = northAt(-76.5764, 40.4347);
  assert.ok(ftig.gm !== dc.gm, "FTIG G-M must not be the DC lock");
  assert.match(ftig.gmText, /^G–M \d+° \d{2}′ W$/);

  const syd = northAt(151.2093, -33.8688);
  assert.ok(syd.decl > 10 && syd.decl < 15, `Sydney decl ${syd.decl}`);
  assert.ok(syd.gm !== dc.gm, "Sydney G-M must not be the DC lock");

  const lon = northAt(-0.1278, 51.5074);
  assert.ok(Math.abs(lon.decl) < 4, `London decl ${lon.decl}`);

  assert.strictEqual(formatAngleDms(-9.5), "9° 30′ W");
  assert.strictEqual(formatAngleDms(1 + 17 / 60), "1° 17′ E");
  assert.ok(Math.abs(gridConvergenceDeg(-75, 38.89, 18)) < 0.05);

  console.log("north.test.cjs ok", dc.gmText, dc.convLine);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
