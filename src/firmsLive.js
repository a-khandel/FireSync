import Papa from "papaparse";
import { normalizeRow, parseAcqMs, runPipeline } from "./firmsClusterEngine.js";

/**
 * FIRMS CSV base URL — default aligns with FIRMS US/Canada portal (USFS gateway).
 *
 * Two parallel VIIRS pulls (NOAA-20 primary, NOAA-21 secondary), row merge with
 * spatial dedupe keeping the newest acquisition (`acq_date`/`acq_time`; NOAA-20 breaks ties).
 * Path shape:
 *   /usfs/api/area/csv/[MAP_KEY]/VIIRS_NOAA20_NRT|VIIRS_NOAA21_NRT/[AREA]/[DAY_RANGE]/[DATE?]
 *
 * Override base e.g. global gateway:
 *   VITE_FIRMS_AREA_CSV_BASE=https://firms.modaps.eosdis.nasa.gov/api/area/csv
 */
const FIRMS_CSV_BASE_DEFAULT = "https://firms.modaps.eosdis.nasa.gov/usfs/api/area/csv";
const PHOTON_REVERSE_BASE = "https://photon.komoot.io/reverse";
/** OSM: identify app — https://operations.osmfoundation.org/policies/nominatim/ */
const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const GEO_CONCURRENCY_PHOTON = 2;
const GEO_INTER_MS_PHOTON = 140;
/** Nominatim public API: aim for ≤1 req/s bulk use */
const GEO_INTER_MS_NOMINATIM = 1100;

/** Cached for the SPA session — probe Photon once before each geocode batch */
let reverseGeocodeProviderProbePromise = null;

const LOG_PREFIX = "[FireSync FIRMS]";

const FIRMS_VIIRS_PRIMARY = "VIIRS_NOAA20_NRT";
const FIRMS_VIIRS_SECONDARY = "VIIRS_NOAA21_NRT";

/**
 * Bounding box west,south,east,north: US (+AK/HI) + Canada. FIRMS also accepts literal `world`.
 * Use env: VITE_FIRMS_AREA=us-canada  (anything else defaults to FIRMS keyword `world`)
 */
const FIRMS_US_CANADA = {
  west: -170,
  south: 15,
  east: -50,
  north: 85,
};

/** Serialize FIRMS bbox exactly as required by the CSV endpoint */
export function formatFirmsAreaCoordinates(west, south, east, north) {
  return `${west},${south},${east},${north}`;
}

function resolveFirmsAreaMeta() {
  const raw = String(import.meta.env.VITE_FIRMS_AREA ?? "").trim().toLowerCase();

  const areaUsCanadaSegment = formatFirmsAreaCoordinates(
    FIRMS_US_CANADA.west,
    FIRMS_US_CANADA.south,
    FIRMS_US_CANADA.east,
    FIRMS_US_CANADA.north,
  );

  if (raw === "us-canada") {
    return {
      mode: "us-canada",
      description: `US/CAN bbox ${areaUsCanadaSegment} (west,south,east,north)`,
      areaPathSegment: areaUsCanadaSegment,
      west: FIRMS_US_CANADA.west,
      south: FIRMS_US_CANADA.south,
      east: FIRMS_US_CANADA.east,
      north: FIRMS_US_CANADA.north,
    };
  }

  const west = -180;
  const south = -90;
  const east = 180;
  const north = 90;
  return {
    mode: "world",
    description:
      raw === ""
        ? 'Default: FIRMS area keyword `world` (full -180 … 180, -90 … 90)'
        : 'FIRMS area keyword `world` (explicit or non-us-canada VITE_FIRMS_AREA)',
    areaPathSegment: "world",
    west,
    south,
    east,
    north,
  };
}

const FIRMS_AREA_META = resolveFirmsAreaMeta();

function resolveFirmsCsvBase() {
  const o = String(import.meta.env.VITE_FIRMS_AREA_CSV_BASE ?? "").trim();
  return o || FIRMS_CSV_BASE_DEFAULT;
}

