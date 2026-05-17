// Driving-route fetcher for evacuation overlays. Calls the free public
// OSRM demo server (no API key), caches results in memory, and falls
// back to a Bezier-curved straight line if OSRM is unreachable.

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const TIMEOUT_MS = 4500;

const cache = new Map();

function cacheKey(from, to) {
  return `${from[0].toFixed(4)},${from[1].toFixed(4)}|${to[0].toFixed(4)},${to[1].toFixed(4)}`;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function bezierFallback(from, to) {
  // 24-point quadratic bezier through a control point offset perpendicular
  // to the from→to line — gives a curve that visually reads as a route.
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const cx = mx - dy * 0.18;
  const cy = my + dx * 0.18;
  const pts = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * cx + t * t * to[0];
    const y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * cy + t * t * to[1];
    pts.push([x, y]);
  }
  return {
    coordinates: pts,
    durationSec: estimateDuration(from, to),
    distanceMi: estimateDistance(from, to),
    source: "fallback",
  };
}

function estimateDistance(from, to) {
  const cosLat = Math.cos((((from[1] + to[1]) / 2) * Math.PI) / 180);
  const dN = (to[1] - from[1]) * 69;
  const dE = (to[0] - from[0]) * 69 * cosLat;
  return Math.sqrt(dN * dN + dE * dE);
}

function estimateDuration(from, to) {
  return (estimateDistance(from, to) / 35) * 3600; // 35 mph avg
}

export async function fetchRoute(from, to) {
  const key = cacheKey(from, to);
  if (cache.has(key)) return cache.get(key);

  const url = `${OSRM_BASE}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
  try {
    const res = await withTimeout(fetch(url), TIMEOUT_MS);
    if (!res.ok) throw new Error(`osrm ${res.status}`);
    const json = await res.json();
    const r = json?.routes?.[0];
    if (!r?.geometry?.coordinates?.length) throw new Error("no route");
    const route = {
      coordinates: r.geometry.coordinates,
      durationSec: r.duration,
      distanceMi: r.distance / 1609.34,
      source: "osrm",
    };
    cache.set(key, route);
    return route;
  } catch (err) {
    const fb = bezierFallback(from, to);
    cache.set(key, fb);
    return fb;
  }
}

export async function fetchRoutesForPlan(plan) {
  const out = await Promise.all(
    plan.zones.map(async (z) => {
      if (!z.shelter) return null;
      const r = await fetchRoute(z.centroid, [z.shelter.lng, z.shelter.lat]);
      return { zoneId: z.id, ...r };
    })
  );
  return out.filter(Boolean);
}
