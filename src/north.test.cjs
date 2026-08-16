"use strict";
const assert = require("assert");

async function main() {
  const { northAt, formatAngleDms, gridConvergenceDeg, gridNorthBearing, orientGridNorth } = await import("./north.js");

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
  assert.ok(Math.abs(gridNorthBearing(-76.5764, 40.4347) - gridConvergenceDeg(-76.5764, 40.4347)) < 1e-9);
  assert.ok(gridNorthBearing(-76.5764, 40.4347) < -0.6 && gridNorthBearing(-76.5764, 40.4347) > -1.4, "FTIG grid-north bearing");

  let set = null;
  const mock = {
    getCenter: () => ({ lng: -76.5764, lat: 40.4347 }),
    getBearing: () => 0,
    setBearing: (b) => { set = b; },
  };
  const aimed = orientGridNorth(mock);
  assert.ok(aimed < -0.6 && aimed > -1.4);
  assert.strictEqual(set, aimed);

  // A grid-north rhumb at FTIG is ~1° off a north-up mercator frame; after
  // the MapLibre CCW bearing it sits on the +Y axis (square to the neatline).
  const lon0 = -76.5764;
  const lat0 = 40.4347;
  const convRad = gridConvergenceDeg(lon0, lat0) * Math.PI / 180;
  const d = 2000 / 6378137;
  const lat1 = lat0 + (d * Math.cos(convRad) * 180) / Math.PI;
  const lon1 = lon0 + (d * Math.sin(convRad) / Math.cos(lat0 * Math.PI / 180) * 180) / Math.PI;
  const merc = (lon, lat) => ({
    x: lon * Math.PI / 180,
    y: Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)),
  });
  const pa = merc(lon0, lat0);
  const pb = merc(lon1, lat1);
  const tiltUp = Math.atan2(pb.x - pa.x, pb.y - pa.y) * 180 / Math.PI;
  assert.ok(Math.abs(tiltUp) > 0.6, `north-up tilt ${tiltUp}`);
  const br = gridNorthBearing(lon0, lat0) * Math.PI / 180;
  const rx = (pb.x - pa.x) * Math.cos(br) - (pb.y - pa.y) * Math.sin(br);
  const ry = (pb.x - pa.x) * Math.sin(br) + (pb.y - pa.y) * Math.cos(br);
  const after = Math.atan2(rx, ry) * 180 / Math.PI;
  assert.ok(Math.abs(after) < 0.08, `grid-north tilt ${after}`);

  console.log("north.test.cjs ok", dc.gmText, dc.convLine);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