/** NASA allows DAY_RANGE 1 … 5 at this endpoint */
function resolveFirmsDayRange() {
  const n = Number.parseInt(String(import.meta.env.VITE_FIRMS_DAY_RANGE ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 1;
}

/**
 * Append /YYYY-MM-DD for date-bounded pulls (common on USFS URL).
 * Omit with VITE_FIRMS_APPEND_DATE=false (NASA returns “most recent” without date segment).
 */
function resolveFirmsDateUrlSuffixUTC() {
  const omit = ["0", "false", "no", "off"].includes(
    String(import.meta.env.VITE_FIRMS_APPEND_DATE ?? "").trim().toLowerCase(),
  );
  if (omit) return "";
  const fixed = String(import.meta.env.VITE_FIRMS_DATE ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fixed)) return `/${fixed}`;
  const d = new Date();
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `/${y}-${mo}-${da}`;
}

function buildFirmsAreaCsvUrl(csvBase, mapKey, viirsSource, bbox, dayRange, dateSuffix) {
  return `${csvBase}/${encodeURIComponent(mapKey)}/${viirsSource}/${bbox}/${dayRange}${dateSuffix}`;
}

function spatialDedupeKey(norm) {
  const lat = parseFloat(norm.latitude);
  const lng = parseFloat(norm.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const rl = Math.round(lat * 10000) / 10000;
  const rn = Math.round(lng * 10000) / 10000;
  return `${rl},${rn}`;
}

function emptyPapaCsv() {
  return { data: [], meta: { fields: [] }, errors: [] };
}

/**
 * NOAA-20 = tier 0 (primary), NOAA-21 = tier 1. Same rounded lat/lng (4 decimals):
 * keep newest acquisition; on equal timestamp prefer NOAA-20.
 */
function mergeNoaaViirsDualParsed(parsedPrimary, parsedSecondary) {
  const fields = [
    ...new Set([...(parsedPrimary.meta.fields || []), ...(parsedSecondary.meta.fields || [])]),
  ];
  const rowsP = parsedPrimary.data || [];
  const rowsS = parsedSecondary.data || [];
  const totalIn = rowsP.length + rowsS.length;

  const items = [];
  for (const r of rowsP) items.push({ raw: r, tier: 0 });
  for (const r of rowsS) items.push({ raw: r, tier: 1 });

  for (const it of items) {
    const norm = normalizeRow(it.raw);
    const ms = parseAcqMs(norm.acq_date, norm.acq_time);
    it.ms = ms;
    it.key = spatialDedupeKey(norm);
  }

  items.sort((a, b) => {
    if (b.ms !== a.ms) return b.ms - a.ms;
    return a.tier - b.tier;
  });

  const out = [];
  const seen = new Set();
  let droppedDup = 0;
  let droppedNoKey = 0;
  for (const it of items) {
    if (!it.key) {
      droppedNoKey++;
      continue;
    }
    if (seen.has(it.key)) {
      droppedDup++;
      continue;
    }
    seen.add(it.key);
    out.push(it.raw);
  }

  const csvText = Papa.unparse(out, { columns: fields });
  return {
    csvText,
    stats: {
      totalIn,
      kept: out.length,
      droppedDuplicate: droppedDup,
      droppedNoCoordinates: droppedNoKey,
      fromPrimary: rowsP.length,
      fromSecondary: rowsS.length,
    },
  };
}

/** Lighter logs for the secondary satellite CSV (avoid duplicating raw 2.5k dumps). */
function logCsvPayloadCompact(csvText, res, mapKey, label) {
  const headersObj = {};
  res.headers.forEach((v, k) => {
    headersObj[k] = v;
  });
  console.log(`${LOG_PREFIX} ——— FETCH RESPONSE META (${label}) ———`, {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    url: redactKeyInUrl(res.url || "", mapKey),
    headers: headersObj,
  });
  const shape = inspectCsvText(csvText);
  console.log(`${LOG_PREFIX} ——— CSV STRUCTURE (${label}) ———`, shape);
  const sniff = Papa.parse(csvText, { header: true, preview: 8, skipEmptyLines: true });
  console.log(`${LOG_PREFIX} ——— PAPA PARSE SNIFF (${label}) ———`, {
    delimiter: sniff.meta?.delimiter,
    linebreak: sniff.meta?.linebreak,
    fields: sniff.meta?.fields,
    previewRowObjects: sniff.data,
    errors: sniff.errors,
  });
}

function maskMapKey(key) {
  const s = key != null ? String(key).trim() : "";
  if (!s) return "(empty — set VITE_FIRMS_MAP_KEY in .env)";
  if (s.length <= 6) return "(set)";
  return `${s.slice(0, 3)}…${s.slice(-3)}`;
}

/** Avoid leaking MAP_KEY into logs when logging Response.url */
function redactKeyInUrl(url, mapKey) {
  if (!url || !mapKey) return url || "";
  let out = url;
  const k = String(mapKey);
  const enc = encodeURIComponent(k);
  out = out.split(k).join("<MAP_KEY>");
  out = out.split(enc).join("<MAP_KEY>");
  return out;
}

function inspectCsvText(csvText) {
  const rawLines = csvText.split(/\r?\n/);
  const nonempty = rawLines.filter((l) => l.trim().length > 0);
  const headerLine = nonempty[0] ?? "";
  const headerCells = Papa.parse(headerLine, { delimiter: ",", header: false }).data[0];
  const headerColumns = Array.isArray(headerCells) ? headerCells.map((h) => String(h).trim()) : [];
  const dataRowCount = Math.max(0, nonempty.length - 1);
  return {
    rawByteLength: csvText.length,
    rawLineBreakStyle: csvText.includes("\r\n") ? "CRLF" : "LF",
    nonEmptyLines: nonempty.length,
    headerColumns,
    dataRowCount,
    firstDataLinesAsStrings: nonempty.slice(1, 6),
    lastDataLinesAsStrings: nonempty.length > 6 ? nonempty.slice(-3) : [],
  };
}

function logCsvPayload(csvText, res, mapKey) {
  const headersObj = {};
  res.headers.forEach((v, k) => {
    headersObj[k] = v;
  });

  console.log(`${LOG_PREFIX} ——— FETCH RESPONSE META ———`, {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    redirected: res.redirected,
    type: res.type,
    url: redactKeyInUrl(res.url || "", mapKey),
    headers: headersObj,
  });

  const shape = inspectCsvText(csvText);
  console.log(`${LOG_PREFIX} ——— CSV STRUCTURE ———`, shape);

  const sniff = Papa.parse(csvText, { header: true, preview: 8, skipEmptyLines: true });
  console.log(`${LOG_PREFIX} ——— PAPA PARSE SNIFF (first rows, typed fields) ———`, {
    delimiter: sniff.meta?.delimiter,
    linebreak: sniff.meta?.linebreak,
    aborted: sniff.meta?.aborted,
    truncated: sniff.meta?.truncated,
    fields: sniff.meta?.fields,
    previewRowObjects: sniff.data,
    errors: sniff.errors,
  });

  const PREVIEW_CHARS = 2500;
  console.log(`${LOG_PREFIX} ——— RAW CSV TEXT (first ${PREVIEW_CHARS} chars) ———\n`, csvText.slice(0, PREVIEW_CHARS));
  if (csvText.length > PREVIEW_CHARS) {
    console.log(`${LOG_PREFIX} … ${csvText.length - PREVIEW_CHARS} additional characters not printed`);
  }
}

function logClusterOutputs(clusters, pipelineMs, pipelineLabel) {
  console.log(`${LOG_PREFIX} ——— CLUSTER PIPELINE (${pipelineLabel}) ———`, {
    pipelineMs: Math.round(pipelineMs),
    incidentClusterCount: clusters.length,
  });

  let sumPts = 0;
  let maxFrp = -Infinity;
  let latestIso = "";
  const bands = { critical: 0, high: 0, moderate: 0 };
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  for (const c of clusters) {
    sumPts += c.point_count;
    maxFrp = Math.max(maxFrp, c.max_frp);
    if (c.updated_at && c.updated_at > latestIso) latestIso = c.updated_at;
    bands[classifySeverity(c.point_count, c.max_frp)]++;
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }

  console.log(`${LOG_PREFIX} ——— CLUSTER AGGREGATES ———`, {
    viirsDetectionsSummedAcrossClusters: sumPts,
    globalMaxFrpMw: Number.isFinite(maxFrp) ? maxFrp : null,
    newestAcquisitionISOAmongClusters: latestIso || null,
    centroidBoundingBoxDeg: clusters.length ? { minLat, maxLat, minLng, maxLng } : null,
    /** Table order is clustering order — not geography; use lng range + counts below. */
    clusterCountWestOf100WApprox: clusters.length
      ? clusters.filter((c) => c.lng < -100).length
      : 0,
    clusterCountLngMinus100ToMinus80Approx: clusters.length
      ? clusters.filter((c) => c.lng >= -100 && c.lng < -80).length
      : 0,
    clusterCountEastOf80WApprox: clusters.length ? clusters.filter((c) => c.lng >= -80).length : 0,
    severityBands: bands,
  });

  console.log(`${LOG_PREFIX} ——— FULL CLUSTER ARRAY (${clusters.length}) ——— expand in DevTools`, clusters);

  const TABLE_PREVIEW_MAX = 150;
  const shown = Math.min(TABLE_PREVIEW_MAX, clusters.length);
  if (clusters.length) {
    console.log(
      `${LOG_PREFIX} ——— CLUSTER TABLE (DevTools preview: first ${shown} of ${clusters.length} — all clusters are mapped on the globe) ———`,
    );
    console.table(clusters.slice(0, TABLE_PREVIEW_MAX));
    if (clusters.length > TABLE_PREVIEW_MAX) {
      console.log(
        `${LOG_PREFIX} … ${clusters.length - TABLE_PREVIEW_MAX} more rows omitted from preview only`,
      );
    }
  }
}

export function classifySeverity(pointCount, maxFrp) {
  if (pointCount > 50 || maxFrp > 500) return "critical";
  if (pointCount > 15 || maxFrp > 100) return "high";
  return "moderate";
}

/** Stable id from centroid rounded to 2 decimals */
export function stableFireId(lat, lng) {
  const rl = Math.round(lat * 100) / 100;
  const rg = Math.round(lng * 100) / 100;
  return `${rl}_${rg}`.replace(/-/g, "m");
}

export function clusterSummariesToDraftIncidents(clusters) {
  return clusters.map((c) => {
    const band = classifySeverity(c.point_count, c.max_frp);
    const id = stableFireId(c.lat, c.lng);
    const updatedMs = Date.parse(c.updated_at);
    return {
      id,
      name: "Active Fire",
      jurisdiction: "Satellite hotspot · locating…",
      region: "",
      lat: c.lat,
      lng: c.lng,
      lon: c.lng,
      severity: band,
      point_count: c.point_count,
      max_frp: c.max_frp,
      acres: null,
      containmentPct: null,
      contained: null,
      wind_mph: null,
      humidity_pct: null,
      windMph: null,
      humidityPct: null,
      detectedAt: c.updated_at,
      updated_at: c.updated_at,
      lastUpdateAt: Number.isFinite(updatedMs) ? updatedMs : Date.now(),
      source:
        FIRMS_AREA_META.mode === "world"
          ? "NASA FIRMS VIIRS NOAA-20+21 merged (world · FIRMS/USFS CSV)"
          : "NASA FIRMS VIIRS NOAA-20+21 merged (US/CAN bbox · FIRMS CSV)",
      sources: ["NASA FIRMS VIIRS NOAA-20+NRT", "NASA FIRMS VIIRS NOAA-21+NRT"],
      evacOrderActive: band === "critical",
      geocodeDone: false,
      windFetched: false,
      _demoMock: false,
    };
  });
}

function workerCluster(csvText) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./workers/firmsCluster.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      worker.terminate();
      const { ok, clusters, error } = e.data || {};
      if (ok) resolve({ clusters, ms: e.data.ms ?? 0 });
      else reject(new Error(error || "worker parse failed"));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || "worker error"));
    };
    worker.postMessage({ csvText });
  });
}

