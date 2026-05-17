// FireSync — Supabase scan_logs API (native fetch, no extra dependency)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lcprtzjbajfomoohknjx.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export async function fetchIncidentReports(limit = 30) {
  if (!SUPABASE_KEY || SUPABASE_KEY === "your-anon-key-here") {
    console.warn("[scanApi] VITE_SUPABASE_ANON_KEY not set; skipping incident_reports fetch.");
    return [];
  }
  const url = `${SUPABASE_URL}/rest/v1/incident_reports?select=*&order=created_at.desc&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`incident_reports fetch failed: ${res.status}`);
  return await res.json();
}

export function compileScanLogs(scans) {
  if (!scans || scans.length === 0) return null;
  const sorted = [...scans].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const latest = sorted[sorted.length - 1];
  const base = transformScanToFire(latest);

  base.timeline = sorted.map((scan, idx) => {
    const hotspots = safeJsonParse(scan.hotspots, []);
    return {
      entryNum: idx + 1,
      scanId: scan.id,
      createdAt: scan.created_at,
      scanTimestamp: scan.scan_timestamp,
      brief: scan.nemoclaw_brief || "",
      hotspotCount: scan.hotspot_count,
      maxFrp: scan.max_frp_mw,
      frpTrend: scan.frp_trend,
      frpDelta: scan.frp_delta_mw,
      totalAreaKm2: scan.total_area_km2,
      temperature: scan.temperature_f,
      weatherSummary: scan.short_forecast || "",
      windSpeed: scan.wind_speed || "",
      windDirection: scan.wind_direction || "",
      model: scan.nemoclaw_model || "",
      hotspots,
    };
  });

  base.draftComms = safeJsonParse(latest.draft_comms, []);

  return base;
}

export async function fetchScanLogs(limit = 20) {
  if (!SUPABASE_KEY || SUPABASE_KEY === "your-anon-key-here") {
    console.warn("[scanApi] VITE_SUPABASE_ANON_KEY not set; skipping live fetch.");
    return [];
  }
  const url = `${SUPABASE_URL}/rest/v1/scan_logs?select=*&order=created_at.desc&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Scan logs fetch failed: ${res.status}`);
  return await res.json();
}

export function transformScanToFire(scan) {
  const hotspots = safeJsonParse(scan.hotspots, []);
  const evacZones = safeJsonParse(scan.evacuation_zones, null);
  const draftComms = safeJsonParse(scan.draft_comms, []);

  const frp = scan.max_frp_mw || 0;
  let severity = 1;
  if (frp > 500) severity = 5;
  else if (frp > 200) severity = 4;
  else if (frp > 100) severity = 3;
  else if (frp > 50) severity = 2;

  const windMatch = String(scan.wind_speed || "").match(/(\d+)/);
  const windMph = windMatch ? parseInt(windMatch[1]) : 0;

  return {
    id: String(scan.id),
    name: inferFireName(scan),
    jurisdiction: inferJurisdiction(scan),
    lat: scan.centroid_lat,
    lng: scan.centroid_lon,
    acres: Math.round((scan.total_area_km2 || 0) * 247.105),
    containmentPct: 0,
    perimeterMi: 0,
    growth24hAcres: 0,
    severity,
    evacOrderActive: (scan.hotspot_count || 0) > 0 && frp > 50,
    windMph,
    windDirFrom: scan.wind_direction || "",
    windDirTo: "",
    humidityPct: 0,
    temperature: scan.temperature_f,
    weatherSummary: scan.short_forecast || "",
    zones: evacZones ? geoJsonToZones(evacZones) : [],
    shelters: [],
    roads: [],
    sources: ["FIRMS", "GOES-18"],
    lastUpdateAt: new Date(scan.created_at).getTime(),
    hotspots: hotspots.map((h) => ({
      lat: h.lat,
      lng: h.lon,
      frp: h.frp_mw,
      t: Date.now(),
    })),
    brief: scan.nemoclaw_brief || "",
    draftComms,
    frpTrend: scan.frp_trend,
    frpDelta: scan.frp_delta_mw,
    hotspotCount: scan.hotspot_count,
    maxFrp: scan.max_frp_mw,
    scanTimestamp: scan.scan_timestamp,
    model: scan.nemoclaw_model,
  };
}

function inferFireName(scan) {
  if (scan.nemoclaw_brief) {
    const m = scan.nemoclaw_brief.match(/([A-Z][a-zA-Z\s]+(?:Island|Fire|Ridge|Mountain|Creek|Valley|Canyon|Park|Forest|Hill|Bay|Lake|River|Plateau|Range|Coast|Peninsula|Cape|Head|Pass|Summit|Peak))\b/);
    if (m) return m[1].trim();
  }
  return "Active Fire";
}

function inferJurisdiction(scan) {
  const lat = scan.centroid_lat;
  const lng = scan.centroid_lon;
  if (lat == null || lng == null) return "Unknown";
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
}

function geoJsonToZones(geoJson) {
  if (!geoJson || !geoJson.features) return [];
  return geoJson.features.map((f, i) => ({
    id: `zone-${i}`,
    label: f.properties?.label || f.properties?.zone || `Zone ${i + 1}`,
    status:
      f.properties?.zone === "RED"
        ? "ORDER"
        : f.properties?.zone === "ORANGE"
        ? "WARNING"
        : "SAFE",
    population: 0,
  }));
}
