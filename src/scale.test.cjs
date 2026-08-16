"use strict";
const assert = require("assert");

async function main() {
  const {
    parseRfInput,
    getPrintRf,
    setPresetRf,
    setFreeRf,
    DEFAULT_RF,
    RF_PRESETS,
  } = await import("./rf.js");

  assert.strictEqual(DEFAULT_RF, 50000);
  assert.deepStrictEqual(RF_PRESETS, [25000, 50000, 100000, 250000]);

  assert.strictEqual(parseRfInput("1:50 000"), 50000);
  assert.strictEqual(parseRfInput("1/25000"), 25000);
  assert.strictEqual(parseRfInput("100000"), 100000);
  assert.strictEqual(parseRfInput("250k"), 250000);
  assert.strictEqual(parseRfInput("1:250 000"), 250000);
  assert.strictEqual(parseRfInput(""), null);
  assert.strictEqual(parseRfInput("nope"), null);

  assert.strictEqual(getPrintRf(12000), 50000, "default preset is 1:50 000");
  setPresetRf(25000);
  assert.strictEqual(getPrintRf(99999), 25000);
  setPresetRf(250000);
  assert.strictEqual(getPrintRf(), 250000);
  setFreeRf();
  assert.strictEqual(getPrintRf(87654), 87654);
  assert.strictEqual(getPrintRf(null), 50000);

  console.log("scale.test.cjs ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
