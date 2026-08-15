"use strict";
/**
 * Locked search contract (wave 1). No auth, CORS *.
 * GET /api/health -> 200 {ok:true, service:"mgrs-search"}
 * GET /api/search?q= always results[]. Root mirrors first hit.
 * Empty/whitespace q -> 200 {ok:true, query, results:[]}. Never 400/404.
 * Detect: MGRS/USNG, decimal lat/lon, DMS, then Nominatim (limit 5).
 * Hit {label,lat,lon,kind,zoom,mgrs,precision,bbox?}; kind/type place|mgrs|usng|latlon.
 * Odd/undecodable MGRS -> 400 unrecognized_query. Out-of-range lat/lon -> 400 invalid_coordinates.
 * No lon/lat swap. Unknown place -> 200 results:[]. Nominatim fail -> 502 upstream.
 * Unknown GET /api/* -> 404 not_found.
 * GET /api/convert?lat=&lon=&precision=5 -> 200 {ok,lat,lon,mgrs,label,precision,zoom,type:"latlon"}.
 * Missing/empty lat or lon, or precision outside 0-5 -> 400 invalid_coordinates.
 */
const mgrs = require("mgrs");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "MGRS-Map-Viewer/0.1 (contact: purnell-dev mgrs-map-viewer)";
const NOMINATIM_GAP_MS = 1100;
const NOMINATIM_RETRIES = 3;

let nominatimNextAt = 0;
let nominatimChain = Promise.resolve();

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function waitNominatimSlot() {
  const run = nominatimChain.then(function () {
    const wait = Math.max(0, nominatimNextAt - Date.now());
    nominatimNextAt = Date.now() + wait + NOMINATIM_GAP_MS;
    return sleep(wait);
  });
  nominatimChain = run.then(function () {}, function () {});
  return run;
}

function nominatimSearch(q) {
  const params = new URLSearchParams({ q: q, format: "jsonv2", limit: "5" });
  const url = NOMINATIM + "?" + params;
  let delay = 1000;
  let attempt = 0;

  function once() {
    return waitNominatimSlot().then(function () {
      return fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en" },
      });
    }).then(function (r) {
      if (r.status === 429 || r.status === 503) {
        attempt += 1;
        if (attempt >= NOMINATIM_RETRIES) {
          throw new Error("Nominatim HTTP " + r.status);
        }
        const wait = delay;
        delay *= 2;
        return sleep(wait).then(once);
      }
      if (!r.ok) throw new Error("Nominatim HTTP " + r.status);
      return r.json();
    });
  }
  return once();
}

const ZOOM_MGRS = { 0: 8, 1: 10, 2: 13, 3: 15, 4: 17, 5: 18 };
const MGRS_LOOSE = /^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d{0,10})$/;
const DECIMAL = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/;
const HEMI_SUFFIX =
  /^(\d+(?:\.\d+)?)\s*([NSns])\s*[,;\s]\s*(\d+(?:\.\d+)?)\s*([EWew])$/;
const HEMI_PREFIX =
  /^([NSns])\s*(\d+(?:\.\d+)?)\s*[,;\s]\s*([EWew])\s*(\d+(?:\.\d+)?)$/;
