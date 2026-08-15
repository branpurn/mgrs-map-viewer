"use strict";
const { spawnSync } = require("child_process");
const path = require("path");
module.exports = async function beforePack() {
  const test = path.join(__dirname, "search-api.test.cjs");
  const r = spawnSync(process.execPath, [test], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("search-api tests failed; refusing to pack");
};
