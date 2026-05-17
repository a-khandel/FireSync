// Pure FIRMS clustering — imported by Web Worker and main-thread fallback.

/** Hotspots weaker than this (MW) are skipped before clustering — reduces noise pins. */
const MIN_FRP_MW = 10;

const CLUSTER_CELL = 0.5;
const CLUSTER_THRESH_SQ = 0.5 * 0.5;

/** Lowercase CSV keys */
export function normalizeRow(raw) {
  const r = {};
  for (const [k, v] of Object.entries(raw)) {
    r[String(k).trim().toLowerCase()] = typeof v === "string" ? v.trim() : v;
  }
  return r;
}

/**
 * FIRMS date parse — yyyy-mm-dd or yyyymmdd + acquisition time (UTC).
 * NASA encodes `acq_time` as HHMM; CSV often drops leading zeros (`30` → 00:30)
 * or stores it as a compact number (`1135` → 11:35). One- or two-digit values
 * in 0…23 are still treated as hour-only (e.g. `5` → 05:00) for compatibility.
 */
export function parseAcqMs(acqDate, acqTime) {
  if (!acqDate) return 0;
  const ds = String(acqDate).replace(/\D/g, "");
  if (ds.length < 8) return 0;
  const y = +ds.slice(0, 4);
  const mo = +ds.slice(4, 6) - 1;
  const d = +ds.slice(6, 8);

  const digitsOnly = String(acqTime ?? "").replace(/\D/g, "");

  let hh = 0;
  let mm = 0;
  let ss = 0;

  if (!digitsOnly) {
    return Date.UTC(y, mo, d, hh, mm, ss);
  }

  if (digitsOnly.length >= 6) {
    const tail = digitsOnly.slice(-6);
    hh = +tail.slice(0, 2);
    mm = +tail.slice(2, 4);
    ss = +tail.slice(4, 6);
    return Date.UTC(y, mo, d, hh, mm, ss);
  }

  const n = parseInt(digitsOnly, 10);
  if (!Number.isFinite(n) || n < 0) {
    return Date.UTC(y, mo, d, hh, mm, ss);
  }

  if (digitsOnly.length <= 2 && n <= 23) {
    hh = n;
    mm = 0;
    ss = 0;
    return Date.UTC(y, mo, d, hh, mm, ss);
  }

  // HHMM as integer: 30 → 00:30, 130 → 01:30, 1135 → 11:35, 1300 → 13:00
  hh = Math.floor(n / 100);
  mm = n % 100;
  if (mm > 59 || hh > 23) {
    return Date.UTC(y, mo, d, 0, 0, 0);
  }

  return Date.UTC(y, mo, d, hh, mm, ss);
}

export function rowToPoint(row) {
  // VIIRS CSV per NASA FIRMS: h (high), n (nominal), l (low). Thermal detects both day & night passes;
  // daynight column is D/N orbit, not “no detection at night”.
  const conf = String(row.confidence ?? "").trim().toLowerCase();
  if (conf !== "h" && conf !== "n" && conf !== "l") return null;
  const lat = parseFloat(row.latitude);
  const lng = parseFloat(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const frp = parseFloat(row.frp);
  const frpN = Number.isFinite(frp) ? frp : 0;
  if (frpN <= MIN_FRP_MW) return null;
  const daynight = String(row.daynight ?? "").toUpperCase().slice(0, 1) || "?";
  const acqMs = parseAcqMs(row.acq_date, row.acq_time);
  return { lat, lng, frp: frpN, daynight, acqMs };
}

function cellKeysForPoint(lat, lng) {
  const gy = Math.floor(lat / CLUSTER_CELL);
  const gx = Math.floor(lng / CLUSTER_CELL);
  const keys = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      keys.push(`${gy + dy},${gx + dx}`);
    }
  }
  return keys;
}

function distSq(a, b) {
  const dl = a.lat - b.lat;
  const dn = a.lng - b.lng;
  return dl * dl + dn * dn;
}

/**
 * Greedy spatial clustering: assign each point to first cluster within 0.5° (euclidean on lat/lon).
 * Points sorted day-first (D before N), then newest acquisition first for stability.
 */
export function clusterPointsGreedy(points) {
  const sorted = [...points].sort((a, b) => {
    const da = a.daynight === "D" ? 0 : 1;
    const db = b.daynight === "D" ? 0 : 1;
    if (da !== db) return da - db;
    return (b.acqMs || 0) - (a.acqMs || 0);
  });

  const clusters = []; // { points: Point[] }
  const cellMap = new Map(); // cellKey -> Set cluster index

  function registerClusterCells(ci, lat, lng) {
    for (const nk of cellKeysForPoint(lat, lng)) {
      if (!cellMap.has(nk)) cellMap.set(nk, new Set());
      cellMap.get(nk).add(ci);
    }
  }

  for (const p of sorted) {
    const candidates = new Set();
    for (const nk of cellKeysForPoint(p.lat, p.lng)) {
      const set = cellMap.get(nk);
      if (!set) continue;
      for (const ci of set) candidates.add(ci);
    }

    let assigned = -1;
    for (const ci of candidates) {
      const pts = clusters[ci].points;
      for (let i = 0; i < pts.length; i++) {
        if (distSq(p, pts[i]) <= CLUSTER_THRESH_SQ) {
          assigned = ci;
          break;
        }
      }
      if (assigned >= 0) break;
    }

    if (assigned < 0) {
      assigned = clusters.length;
      clusters.push({ points: [] });
    }

    clusters[assigned].points.push(p);
    registerClusterCells(assigned, p.lat, p.lng);
  }

  return clusters.map((c) => c.points);
}

export function summarizeCluster(points) {
  const n = points.length;
  if (!n) return null;
  let sumLat = 0;
  let sumLng = 0;
  let maxFrp = 0;
  let latestMs = -Infinity;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
    maxFrp = Math.max(maxFrp, p.frp);
    latestMs = Math.max(latestMs, p.acqMs || 0);
  }
  const lat = sumLat / n;
  const lng = sumLng / n;
  const updatedMs = Number.isFinite(latestMs) && latestMs > 0 ? latestMs : Date.now();
  return {
    lat,
    lng,
    point_count: n,
    max_frp: maxFrp,
    updated_at: new Date(updatedMs).toISOString(),
  };
}

export function runPipeline(csvRows) {
  const pts = [];
  for (const raw of csvRows) {
    const row = normalizeRow(raw);
    const p = rowToPoint(row);
    if (p) pts.push(p);
  }
  const grouped = clusterPointsGreedy(pts);
  const summaries = [];
  for (const g of grouped) {
    const s = summarizeCluster(g);
    if (s) summaries.push(s);
  }
  return summaries;
}
