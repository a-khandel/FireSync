// FireSync mock data — ES module exports

export const FIRES = [
  {
    id: "park-fire", name: "Park Fire", jurisdiction: "Tehama Co, California", countryCode: "US",
    lat: 39.96, lng: -121.78, acres: 429600, containmentPct: 34, perimeterMi: 247,
    growth24hAcres: 12400, detectedAt: "2026-05-12T14:32:00-07:00", severity: 5,
    windMph: 22, windDirFrom: "SSW", windDirTo: "NNE", humidityPct: 18,
    evacOrderActive: true,
    zones: [
      { id: "1a", label: "Zone 1A", status: "ORDER", population: 4200 },
      { id: "1b", label: "Zone 1B", status: "ORDER", population: 1890 },
      { id: "2",  label: "Zone 2",  status: "WARNING", population: 12400 },
    ],
    roads: [
      { id: "ca-32", name: "CA-32", status: "CLOSED", from: "Cohasset", to: "Forest Ranch" },
      { id: "ca-99", name: "CA-99", status: "OPEN", from: null, to: null, note: "Evacuation corridor" },
      { id: "hwy-36", name: "Hwy 36", status: "DEGRADED", note: "Smoke, 25mph advisory" },
    ],
    shelters: [
      { id: "silver-dollar", name: "Silver Dollar Fairgrounds", city: "Chico", distanceMi: 14, capacity: 1000, occupancy: 640, status: "OPEN" },
      { id: "glenn-co", name: "Glenn County Fairgrounds", city: "Orland", distanceMi: 28, capacity: 800, occupancy: 120, status: "OPEN" },
    ],
    sources: ["FIRMS", "NWS", "OSM", "POP", "LOCAL"],
    lastUpdateAt: Date.now() - 74000,
  },
  { id: "creek-2", name: "Creek Complex", jurisdiction: "Fresno Co, CA", lat: 37.21, lng: -119.27, acres: 88400, containmentPct: 12, severity: 4, evacOrderActive: true, growth24hAcres: 4200, windMph: 14, humidityPct: 22, lastUpdateAt: Date.now() - 220000 },
  { id: "thomas-2", name: "Thomas Ridge", jurisdiction: "Ventura Co, CA", lat: 34.46, lng: -119.18, acres: 54200, containmentPct: 58, severity: 3, evacOrderActive: false, growth24hAcres: 600, windMph: 9, humidityPct: 31 },
  { id: "ojai-burn", name: "Ojai Burn", jurisdiction: "Ventura Co, CA", lat: 34.45, lng: -119.27, acres: 12400, containmentPct: 71, severity: 2, evacOrderActive: false, growth24hAcres: 110, windMph: 7, humidityPct: 28 },
  { id: "siskiyou", name: "Siskiyou", jurisdiction: "Siskiyou Co, CA", lat: 41.73, lng: -122.63, acres: 32200, containmentPct: 24, severity: 4, evacOrderActive: true, growth24hAcres: 2100, windMph: 17, humidityPct: 19 },
  { id: "klamath-n", name: "Klamath Spur", jurisdiction: "Klamath Co, OR", lat: 42.22, lng: -121.78, acres: 19800, containmentPct: 41, severity: 3, evacOrderActive: false, growth24hAcres: 800 },
  { id: "bend-co", name: "Cascade Lakes", jurisdiction: "Deschutes Co, OR", lat: 44.06, lng: -121.79, acres: 8200, containmentPct: 62, severity: 2, evacOrderActive: false, growth24hAcres: 240 },
  { id: "snake-river", name: "Snake River", jurisdiction: "Owyhee Co, ID", lat: 43.10, lng: -116.93, acres: 24400, containmentPct: 18, severity: 4, evacOrderActive: true, growth24hAcres: 1900 },
  { id: "bitterroot", name: "Bitterroot Ridge", jurisdiction: "Ravalli Co, MT", lat: 46.06, lng: -114.13, acres: 14600, containmentPct: 33, severity: 3 },
  { id: "yellowstone-e", name: "Yellowstone East", jurisdiction: "Park Co, WY", lat: 44.55, lng: -110.45, acres: 6900, containmentPct: 47, severity: 2 },
  { id: "wasatch", name: "Wasatch Front", jurisdiction: "Utah Co, UT", lat: 40.27, lng: -111.66, acres: 4400, containmentPct: 56, severity: 2 },
  { id: "mogollon", name: "Mogollon Rim", jurisdiction: "Coconino Co, AZ", lat: 34.43, lng: -111.31, acres: 12100, containmentPct: 22, severity: 3, evacOrderActive: true },
  { id: "rio-grande", name: "Rio Grande", jurisdiction: "Taos Co, NM", lat: 36.41, lng: -105.57, acres: 7200, containmentPct: 38, severity: 2 },
  { id: "front-range", name: "Front Range", jurisdiction: "Boulder Co, CO", lat: 40.04, lng: -105.34, acres: 18900, containmentPct: 19, severity: 4, evacOrderActive: true, growth24hAcres: 1100 },
  { id: "black-hills", name: "Black Hills", jurisdiction: "Pennington Co, SD", lat: 44.05, lng: -103.49, acres: 3300, containmentPct: 64, severity: 2 },
  { id: "okanogan", name: "Okanogan", jurisdiction: "Okanogan Co, WA", lat: 48.36, lng: -119.58, acres: 22100, containmentPct: 28, severity: 3, evacOrderActive: false },
  // International
  { id: "alberta-pk", name: "Peace River", jurisdiction: "Alberta, CA", lat: 56.23, lng: -117.30, acres: 41200, containmentPct: 11, severity: 4 },
  { id: "yukon-1", name: "Yukon Burn", jurisdiction: "Yukon, CA", lat: 62.71, lng: -135.05, acres: 18000, containmentPct: 7, severity: 3 },
  { id: "amazon-1", name: "Pará Sector", jurisdiction: "Pará, BR", lat: -4.21, lng: -54.93, acres: 22100, containmentPct: 8, severity: 4 },
  { id: "amazon-2", name: "Mato Grosso", jurisdiction: "Mato Grosso, BR", lat: -12.47, lng: -55.91, acres: 14400, containmentPct: 12, severity: 3 },
  { id: "patag-1", name: "Patagonia", jurisdiction: "Chubut, AR", lat: -42.78, lng: -71.32, acres: 6200, containmentPct: 31, severity: 2 },
  { id: "iberia-1", name: "Sierra de Gata", jurisdiction: "Cáceres, ES", lat: 40.20, lng: -6.71, acres: 8100, containmentPct: 22, severity: 3 },
  { id: "provence", name: "Provence", jurisdiction: "Var, FR", lat: 43.45, lng: 6.40, acres: 4400, containmentPct: 19, severity: 3 },
  { id: "calabria", name: "Aspromonte", jurisdiction: "Calabria, IT", lat: 38.20, lng: 15.91, acres: 3100, containmentPct: 27, severity: 2 },
  { id: "greece-1", name: "Evros", jurisdiction: "Thrace, GR", lat: 41.13, lng: 26.20, acres: 11200, containmentPct: 14, severity: 4, evacOrderActive: true },
  { id: "turkey-1", name: "Antalya", jurisdiction: "Antalya, TR", lat: 36.89, lng: 30.71, acres: 5400, containmentPct: 29, severity: 2 },
  { id: "morocco-1", name: "Rif Mountains", jurisdiction: "Chefchaouen, MA", lat: 35.17, lng: -5.27, acres: 2900, containmentPct: 33, severity: 2 },
  { id: "algeria-1", name: "Kabylie", jurisdiction: "Béjaïa, DZ", lat: 36.75, lng: 5.07, acres: 4100, containmentPct: 18, severity: 3 },
  { id: "sa-1", name: "Garden Route", jurisdiction: "Western Cape, ZA", lat: -33.97, lng: 22.46, acres: 7100, containmentPct: 21, severity: 3 },
  { id: "siberia-1", name: "Yakutia North", jurisdiction: "Sakha, RU", lat: 64.81, lng: 130.55, acres: 91200, containmentPct: 4, severity: 5 },
  { id: "siberia-2", name: "Krasnoyarsk", jurisdiction: "Krasnoyarsk, RU", lat: 60.46, lng: 95.31, acres: 38400, containmentPct: 9, severity: 4 },
  { id: "siberia-3", name: "Irkutsk", jurisdiction: "Irkutsk, RU", lat: 56.85, lng: 104.04, acres: 17200, containmentPct: 15, severity: 3 },
  { id: "mongolia-1", name: "Khentii", jurisdiction: "Khentii, MN", lat: 47.95, lng: 110.69, acres: 5400, containmentPct: 22, severity: 2 },
  { id: "australia-1", name: "Blue Mountains", jurisdiction: "NSW, AU", lat: -33.71, lng: 150.30, acres: 24200, containmentPct: 11, severity: 4, evacOrderActive: true },
  { id: "australia-2", name: "Gippsland", jurisdiction: "Victoria, AU", lat: -37.66, lng: 147.20, acres: 11200, containmentPct: 19, severity: 3 },
  { id: "australia-3", name: "Kimberley", jurisdiction: "WA, AU", lat: -17.96, lng: 122.24, acres: 16100, containmentPct: 8, severity: 3 },
  { id: "indonesia-1", name: "Kalimantan", jurisdiction: "Central Kalimantan, ID", lat: -2.21, lng: 113.92, acres: 14400, containmentPct: 6, severity: 4 },
  { id: "indonesia-2", name: "Sumatra", jurisdiction: "Riau, ID", lat: 0.91, lng: 101.51, acres: 7200, containmentPct: 12, severity: 3 },
  { id: "alaska-1", name: "Yukon Flats", jurisdiction: "Alaska, US", lat: 66.34, lng: -145.07, acres: 22400, containmentPct: 5, severity: 4 },
  { id: "alaska-2", name: "Kenai", jurisdiction: "Alaska, US", lat: 60.55, lng: -150.06, acres: 6100, containmentPct: 19, severity: 2 },
  { id: "quebec-1", name: "Côte-Nord", jurisdiction: "Québec, CA", lat: 50.21, lng: -67.34, acres: 41200, containmentPct: 7, severity: 4 },
  { id: "quebec-2", name: "Abitibi", jurisdiction: "Québec, CA", lat: 48.97, lng: -78.34, acres: 14400, containmentPct: 12, severity: 3 },
  { id: "ontario-1", name: "Thunder Bay", jurisdiction: "Ontario, CA", lat: 48.78, lng: -88.13, acres: 8100, containmentPct: 21, severity: 2 },
  { id: "bc-1", name: "Cariboo", jurisdiction: "BC, CA", lat: 52.95, lng: -122.49, acres: 19200, containmentPct: 14, severity: 3 },
  { id: "syria-1", name: "Latakia", jurisdiction: "Latakia, SY", lat: 35.51, lng: 36.07, acres: 3400, containmentPct: 18, severity: 2 },
  { id: "lebanon-1", name: "Mount Lebanon", jurisdiction: "Mount Lebanon, LB", lat: 33.86, lng: 35.65, acres: 1900, containmentPct: 27, severity: 2 },
  { id: "japan-1", name: "Hokkaido", jurisdiction: "Hokkaido, JP", lat: 43.49, lng: 142.92, acres: 2100, containmentPct: 33, severity: 2 },
  { id: "korea-1", name: "Gangwon", jurisdiction: "Gangwon, KR", lat: 37.81, lng: 128.36, acres: 1400, containmentPct: 47, severity: 2 },
  { id: "ne-india", name: "Uttarakhand", jurisdiction: "Uttarakhand, IN", lat: 30.07, lng: 79.01, acres: 4200, containmentPct: 19, severity: 3 },
  { id: "se-china", name: "Yunnan", jurisdiction: "Yunnan, CN", lat: 25.04, lng: 102.71, acres: 5100, containmentPct: 22, severity: 2 },
  { id: "philippines-1", name: "Luzon Hills", jurisdiction: "Cordillera, PH", lat: 17.41, lng: 121.05, acres: 1200, containmentPct: 41, severity: 2 },
  { id: "newzealand-1", name: "Canterbury", jurisdiction: "Canterbury, NZ", lat: -43.53, lng: 172.07, acres: 2800, containmentPct: 29, severity: 2 },
];