/** Merge refreshed FIRMS drafts with prior rows — preserves geocode + wind when IDs match */
export function mergeIncidentSnapshots(prev, drafts) {
  const pmap = new Map(prev.map((x) => [x.id, x]));
  return drafts.map((d) => {
    const old = pmap.get(d.id);
    if (!old) return { ...d };
    return {
      ...d,
      name: old.geocodeDone ? old.name : d.name,
      jurisdiction: old.geocodeDone ? old.jurisdiction : d.jurisdiction,
      region: old.geocodeDone ? old.region : d.region,
      geocodeDone: old.geocodeDone || false,
      windMph: old.windFetched ? old.windMph : d.windMph,
      humidityPct: old.windFetched ? old.humidityPct : d.humidityPct,
      wind_mph: old.windFetched ? old.wind_mph : d.wind_mph,
      humidity_pct: old.windFetched ? old.humidity_pct : d.humidity_pct,
      windFetched: old.windFetched || false,
    };
  });
}

export function enrichDemoMocks(list) {
  return list.map((f) => ({
    ...f,
    geocodeDone: true,
    windFetched: !!f.windMph || !!f.humidityPct,
    _demoMock: true,
  }));
}

export function formatIncidentName(geo) {
  const locality = geo.locality || geo.city || geo.localityInfo?.administrative?.[0]?.name || "";
  const sub = geo.principalSubdivision || "";
  const country = geo.countryName || "";
  if (locality && String(locality).length > 1) return `Fire near ${locality}`;
  if (sub) return `${sub} Fire`;
  if (country) return `${country} Fire`;
  return "Active Fire";
}

