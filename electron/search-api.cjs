"use strict";
const mgrs = require("mgrs");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "MGRS-Map-Viewer/0.1 (contact: purnell-dev mgrs-map-viewer)";

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
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

function encodeMgrs(lat, lon) {
  try {
    return String(mgrs.forward([lon, lat], 5)).replace(/\s+/g, "").toUpperCase();
  } catch (e) {
    return "";
  }
}

function hitFromNominatim(item) {
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let bbox = null;
  const raw = item.boundingbox;
  if (Array.isArray(raw) && raw.length === 4) {
    const south = Number(raw[0]), north = Number(raw[1]);
    const west = Number(raw[2]), east = Number(raw[3]);
    if ([south, north, west, east].every(Number.isFinite)) bbox = [west, south, east, north];
  }
  const row = {
    label: item.display_name || item.name || (lat + ", " + lon),
    lat, lon, kind: "place", zoom: zoomFromBbox(bbox),
    mgrs: encodeMgrs(lat, lon), precision: 5,
  };
  if (bbox) row.bbox = bbox;
  return row;
}

function mirror(query, results) {
  const body = { ok: true, query, results };
  if (results.length) {
    const f = results[0];
    body.type = f.kind; body.lat = f.lat; body.lon = f.lon;
    body.zoom = f.zoom; body.mgrs = f.mgrs; body.label = f.label;
    body.precision = f.precision;
    if (f.bbox) body.bbox = f.bbox;
  }
  return body;
}

function maybeHandle(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname !== "/api/search" && url.pathname !== "/api/search/") return false;
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" });
    res.end();
    return true;
  }
  if (req.method !== "GET") return false;
  const q = url.searchParams.get("q");
  const original = q == null ? "" : q;
  if (q == null || !String(q).trim()) {
    json(res, 200, { ok: true, query: original, results: [] });
    return true;
  }
  const params = new URLSearchParams({ q: String(q).trim(), format: "jsonv2", limit: "5" });
  fetch(NOMINATIM + "?" + params, {
    headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en" },
  })
    .then(function (r) {
      if (!r.ok) throw new Error("Nominatim HTTP " + r.status);
      return r.json();
    })
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
      json(res, 502, { ok: false, error: "upstream", message: String(err.message || err), results: [], query: original });
    });
  return true;
}

module.exports = { maybeHandle };
