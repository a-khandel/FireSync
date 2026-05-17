// Live wildfire feed backed by NASA EONET v3 (Earth Observatory Natural
// Event Tracker). No API key required, CORS-enabled, global coverage.
// Returns currently-active wildfire events worldwide; we normalize each
// event to FireSync's internal `Fire` shape and deterministically
// synthesize acres / containment / wind so the rich UI keeps working.
//
// Falls back to the bundled DEMO_FIRES if the feed errors or returns no
// events, so the app stays usable offline.

import { useEffect, useState } from "react";
import { FIRES as DEMO_FIRES } from "./data.js";

const EONET_URL =
  "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=200";
const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = "firesync-feed-v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

const WIND_DIRS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

// One MODIS / VIIRS active-fire pixel covers roughly this much area; we use
// it as a floor when the convex hull of detections is degenerate (1-2 pts).
const DETECTION_PIXEL_ACRES = 100;

// ----- geometry helpers (convex hull, area, bbox) ----------------------

function convexHull(points) {
  if (points.length <= 1) return points.slice();
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (O, A, B) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function polygonAreaMi2(coords) {
  if (coords.length < 3) return 0;
  const cy = coords.reduce((a, [, lat]) => a + lat, 0) / coords.length;
  const cosLat = Math.cos((cy * Math.PI) / 180);
  let a = 0;
  for (let i = 0; i < coords.length; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[(i + 1) % coords.length];
    a += x1 * y2 - x2 * y1;
  }
  return (Math.abs(a) / 2) * 69 * 69 * cosLat;
}

function bboxMi(points, centerLat) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  return {
    widthMi: (east - west) * 69 * cosLat,
    heightMi: (north - south) * 69,
    centerLng: (west + east) / 2,
    centerLat: (south + north) / 2,
    west, east, south, north,
  };
}

function dirToBearing(dir) {
  const m = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return m[dir] != null ? m[dir] : 0;
}

// Build a per-day frame timeline from the satellite detection points,
// where each frame is the cumulative hull (and acres) up to that day.
// Returns null when there isn't enough data to be meaningful.
function buildLiveFrames(timeline, fire) {
  if (!timeline || timeline.length < 1) return null;

  const byDay = new Map();
  for (const t of timeline) {
    const k = (t.date || "").slice(0, 10) || "unknown";
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push([t.lng, t.lat]);
  }
  const dayKeys = [...byDay.keys()].filter((k) => k !== "unknown").sort();
  if (dayKeys.length === 0) return null;

  const bearing = dirToBearing(fire.windDirTo || fire.windDirFrom || "NE");
  const frames = [];
  const accumulated = [];

  for (let i = 0; i < dayKeys.length; i++) {
    accumulated.push(...byDay.get(dayKeys[i]));
    const dedup = dedupePoints(accumulated);

    let polygon, sqMi;
    if (dedup.length >= 3) {
      const hull = convexHull(dedup);
      polygon = closeRing(hull);
      sqMi = polygonAreaMi2(polygon);
    } else {
      // 1–2 points: pad with a small disc around the centroid so we still
      // have a visible polygon and meaningful area.
      const [cx, cy] = centroidOf(dedup);
      polygon = discAround(cx, cy, 0.5);
      sqMi = Math.PI * 0.5 * 0.5;
    }

    // Acres floor based on pixel count so tightly clustered detections
    // still register a credible size.
    const acresFromArea = sqMi * 640;
    const acresFromPixels = dedup.length * DETECTION_PIXEL_ACRES;
    const acres = Math.round(Math.max(acresFromArea, acresFromPixels));
    const r = Math.sqrt(Math.max(0.0001, acres / 640) / Math.PI);
    const bb = bboxMi(dedup, fire.lat);
    const semiMajorMi = Math.max(0.2, Math.max(bb.widthMi, bb.heightMi) / 2);
    const semiMinorMi = Math.max(0.15, Math.min(bb.widthMi, bb.heightMi) / 2);

    frames.push({
      day: frames.length + 1,
      date: dayKeys[i] + "T12:00:00Z",
      acres,
      containmentPct: 0,
      radiusMi: r,
      semiMajorMi,
      semiMinorMi,
      bearingDeg: bearing,
      label:
        i === 0
          ? "First detection"
          : i === dayKeys.length - 1
          ? "Latest detection"
          : `Day ${frames.length + 1}`,
      polygon,
      detectionCount: dedup.length,
    });
  }
  return frames.length ? frames : null;
}