export function formatIncidentRegion(geo) {
  const sub = geo.principalSubdivision || "";
  const country = geo.countryName || "";
  const loc = geo.locality || "";
  if (sub && country) return `${sub}, ${country}`;
  if (country) return country;
  if (sub) return sub;
  if (loc) return loc;
  return "Unknown region";
}

/** Fetch FIRMS CSV → cluster summaries (worker first; sync fallback). */
export async function fetchFirmsClusterSummaries(signal) {
  const key = import.meta.env.VITE_FIRMS_MAP_KEY;
  if (!key || String(key).trim() === "") {
    console.warn(`${LOG_PREFIX} Not calling NASA API — map key missing.`, {
      mapKey: maskMapKey(key),
      hint: "Add VITE_FIRMS_MAP_KEY to .env and restart vite.",
    });
    throw new Error("missing FIRMS map key");
  }

  const bbox = FIRMS_AREA_META.areaPathSegment;
  const csvBase = resolveFirmsCsvBase();
  const dayRange = resolveFirmsDayRange();
  const dateSuffix = resolveFirmsDateUrlSuffixUTC();
  const urlPrimary = buildFirmsAreaCsvUrl(csvBase, key, FIRMS_VIIRS_PRIMARY, bbox, dayRange, dateSuffix);
  const urlSecondary = buildFirmsAreaCsvUrl(
    csvBase,
    key,
    FIRMS_VIIRS_SECONDARY,
    bbox,
    dayRange,
    dateSuffix,
  );

  const fetchOpts = signal ? { signal } : undefined;
  console.log(`${LOG_PREFIX} Fetching VIIRS NOAA-20+NRT + NOAA-21+NRT (${FIRMS_AREA_META.mode}; dayRange ${dayRange})…`, {
    mapKey: maskMapKey(key),
    csvBase,
    gateway:
      csvBase.includes("/usfs/")
        ? "USFS FIRMS (/usfs/api/area/csv)"
        : "Global FIRMS (/api/area/csv)",
    areaMode: FIRMS_AREA_META.mode,
    firmsAreaExplanation: FIRMS_AREA_META.description,
    firmsAreaCoordinatesOrder: FIRMS_AREA_META.mode === "world" ? "keyword world or bbox literal" : "west,south,east,north",
    west: FIRMS_AREA_META.west,
    south: FIRMS_AREA_META.south,
    east: FIRMS_AREA_META.east,
    north: FIRMS_AREA_META.north,
    areaPathSegment: bbox,
    dayRange,
    datePathSegmentUTC: dateSuffix ? dateSuffix.slice(1) : "(omitted — most recent window)",
    mergeRule: "4-decimal rounded lat/lng: keep newer acq_date/acq_time; equal time → NOAA-20",
    urls: [redactKeyInUrl(urlPrimary, key), redactKeyInUrl(urlSecondary, key)],
    endpointExamples: [
      `${csvBase}/<key>/${FIRMS_VIIRS_PRIMARY}/${bbox}/${dayRange}${dateSuffix || ""}`,
      `${csvBase}/<key>/${FIRMS_VIIRS_SECONDARY}/${bbox}/${dayRange}${dateSuffix || ""}`,
    ],
  });

  const tFetch0 = performance.now();
  const settled = await Promise.allSettled([
    fetch(urlPrimary, fetchOpts).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return { label: FIRMS_VIIRS_PRIMARY, text, res };
    }),
    fetch(urlSecondary, fetchOpts).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return { label: FIRMS_VIIRS_SECONDARY, text, res };
    }),
  ]);
  const fetchMs = Math.round(performance.now() - tFetch0);

  let pkg20 = null;
  let pkg21 = null;
  const fetchErrors = [];
  if (settled[0].status === "fulfilled") pkg20 = settled[0].value;
  else
    fetchErrors.push(
      `${FIRMS_VIIRS_PRIMARY}: ${settled[0].reason?.message ?? String(settled[0].reason)}`,
    );
  if (settled[1].status === "fulfilled") pkg21 = settled[1].value;
  else
    fetchErrors.push(
      `${FIRMS_VIIRS_SECONDARY}: ${settled[1].reason?.message ?? String(settled[1].reason)}`,
    );

  if (!pkg20 && !pkg21) {
    console.warn(`${LOG_PREFIX} Both satellite CSV fetches failed (${fetchMs}ms)`, fetchErrors);
    throw new Error(`FIRMS dual fetch failed: ${fetchErrors.join("; ")}`);
  }
  if (fetchErrors.length) {
    console.warn(`${LOG_PREFIX} Partial satellite fetch — proceeding with remaining CSV (${fetchMs}ms)`, {
      failures: fetchErrors,
    });
  }

  console.log(`${LOG_PREFIX} ——— NETWORK TIMING ———`, {
    fetchMs,
    ...(pkg20 && {
      csvKB_primary: (pkg20.text.length / 1024).toFixed(1),
      linesApprox_primary: pkg20.text.split("\n").length,
    }),
    ...(pkg21 && {
      csvKB_secondary: (pkg21.text.length / 1024).toFixed(1),
      linesApprox_secondary: pkg21.text.split("\n").length,
    }),
  });

  if (pkg20) logCsvPayload(pkg20.text, pkg20.res, key);
  if (pkg21) logCsvPayloadCompact(pkg21.text, pkg21.res, key, FIRMS_VIIRS_SECONDARY);

  const parseOpts = { header: true, skipEmptyLines: true };
  const parsed20 = pkg20 ? Papa.parse(pkg20.text, parseOpts) : emptyPapaCsv();
  const parsed21 = pkg21 ? Papa.parse(pkg21.text, parseOpts) : emptyPapaCsv();

  const { csvText: mergedCsvText, stats } = mergeNoaaViirsDualParsed(parsed20, parsed21);
  console.log(`${LOG_PREFIX} Merged + deduped dual VIIRS`, stats);

  try {
    const { clusters, ms } = await workerCluster(mergedCsvText);
    logClusterOutputs(clusters, ms, "worker");
    return clusters;
  } catch (workerErr) {
    console.warn(`${LOG_PREFIX} Worker parse/cluster failed; using main thread.`, workerErr?.message || workerErr);
    const parsed = Papa.parse(mergedCsvText, { header: true, skipEmptyLines: true });
    console.log(`${LOG_PREFIX} ——— PAPA FULL PARSE (main-thread path) ———`, {
      rowCount: parsed.data?.length ?? 0,
      meta: parsed.meta,
      errors: parsed.errors,
    });
    const t0 = performance.now();
    const clusters = runPipeline(parsed.data || []);
    const ms = performance.now() - t0;
    logClusterOutputs(clusters, ms, "main-thread");
    return clusters;
  }
}