function makeHotspots(centerLat, centerLng, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random() * 0.16;
    const a = Math.random() * Math.PI * 2;
    out.push({
      lat: centerLat + Math.cos(a) * r,
      lng: centerLng + Math.sin(a) * r * 1.4,
      frp: 8 + Math.random() * 60,
      t: Date.now() - Math.floor(Math.random() * 60 * 60 * 1000),
    });
  }
  return out;
}
// pre-generate hotspots for park fire (used by command map)
FIRES[0].hotspots = makeHotspots(FIRES[0].lat, FIRES[0].lng, 60);

export const AGENT_LOG = [
  { t: "14:47:02", type: "DRAFT_EVAC_ORDER",     target: "Zone 1B added (1,890 ppl)",        conf: 0.84, severity: "critical" },
  { t: "14:46:58", type: "COMPUTE_ROUTE",        target: "Cohasset → Chico shelter",         conf: 0.91 },
  { t: "14:46:51", type: "ASSESS_ROAD_STATUS",   target: "CA-32 flagged CLOSED",             conf: 0.97, severity: "warning" },
  { t: "14:46:44", type: "INGEST",               target: "NOAA: wind shift detected",         conf: 0.99 },
  { t: "14:41:30", type: "CYCLE_START",          target: "#4,127" },
  { t: "14:41:12", type: "BRIEF_AGENCY",         target: "CalFire Butte Unit · 4 recipients", conf: 0.93 },
  { t: "14:40:58", type: "GENERATE_ALERT",       target: "WEA draft · Tehama Co · 18,490 ppl", conf: 0.88 },
  { t: "14:40:30", type: "FLAG_UNCERTAINTY",     target: "FIRMS pass gap > 50 min",           severity: "warning" },
  { t: "14:39:55", type: "COMPUTE_ROUTE",        target: "Cohasset → Glenn Co (secondary)",   conf: 0.79 },
  { t: "14:39:21", type: "INGEST",               target: "FIRMS: 4 new hotspots (Z1B+1.2mi)", conf: 0.99 },
  { t: "14:36:30", type: "CYCLE_START",          target: "#4,126" },
  { t: "14:35:11", type: "BRIEF_AGENCY",         target: "Red Cross NorCal · 2 recipients",   conf: 0.95 },
  { t: "14:34:22", type: "INGEST",               target: "OSM: CA-32 closure confirmed",      conf: 0.97 },
  { t: "14:33:40", type: "ASSESS_ROAD_STATUS",   target: "Hwy 36 downgraded DEGRADED",        conf: 0.86, severity: "warning" },
  { t: "14:31:30", type: "CYCLE_START",          target: "#4,125" },
  { t: "14:30:15", type: "INGEST",               target: "WorldPop: Zone 1B 1,890 residents", conf: 0.99 },
  { t: "14:29:42", type: "INGEST",               target: "NWS: gust forecast 34 mph by T+1h" },
];