function dedupePoints(pts) {
  const seen = new Set();
  const out = [];
  for (const [lng, lat] of pts) {
    const k = `${lng.toFixed(3)},${lat.toFixed(3)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([lng, lat]);
  }
  return out;
}

function centroidOf(points) {
  let cx = 0, cy = 0;
  for (const [lng, lat] of points) { cx += lng; cy += lat; }
  return [cx / points.length, cy / points.length];
}

function discAround(lng, lat, radiusMi, sides = 24) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const out = [];
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const dLat = (radiusMi * Math.cos(a)) / 69;
    const dLng = (radiusMi * Math.sin(a)) / (69 * cosLat);
    out.push([lng + dLng, lat + dLat]);
  }
  return out;
}

function closeRing(coords) {
  if (coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

// ----- deterministic per-event PRNG ------------------------------------

function seedFromString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ----- normalization ---------------------------------------------------

function parseTitle(rawTitle) {
  const stripped = String(rawTitle || "Wildfire").replace(/^Wildfires?\s*-\s*/i, "").trim();
  const m = stripped.match(/^(.+?),\s*([A-Z]{2,3}(?:,\s*[A-Z]{2,3})?)\s*$/);
  if (m) return { name: m[1].trim(), jurisdiction: stripped };
  return { name: stripped || "Wildfire", jurisdiction: stripped || "Unknown" };
}

function deriveSeverity(acres) {
  if (acres > 80000) return 5;
  if (acres > 25000) return 4;
  if (acres > 6000) return 3;
  if (acres > 1500) return 2;
  return 1;
}

function normalizeEvent(ev) {
  if (!ev || !Array.isArray(ev.geometry) || ev.geometry.length === 0) return null;

  // Extract the full point timeline from the event (EONET aggregates many
  // satellite detections into one event over time — this is real growth).
  const timeline = ev.geometry
    .filter((g) => g && g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2)
    .map((g) => ({ date: g.date, lng: g.coordinates[0], lat: g.coordinates[1] }))
    .filter((t) => typeof t.lng === "number" && typeof t.lat === "number")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (timeline.length === 0) return null;
  const first = timeline[0];
  const latest = timeline[timeline.length - 1];

  const rand = seededRand(seedFromString(ev.id || ev.title || `${latest.lng},${latest.lat}`));
  const { name, jurisdiction } = parseTitle(ev.title);

  // Wind / humidity are not in EONET — synthesize deterministically.
  const windMph = Math.round(5 + rand() * 26);
  const windIdx = Math.floor(rand() * 16);
  const windDirFrom = WIND_DIRS[windIdx];
  const windDirTo = WIND_DIRS[(windIdx + 8) % 16];
  const humidityPct = Math.round(12 + rand() * 40);

  // Build real per-day frames from the detection timeline. If that fails
  // (very sparse data), we fall back to a synthesized progression curve in
  // data.js's getProgression.
  const frames = buildLiveFrames(timeline, {
    lat: latest.lat,
    lng: latest.lng,
    windDirTo,
    windDirFrom,
  });

  // Acres comes from the real hull area when available; otherwise we use a
  // deterministic synthesized fallback so the UI still has a value.
  let acres;
  if (frames && frames.length > 0) {
    acres = frames[frames.length - 1].acres;
  } else {
    acres = Math.round(400 + Math.pow(rand(), 2.3) * 95000);
  }

  // 24h growth from the real timeline if we have at least two frames.
  let growth24hAcres;
  if (frames && frames.length >= 2) {
    growth24hAcres = Math.max(0, frames[frames.length - 1].acres - frames[Math.max(0, frames.length - 2)].acres);
  } else {
    growth24hAcres = Math.round(acres * (0.005 + rand() * 0.06));
  }

  // Containment proxy: if no new detection in >24h the fire is likely
  // cooling; >72h treat as substantially contained. EONET keeps `open`
  // status on events for a while after the satellite has stopped seeing
  // them, so this heuristic captures that "winding down" period.
  const latestMs = latest.date ? new Date(latest.date).getTime() : Date.now();
  const ageHr = (Date.now() - latestMs) / 3_600_000;
  let containmentPct;
  if (ageHr > 72) containmentPct = Math.round(70 + rand() * 25);
  else if (ageHr > 24) containmentPct = Math.round(30 + rand() * 30);
  else if (ageHr > 12) containmentPct = Math.round(10 + rand() * 20);
  else containmentPct = Math.round(rand() * 10);

  const severity = deriveSeverity(acres);
  const evacOrderActive = severity >= 4 && ageHr < 36;

  const id = String(ev.id || ev.title || `${latest.lng}_${latest.lat}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const sourceTags = ["EONET"];
  if (Array.isArray(ev.sources)) {
    for (const s of ev.sources) if (s?.id) sourceTags.push(String(s.id).toUpperCase());
  }

  return {
    id,
    name,
    jurisdiction,
    lat: latest.lat,
    lng: latest.lng,
    acres,
    containmentPct,
    perimeterMi: Math.round(Math.sqrt(Math.max(1, acres) / 640) * Math.PI * 1.6),
    growth24hAcres,
    severity,
    windMph,
    windDirFrom,
    windDirTo,
    humidityPct,
    evacOrderActive,
    detectedAt: first.date || new Date().toISOString(),
    lastUpdateAt: latestMs,
    sources: Array.from(new Set(sourceTags)),
    link: ev.link || null,
    // Live extras consumed by data.js's getProgression / getBurnPolygon.
    geometryTimeline: timeline,
    frames,
  };
}

// ----- fetcher ---------------------------------------------------------

async function fetchEonet() {
  const res = await fetch(EONET_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`EONET ${res.status}`);
  const json = await res.json();
  const events = Array.isArray(json?.events) ? json.events : [];
  return events.map(normalizeEvent).filter(Boolean);
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || Date.now() - obj.t > CACHE_TTL_MS) return null;
    return obj;
  } catch {
    return null;
  }
}