const DMS =
  /^(\d{1,3})\s*[°d\s]\s*(\d{1,2})\s*['′m\s]\s*(\d{1,2}(?:\.\d+)?)\s*["″s]?\s*([NSns])\s*[,;\s]+\s*(\d{1,3})\s*[°d\s]\s*(\d{1,2})\s*['′m\s]\s*(\d{1,2}(?:\.\d+)?)\s*["″s]?\s*([EWew])$/;
const DDM =
  /^(\d{1,3})\s*[°d\s]\s*(\d{1,2}(?:\.\d+)?)\s*['′]?\s*([NSns])\s*[,;\s]+\s*(\d{1,3})\s*[°d\s]\s*(\d{1,2}(?:\.\d+)?)\s*['′]?\s*([EWew])$/;

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function corsPreflight(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
  res.end();
}

function zoomFromBbox(bbox) {
  if (!bbox || bbox.length < 4) return 12;
  const span = Math.abs(bbox[2] - bbox[0]);
  if (span > 10) return 6;
  if (span > 2) return 8;
  if (span > 0.5) return 10;
  if (span > 0.1) return 12;
  if (span > 0.02) return 14;
  return 16;
}

function encodeMgrs(lat, lon, precision) {
  const p = Number.isFinite(precision) ? precision : 5;
  try {
    return String(mgrs.forward([lon, lat], p)).replace(/\s+/g, "").toUpperCase();
  } catch (e) {
    return "";
  }
}

function inRange(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function normalize(q) {
  return String(q || "")
    .replace(/\u2212/g, "-")
    .replace(/[º˚]/g, "°")
    .replace(/[′’‘]/g, "'")
    .replace(/[″”“]/g, '"');
}

function decimalPlaces(token) {
  const t = String(token).replace(/^[+-]/, "");
  if (!t.includes(".")) return 0;
  return t.split(".")[1].length;
}

function zoomDecimal(latDec, lonDec) {
  const n = Math.max(latDec, lonDec);
  if (n >= 6) return 17;
  if (n >= 5) return 16;
  return 14;
}

function hitFromNominatim(item) {
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!inRange(lat, lon)) return null;
  let bbox = null;
  const raw = item.boundingbox;
  if (Array.isArray(raw) && raw.length === 4) {
    const south = Number(raw[0]),
      north = Number(raw[1]);
    const west = Number(raw[2]),
      east = Number(raw[3]);
    if ([south, north, west, east].every(Number.isFinite)) bbox = [west, south, east, north];
  }
  const row = {
    label: item.display_name || item.name || lat + ", " + lon,
    lat,
    lon,
    kind: "place",
    zoom: zoomFromBbox(bbox),
    mgrs: encodeMgrs(lat, lon, 5),
    precision: 5,
  };
  if (bbox) row.bbox = bbox;
  return row;
}

function mirror(query, results) {
  const body = { ok: true, query, results };
  if (results.length) {
    const f = results[0];
    body.type = f.kind;
    body.lat = f.lat;
    body.lon = f.lon;
    body.zoom = f.zoom;
    body.mgrs = f.mgrs;
    body.label = f.label;
    body.precision = f.precision;
    if (f.bbox) body.bbox = f.bbox;
  }
  return body;
}

function coordHit(kind, lat, lon, extras) {
  const precision = extras.precision != null ? extras.precision : 5;
  return {
    label: extras.label,
    lat,
    lon,
    kind,
    zoom: extras.zoom,
    mgrs: extras.mgrs || encodeMgrs(lat, lon, precision),
    precision,
  };
}

function parseLocal(q) {
  const text = normalize(q).trim();
  const compact = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const mgrsMatch = compact.match(MGRS_LOOSE);
  if (mgrsMatch) {
    if (mgrsMatch[4].length % 2 !== 0) {
      return { error: "unrecognized_query", message: "MGRS easting and northing must be an even number of digits" };
    }
    try {
      const [lon, lat] = mgrs.toPoint(compact);
      if (inRange(lat, lon)) {
        const precision = Math.min(5, mgrsMatch[4].length / 2);
        const spaced = /\s/.test(text);
        return coordHit(spaced ? "usng" : "mgrs", lat, lon, {
          label: spaced ? text.replace(/\s+/g, " ").toUpperCase() : compact,
          mgrs: compact,
          precision,
          zoom: ZOOM_MGRS[precision] != null ? ZOOM_MGRS[precision] : 13,
        });
      }
      return { error: "invalid_coordinates", message: "MGRS converted out of range" };
    } catch (e) {
      return { error: "unrecognized_query", message: "Could not decode MGRS grid " + compact };
    }
  }

  let m = text.match(HEMI_SUFFIX);
  if (m) {
    let lat = parseFloat(m[1]);
    let lon = parseFloat(m[3]);
    if (m[2].toUpperCase() === "S") lat = -Math.abs(lat);
    else lat = Math.abs(lat);
    if (m[4].toUpperCase() === "W") lon = -Math.abs(lon);
    else lon = Math.abs(lon);
    if (inRange(lat, lon)) {
      return coordHit("latlon", lat, lon, {
        label: lat.toFixed(5) + ", " + lon.toFixed(5),
        zoom: zoomDecimal(decimalPlaces(m[1]), decimalPlaces(m[3])),
      });
    }
    return { error: "invalid_coordinates", message: "Latitude or longitude out of range" };
  }

  m = text.match(HEMI_PREFIX);
  if (m) {
    let lat = parseFloat(m[2]);
    let lon = parseFloat(m[4]);
    if (m[1].toUpperCase() === "S") lat = -Math.abs(lat);
    else lat = Math.abs(lat);
    if (m[3].toUpperCase() === "W") lon = -Math.abs(lon);
    else lon = Math.abs(lon);
    if (inRange(lat, lon)) {
      return coordHit("latlon", lat, lon, {
        label: lat.toFixed(5) + ", " + lon.toFixed(5),
        zoom: zoomDecimal(decimalPlaces(m[2]), decimalPlaces(m[4])),
      });
    }
    return { error: "invalid_coordinates", message: "Latitude or longitude out of range" };
  }

  m = text.match(DMS);
  if (m) {
    const dmsToDec = (d, min, sec, hemi) => {
      let v = Number(d) + Number(min) / 60 + Number(sec || 0) / 3600;
      const h = String(hemi).toUpperCase();
      if (h === "S" || h === "W") v = -Math.abs(v);
      else v = Math.abs(v);
      return v;
    };
    const lat = dmsToDec(m[1], m[2], m[3], m[4]);
    const lon = dmsToDec(m[5], m[6], m[7], m[8]);
    if (inRange(lat, lon)) {
      return coordHit("latlon", lat, lon, {
        label: text,
        zoom: 15,
      });
    }
    return { error: "invalid_coordinates", message: "DMS coordinates are out of range" };
  }

  m = text.match(DDM);
  if (m) {
    const ddmToDec = (d, min, hemi) => {
      let v = Number(d) + Number(min) / 60;
      const h = String(hemi).toUpperCase();
      if (h === "S" || h === "W") v = -Math.abs(v);
      else v = Math.abs(v);
      return v;
    };
    const lat = ddmToDec(m[1], m[2], m[3]);
    const lon = ddmToDec(m[4], m[5], m[6]);
    if (inRange(lat, lon)) {
      return coordHit("latlon", lat, lon, {
        label: text,
        zoom: 15,
      });
    }
    return { error: "invalid_coordinates", message: "DMS coordinates are out of range" };
  }

  m = text.match(DECIMAL);
  if (m) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (inRange(lat, lon)) {
      return coordHit("latlon", lat, lon, {
        label: lat.toFixed(Math.max(5, decimalPlaces(m[1]))) + ", " + lon.toFixed(Math.max(5, decimalPlaces(m[2]))),
        zoom: zoomDecimal(decimalPlaces(m[1]), decimalPlaces(m[2])),
      });
    }
    return { error: "invalid_coordinates", message: "Latitude or longitude out of range" };
  }

  return null;
}