export const REASONING = {
  decision: "DRAFT_EVAC_ORDER · Zone 1B · 1,890 people",
  issuedAt: "14:47:02",
  confidence: 0.84,
  inputs: [
    { src: "FIRMS", obs: "4 new hotspots within 1.2 mi of Zone 1B boundary" },
    { src: "NWS",   obs: "Wind 22 mph SSW→NNE, RH 18%, gusts to 34" },
    { src: "OSM",   obs: "CA-32 closure isolates Zone 1B from primary egress" },
    { src: "POP",   obs: "Zone 1B: 1,890 residents, 312 over 65, 47 no-vehicle" },
  ],
  reasoning:
    "Wind vector projects fire front to cross Zone 1B boundary within 90–120 minutes at current spread rate (1.4 mi/hr). CA-32 closure leaves only Garland Rd as egress; capacity estimated 600 vehicles/hr. Population requires ~3 hr evacuation window at full capacity. Wildfire arrival estimate (90 min) < evac time (180 min) → ORDER warranted.\n\n47 no-vehicle households flagged for transit dispatch. 312 elderly residents flagged for welfare check by CalFire liaison. Shelter routing computed to Silver Dollar Fairgrounds (14 mi, currently 64% capacity).",
  tradeoffs: [
    "WARNING vs ORDER: rejected. Margin between fire arrival and full evac time is negative under current wind.",
    "Glenn County shelter as primary: rejected. 14 mi farther, congestion risk on Hwy 99 northbound.",
  ],
  uncertaintyFlags: [
    "Wind forecast confidence drops after T+3h",
    "FIRMS satellite pass next at 15:42, gap of ~50 min",
  ],
};