function writeCache(fires, source) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), fires, source }));
  } catch {
    /* private mode etc. */
  }
}

// ----- singleton store + subscribe -------------------------------------

let _fires = [];
let _source = "loading";       // "loading" | "live" | "cache" | "demo-fallback" | "error"
let _fetchedAt = null;
let _error = null;
let _initialized = false;
let _refreshTimer = null;
const _listeners = new Set();

function notify() {
  for (const l of _listeners) l();
}

async function refresh() {
  // Warm-start from cache for instant render on reload.
  if (_fires.length === 0) {
    const cached = readCache();
    if (cached?.fires?.length) {
      _fires = cached.fires;
      _source = "cache";
      _fetchedAt = cached.t;
      notify();
    }
  }

  try {
    const fires = await fetchEonet();
    if (fires.length > 0) {
      _fires = fires;
      _source = "live";
      _fetchedAt = Date.now();
      _error = null;
      writeCache(fires, "live");
      notify();
      return;
    }
    throw new Error("EONET returned no events");
  } catch (err) {
    _error = err?.message || String(err);
    if (_fires.length === 0) {
      // No cache + no live → use the bundled demo fires so the UI works.
      _fires = DEMO_FIRES;
      _source = "demo-fallback";
      _fetchedAt = Date.now();
      notify();
    } else if (_source === "cache") {
      // Cache is fine, keep it but reflect that refresh failed.
      _source = "cache-stale";
      notify();
    }
  }
}

function init() {
  if (_initialized) return;
  _initialized = true;
  refresh();
  _refreshTimer = setInterval(refresh, REFRESH_MS);
}

export function useLiveFires() {
  const [, force] = useState(0);
  useEffect(() => {
    init();
    const listener = () => force((n) => (n + 1) | 0);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);
  return {
    fires: _fires,
    source: _source,
    fetchedAt: _fetchedAt,
    error: _error,
    refresh,
  };
}