async function reverseGeocodePhoton(lat, lng) {
  const u =
    `${PHOTON_REVERSE_BASE}?lon=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const j = await res.json();
  const p = j.features?.[0]?.properties;
  if (!p) throw new Error("photon empty");

  const locality =
    p.name ||
    p.locality ||
    p.district ||
    p.city ||
    p.village ||
    p.hamlet ||
    "";
  const city = p.city || p.town || "";
  const principalSubdivision = p.state || p.county || "";
  let countryName = typeof p.country === "string" ? p.country : "";
  if (!countryName && p.countrycode) countryName = String(p.countrycode).toUpperCase();

  return {
    locality,
    city,
    principalSubdivision,
    countryName,
    localityInfo: null,
  };
}

async function reverseGeocodeNominatim(lat, lng) {
  const u =
    `${NOMINATIM_REVERSE}?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
  const res = await fetch(u, {
    mode: "cors",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
    },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const j = await res.json();
  if (!j || j.error) throw new Error("nominatim empty");
  const a = j.address || {};
  const locality =
    a.city ||
    a.town ||
    a.village ||
    a.hamlet ||
    a.suburb ||
    a.neighbourhood ||
    a.municipality ||
    a.county ||
    "";
  const city = a.city || a.town || "";
  const principalSubdivision =
    a.state || a.region || (typeof a.state_code === "string" ? a.state_code : "") || "";
  const countryName = typeof a.country === "string" ? a.country : "";
  return {
    locality,
    city,
    principalSubdivision,
    countryName,
    localityInfo: null,
  };
}

function geoFallbackFromCoordinates(lat, lng) {
  const latH = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lonH = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
  return {
    locality: `${latH} · ${lonH}`,
    city: "",
    principalSubdivision: "",
    countryName: "",
    localityInfo: null,
  };
}

async function probeReverseGeocodeProvider() {
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 4500);
  try {
    const r = await fetch(`${PHOTON_REVERSE_BASE}?lon=-97&lat=37`, {
      signal: ac.signal,
      mode: "cors",
      cache: "no-store",
    });
    if (!r.ok) return "nominatim";
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j?.features) || j.features.length === 0) return "nominatim";
    return "photon";
  } catch {
    return "nominatim";
  } finally {
    clearTimeout(tid);
  }
}

