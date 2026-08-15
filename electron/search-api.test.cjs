"use strict";
const assert = require("assert");
const searchApi = require("./search-api.cjs");

function hit(path) {
  return new Promise((resolve) => {
    const req = { method: "GET", url: path };
    const res = {
      writeHead(status) {
        this.status = status;
      },
      end(body) {
        resolve({ status: this.status, body: JSON.parse(body) });
      },
    };
    if (!searchApi.maybeHandle(req, res)) {
      resolve({ status: 404, body: { ok: false, error: "not_handled" } });
    }
  });
}

async function main() {
  const empty = await hit("/api/search?q=");
  assert.strictEqual(empty.status, 200);
  assert.strictEqual(empty.body.ok, true);
  assert.deepStrictEqual(empty.body.results, []);
  assert.ok(!empty.body.error);

  const ws = await hit("/api/search?q=%20%20");
  assert.strictEqual(ws.status, 200);
  assert.deepStrictEqual(ws.body.results, []);

  const unrec = await hit("/api/search?q=18SUJ23371");
  assert.strictEqual(unrec.status, 400);
  assert.strictEqual(unrec.body.error, "unrecognized_query");
  assert.deepStrictEqual(unrec.body.results, []);
  assert.strictEqual(unrec.body.ok, false);

  const badll = await hit("/api/search?q=91,0");
  assert.strictEqual(badll.status, 400);
  assert.strictEqual(badll.body.error, "invalid_coordinates");
  assert.deepStrictEqual(badll.body.results, []);
  assert.strictEqual(badll.body.ok, false);

  const badlon = await hit("/api/search?q=38.8895,200");
  assert.strictEqual(badlon.status, 400);
  assert.strictEqual(badlon.body.ok, false);
  assert.strictEqual(badlon.body.error, "invalid_coordinates");
  assert.deepStrictEqual(badlon.body.results, []);

  const nope = await hit("/api/nope");
  assert.strictEqual(nope.status, 404);
  assert.strictEqual(nope.body.ok, false);
  assert.strictEqual(nope.body.error, "not_found");
  assert.deepStrictEqual(nope.body.results, []);

  const dmsQ = encodeURIComponent("38°53'34\"N, 77°02'07\"W");
  const dms = await hit("/api/search?q=" + dmsQ);
  assert.strictEqual(dms.status, 200);
  assert.strictEqual(dms.body.mgrs, "18SUJ2348806846");
  assert.strictEqual(dms.body.type, "latlon");

  const usng = await hit("/api/search?q=" + encodeURIComponent("18S UJ 23371 06519"));
  assert.strictEqual(usng.status, 200);
  assert.strictEqual(usng.body.mgrs, "18SUJ2337106519");
  assert.strictEqual(usng.body.type, "usng");
  assert.strictEqual(usng.body.results[0].kind, "usng");

  const mgrsHit = await hit("/api/search?q=18SUJ2337106519");
  assert.strictEqual(mgrsHit.status, 200);
  assert.strictEqual(mgrsHit.body.mgrs, "18SUJ2337106519");
  assert.strictEqual(mgrsHit.body.type, "mgrs");
  assert.strictEqual(mgrsHit.body.results[0].kind, "mgrs");

  const c0 = await hit("/api/convert?lat=38.8895&lon=-77.0353&precision=0");
  assert.strictEqual(c0.status, 200);
  assert.strictEqual(c0.body.mgrs, "18SUJ");

  const c3 = await hit("/api/convert?lat=38.8895&lon=-77.0353&precision=3");
  assert.strictEqual(c3.status, 200);
  assert.strictEqual(c3.body.mgrs, "18SUJ234064");

  const c4 = await hit("/api/convert?lat=38.8895&lon=-77.0353&precision=4");
  assert.strictEqual(c4.status, 200);
  assert.strictEqual(c4.body.precision, 4);
  assert.strictEqual(c4.body.type, "latlon");
  assert.match(c4.body.mgrs, /^18SUJ\d{8}$/);

  const c5 = await hit("/api/convert?lat=38.8895&lon=-77.0353&precision=5");
  assert.strictEqual(c5.status, 200);
  assert.strictEqual(c5.body.mgrs, "18SUJ2347806483");
  assert.strictEqual(c5.body.type, "latlon");

  const c6 = await hit("/api/convert?lat=38.8895&lon=-77.0353&precision=6");
  assert.strictEqual(c6.status, 400);
  assert.strictEqual(c6.body.error, "invalid_coordinates");

  const health = await hit("/api/health");
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.body.ok, true);
  assert.strictEqual(health.body.service, "mgrs-search");

  const fakeHits = [
    {
      lat: "38.8894754",
      lon: "-77.0352426",
      display_name: "Washington Monument, DC",
      boundingbox: ["38.8893984", "38.8895521", "-77.0353412", "-77.0351439"],
    },
    {
      lat: "39.2974909",
      lon: "-76.6156536",
      display_name: "Washington Monument, Baltimore",
      boundingbox: ["39.297452", "39.2975949", "-76.6157432", "-76.6155667"],
    },
    {
      lat: "43.0387479",
      lon: "-87.9228477",
      display_name: "Washington Monument, Milwaukee",
    },
  ];
  const realFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async function (url, opts) {
    fetchCalls += 1;
    assert.match(String(url), /nominatim\.openstreetmap\.org\/search/);
    assert.strictEqual(opts.headers["User-Agent"], "MGRS-Map-Viewer/0.1 (contact: purnell-dev mgrs-map-viewer)");
    return {
      ok: true,
      status: 200,
      json: async () => fakeHits,
    };
  };
  try {
    const place = await hit("/api/search?q=" + encodeURIComponent("Washington Monument"));
    assert.strictEqual(place.status, 200);
    assert.strictEqual(place.body.ok, true);
    assert.strictEqual(place.body.type, "place");
    assert.ok(place.body.results.length >= 1 && place.body.results.length <= 5);
    assert.strictEqual(place.body.results.length, 3);
    for (const row of place.body.results) {
      assert.strictEqual(row.kind, "place");
      assert.ok(Number.isFinite(row.lat));
      assert.ok(Number.isFinite(row.lon));
      assert.ok(Number.isFinite(row.zoom));
      assert.ok(typeof row.mgrs === "string" && row.mgrs.length > 0);
      assert.ok(typeof row.label === "string" && row.label.length > 0);
    }
    assert.strictEqual(place.body.results[0].label, "Washington Monument, DC");
    assert.strictEqual(place.body.label, "Washington Monument, DC");
    assert.deepStrictEqual(place.body.results[0].bbox, [-77.0353412, 38.8893984, -77.0351439, 38.8895521]);
    assert.deepStrictEqual(place.body.bbox, [-77.0353412, 38.8893984, -77.0351439, 38.8895521]);
    assert.deepStrictEqual(place.body.results[1].bbox, [-76.6157432, 39.297452, -76.6155667, 39.2975949]);
    assert.ok(!Object.prototype.hasOwnProperty.call(place.body.results[2], "bbox"));
    assert.strictEqual(fetchCalls, 1);
  } finally {
    global.fetch = realFetch;
  }

  const retryHits = [
    { lat: "52.52", lon: "13.405", display_name: "Retry Place" },
  ];
  const realFetch2 = global.fetch;
  const retryStatuses = [];
  global.fetch = async function (url, opts) {
    assert.match(String(url), /nominatim\.openstreetmap\.org\/search/);
    assert.strictEqual(opts.headers["User-Agent"], "MGRS-Map-Viewer/0.1 (contact: purnell-dev mgrs-map-viewer)");
    if (retryStatuses.length === 0) {
      retryStatuses.push(429);
      return { ok: false, status: 429, json: async () => ({}) };
    }
    retryStatuses.push(200);
    return { ok: true, status: 200, json: async () => retryHits };
  };
  const t0 = Date.now();
  try {
    const retried = await hit("/api/search?q=" + encodeURIComponent("Retry Place"));
    const elapsed = Date.now() - t0;
    assert.deepStrictEqual(retryStatuses, [429, 200]);
    assert.ok(elapsed >= 1000, "expected >=1s backoff, got " + elapsed);
    assert.strictEqual(retried.status, 200);
    assert.strictEqual(retried.body.ok, true);
    assert.strictEqual(retried.body.results.length, 1);
    assert.strictEqual(retried.body.results[0].label, "Retry Place");
    assert.strictEqual(retried.body.results[0].kind, "place");
    assert.ok(Number.isFinite(retried.body.results[0].lat));
    assert.ok(Number.isFinite(retried.body.results[0].lon));
    assert.ok(Number.isFinite(retried.body.results[0].zoom));
    assert.ok(retried.body.results[0].mgrs);
  } finally {
    global.fetch = realFetch2;
  }

  const svcHits = [{ lat: "48.86", lon: "2.35", display_name: "Service Place" }];
  const realFetch3 = global.fetch;
  const svcStatuses = [];
  global.fetch = async function (url, opts) {
    assert.match(String(url), /nominatim\.openstreetmap\.org\/search/);
    assert.strictEqual(opts.headers["User-Agent"], "MGRS-Map-Viewer/0.1 (contact: purnell-dev mgrs-map-viewer)");
    if (svcStatuses.length === 0) {
      svcStatuses.push(503);
      return { ok: false, status: 503, json: async () => ({}) };
    }
    svcStatuses.push(200);
    return { ok: true, status: 200, json: async () => svcHits };
  };
  const t1 = Date.now();
  try {
    const retried503 = await hit("/api/search?q=" + encodeURIComponent("Service Place"));
    const elapsed503 = Date.now() - t1;
    assert.deepStrictEqual(svcStatuses, [503, 200]);
    assert.ok(elapsed503 >= 1000, "expected >=1s backoff after 503, got " + elapsed503);
    assert.strictEqual(retried503.status, 200);
    assert.strictEqual(retried503.body.results[0].label, "Service Place");
    assert.ok(retried503.body.results[0].mgrs);
  } finally {
    global.fetch = realFetch3;
  }

  const realFetch4 = global.fetch;
  global.fetch = async function () {
    return { ok: false, status: 500, json: async () => ({}) };
  };
  try {
    const up = await hit("/api/search?q=" + encodeURIComponent("Upstream Fail"));
    assert.strictEqual(up.status, 502);
    assert.strictEqual(up.body.ok, false);
    assert.strictEqual(up.body.error, "upstream");
    assert.deepStrictEqual(up.body.results, []);
  } finally {
    global.fetch = realFetch4;
  }

  const realFetch5 = global.fetch;
  global.fetch = async function () {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  };
  try {
    const aborted = await hit("/api/search?q=" + encodeURIComponent("Abort Place"));
    assert.strictEqual(aborted.status, 502);
    assert.strictEqual(aborted.body.ok, false);
    assert.strictEqual(aborted.body.error, "upstream");
    assert.deepStrictEqual(aborted.body.results, []);
  } finally {
    global.fetch = realFetch5;
  }

  const realFetchMiss = global.fetch;
  global.fetch = async function () {
    return { ok: true, status: 200, json: async () => [] };
  };
  try {
    const miss = await hit("/api/search?q=" + encodeURIComponent("No Such Place Zzqx"));
    assert.strictEqual(miss.status, 200);
    assert.strictEqual(miss.body.ok, true);
    assert.deepStrictEqual(miss.body.results, []);
  } finally {
    global.fetch = realFetchMiss;
  }

  async function assertBadConvert(path) {
    const r = await hit(path);
    assert.strictEqual(r.status, 400, path);
    assert.strictEqual(r.body.ok, false);
    assert.strictEqual(r.body.error, "invalid_coordinates");
  }
  await assertBadConvert("/api/convert");
  await assertBadConvert("/api/convert?lat=38.8895");
  await assertBadConvert("/api/convert?lon=-77.0353");
  await assertBadConvert("/api/convert?lat=&lon=-77.0353");
  await assertBadConvert("/api/convert?lat=38.8895&lon=");

  const realFetchQ = global.fetch;
  const fetchAt = [];
  global.fetch = async function (url, opts) {
    assert.match(String(url), /nominatim\.openstreetmap\.org\/search/);
    assert.strictEqual(opts.headers["User-Agent"], "MGRS-Map-Viewer/0.1 (contact: purnell-dev mgrs-map-viewer)");
    fetchAt.push(Date.now());
    return {
      ok: true,
      status: 200,
      json: async () => [{ lat: "1", lon: "2", display_name: "Queued Place" }],
    };
  };
  try {
    await hit("/api/search?q=" + encodeURIComponent("Queue One"));
    await hit("/api/search?q=" + encodeURIComponent("Queue Two"));
    assert.strictEqual(fetchAt.length, 2);
    const gap = fetchAt[1] - fetchAt[0];
    assert.ok(gap >= 1080, "expected Nominatim queue ~1.1s, got " + gap);
  } finally {
    global.fetch = realFetchQ;
  }

  console.log("search-api.test.cjs ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