export const BRIEF =
  "At 14:47 PDT, fire perimeter expanded northeast toward Cohasset township at 1.4 mi/hr under 22 mph SSW winds. Evacuation order issued for Zone 1B (1,890 residents). CA-32 closed at Cohasset Rd; CA-99 designated primary egress corridor. Three Type 1 engines repositioned from Forest Ranch. Silver Dollar Fairgrounds opened at 64% capacity; transit dispatch requested for 47 households without vehicles. Welfare checks initiated for 312 residents over 65. Next operational period begins 18:00 PDT.";

// ---- Helpers ----
export function severityColor(s) {
  return ["#FFD66B", "#FFA744", "#FF6F2C", "#FF3D14", "#C82400"][Math.max(0, Math.min(4, s - 1))];
}
export function fmtNum(n) {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

// ---- Fire-spread simulation ----
function dirToBearing(dir) {
  const map = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return map[dir] != null ? map[dir] : 0;
}

const _progressionCache = new WeakMap();

export function getProgression(fire) {
  if (_progressionCache.has(fire)) return _progressionCache.get(fire);
  const days = 7;
  const totalAcres = fire.acres || 5000;
  const curve = [0.001, 0.012, 0.06, 0.22, 0.5, 0.78, 1.0];
  const conts = [0, 0, 0, 0, 5, 18, fire.containmentPct || 30];
  const labels = [
    "Ignition",
    "Initial spread",
    "Rapid escalation",
    "Crown fire run",
    "Major expansion",
    "Wind shift",
    "Containment lines holding",
  ];
  const windBearing = dirToBearing(fire.windDirTo || fire.windDirFrom || "NE");
  const endDate = fire.lastUpdateAt || Date.now();
  const dayMs = 86_400_000;
  const frames = [];
  for (let i = 0; i < days; i++) {
    const acres = Math.round(totalAcres * curve[i]);
    const sqMi = acres / 640;
    const r = Math.sqrt(Math.max(0.0001, sqMi) / Math.PI);
    const aspect = 1.55;
    const semiMajor = r * aspect;
    const semiMinor = r / Math.sqrt(aspect);
    frames.push({
      day: i + 1,
      date: new Date(endDate - (days - 1 - i) * dayMs).toISOString(),
      acres,
      containmentPct: conts[i],
      radiusMi: r,
      semiMajorMi: semiMajor,
      semiMinorMi: semiMinor,
      bearingDeg: windBearing,
      label: labels[i],
    });
  }
  _progressionCache.set(fire, frames);
  return frames;
}

export function getBurnPolygon(fire, frame, points = 60) {
  const cosLat = Math.max(0.15, Math.cos((fire.lat * Math.PI) / 180));
  const bearingRad = (frame.bearingDeg * Math.PI) / 180;
  const a = frame.semiMajorMi, b = frame.semiMinorMi;
  const out = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const xL = a * Math.cos(t);
    const yL = b * Math.sin(t);
    const nMi = xL * Math.cos(bearingRad) - yL * Math.sin(bearingRad);
    const eMi = xL * Math.sin(bearingRad) + yL * Math.cos(bearingRad);
    const dLat = nMi / 69.0;
    const dLng = eMi / (69.0 * cosLat);
    out.push([fire.lng + dLng, fire.lat + dLat]);
  }
  return out;
}