function reverseGeocodeForProvider(lat, lng, provider) {
  return provider === "photon"
    ? reverseGeocodePhoton(lat, lng)
    : reverseGeocodeNominatim(lat, lng);
}

/** One reverse lookup (exported for reuse). Photon first if healthy; otherwise Nominatim. */
export async function reverseGeocode(lat, lng) {
  if (!reverseGeocodeProviderProbePromise) {
    reverseGeocodeProviderProbePromise = probeReverseGeocodeProvider();
  }
  const provider = await reverseGeocodeProviderProbePromise;
  try {
    return await reverseGeocodeForProvider(lat, lng, provider);
  } catch {
    return geoFallbackFromCoordinates(lat, lng);
  }
}

export function queueReverseGeocodes(incidents, onPatch) {
  const pending = incidents.filter((i) => !i.geocodeDone && !i._demoMock);
  if (!pending.length) return;

  void (async () => {
    if (!reverseGeocodeProviderProbePromise) {
      reverseGeocodeProviderProbePromise = probeReverseGeocodeProvider();
    }
    const provider = await reverseGeocodeProviderProbePromise;
    if (provider === "photon") {
      console.log(`${LOG_PREFIX} Reverse geocode: Photon (Komoot)`);
    } else {
      console.warn(
        `${LOG_PREFIX} Photon reverse unreachable — using OSM Nominatim (~1 req/s; ~${pending.length}s for ${pending.length} pins). Coordinate labels if Nominatim blocks.`,
      );
    }

    const concurrency =
      provider === "photon" ? Math.min(GEO_CONCURRENCY_PHOTON, pending.length) : 1;
    const interMs = provider === "photon" ? GEO_INTER_MS_PHOTON : GEO_INTER_MS_NOMINATIM;

    console.log(`${LOG_PREFIX} Queueing reverse geocode`, {
      locations: pending.length,
      provider: provider === "photon" ? "Photon (Komoot)" : "OSM Nominatim (+ coord fallback)",
      concurrency,
      interRequestMs: interMs,
    });

    let idx = 0;
    async function worker() {
      while (idx < pending.length) {
        const cur = pending[idx++];
        await new Promise((r) => setTimeout(r, interMs));
        let geo = null;
        try {
          geo = await reverseGeocodeForProvider(cur.lat, cur.lng, provider);
        } catch {
          geo = geoFallbackFromCoordinates(cur.lat, cur.lng);
        }
        const name = formatIncidentName(geo);
        const region = formatIncidentRegion(geo);
        onPatch(cur.id, {
          name,
          jurisdiction: region,
          region,
          geocodeDone: true,
        });
      }
    }

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    Promise.all(workers).catch(() => {});
  })();
}

/** Open-Meteo current conditions — mph + RH */
export async function fetchWeatherSnapshot(lat, lng) {
  const u =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    "&current=wind_speed_10m,relative_humidity_2m&wind_speed_unit=mph";
  const res = await fetch(u);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const j = await res.json();
  const w = j.current?.wind_speed_10m;
  const h = j.current?.relative_humidity_2m;
  return {
    windMph: typeof w === "number" ? Math.round(w) : null,
    humidityPct: typeof h === "number" ? Math.round(h) : null,
  };
}