function handleSearch(req, res, url) {
  const q = url.searchParams.get("q");
  const original = q == null ? "" : q;
  if (q == null || !String(q).trim()) {
    json(res, 200, { ok: true, query: original, results: [] });
    return;
  }

  const local = parseLocal(String(q).trim());
  if (local && local.error) {
    json(res, 400, {
      ok: false,
      error: local.error,
      message: local.message,
      results: [],
      query: original,
    });
    return;
  }
  if (local) {
    json(res, 200, mirror(original, [local]));
    return;
  }

  nominatimSearch(String(q).trim())
    .then(function (data) {
      if (!Array.isArray(data)) throw new Error("bad nominatim payload");
      const results = [];
      for (const item of data.slice(0, 5)) {
        const hit = hitFromNominatim(item);
        if (hit) results.push(hit);
      }
      json(res, 200, mirror(original, results));
    })
    .catch(function (err) {
      json(res, 502, {
        ok: false,
        error: "upstream",
        message: String(err.message || err),
        results: [],
        query: original,
      });
    });
}

function handleConvert(req, res, url) {
  const latRaw = url.searchParams.get("lat");
  const lonRaw = url.searchParams.get("lon");
  const precRaw = url.searchParams.get("precision");

  if (latRaw == null || lonRaw == null || String(latRaw).trim() === "" || String(lonRaw).trim() === "") {
    json(res, 400, { ok: false, error: "invalid_coordinates", results: [] });
    return;
  }

  const lat = parseFloat(latRaw);
  const lon = parseFloat(lonRaw);
  let precision = 5;
  if (precRaw != null && String(precRaw).trim() !== "") {
    const p = Number(precRaw);
    if (!Number.isInteger(p) || p < 0 || p > 5) {
      json(res, 400, { ok: false, error: "invalid_coordinates", results: [] });
      return;
    }
    precision = p;
  }

  if (!inRange(lat, lon)) {
    json(res, 400, { ok: false, error: "invalid_coordinates", results: [] });
    return;
  }

  const encoded = encodeMgrs(lat, lon, precision);
  if (!encoded) {
    json(res, 400, { ok: false, error: "invalid_coordinates", results: [] });
    return;
  }

  json(res, 200, {
    ok: true,
    lat,
    lon,
    mgrs: encoded,
    label: encoded,
    precision,
    zoom: ZOOM_MGRS[precision] != null ? ZOOM_MGRS[precision] : 13,
    type: "latlon",
  });
}

function maybeHandle(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (req.method === "OPTIONS" && path.startsWith("/api/")) {
    corsPreflight(res);
    return true;
  }

  if (path === "/api/health" && req.method === "GET") {
    json(res, 200, { ok: true, service: "mgrs-search" });
    return true;
  }

  if (path === "/api/search" && req.method === "GET") {
    handleSearch(req, res, url);
    return true;
  }

  if (path === "/api/convert" && req.method === "GET") {
    handleConvert(req, res, url);
    return true;
  }

  if (path.startsWith("/api/") && req.method === "GET") {
    json(res, 404, { ok: false, error: "not_found", message: "Unknown API route", results: [] });
    return true;
  }

  return false;
}

module.exports = { maybeHandle };
