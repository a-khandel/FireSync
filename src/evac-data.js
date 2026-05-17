// Evacuation plan geography. Hand-authored for the canonical Park Fire
// scenario (real coordinates around Cohasset / Paradise / Chico), and
// procedurally synthesized for any other fire flagged evacOrderActive.

import { getProgression } from "./data.js";

// ----- helpers ---------------------------------------------------------

function polygonCentroid(coords) {
  let cx = 0, cy = 0;
  for (const [lng, lat] of coords) { cx += lng; cy += lat; }
  return [cx / coords.length, cy / coords.length];
}

function distMi([lng1, lat1], [lng2, lat2]) {
  const cosLat = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const dN = (lat2 - lat1) * 69;
  const dE = (lng2 - lng1) * 69 * cosLat;
  return Math.sqrt(dN * dN + dE * dE);
}

function offsetMi(lng, lat, mi, bearingDeg) {
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const br = (bearingDeg * Math.PI) / 180;
  const dLat = (mi * Math.cos(br)) / 69.0;
  const dLng = (mi * Math.sin(br)) / (69.0 * cosLat);
  return [lng + dLng, lat + dLat];
}

function dirToBearing(dir) {
  const m = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return m[dir] != null ? m[dir] : 0;
}

// Simple convex-ish hex polygon around a center point at the given radius.
function hexAround(center, radiusMi, rot = 0) {
  const out = [];
  for (let i = 0; i <= 6; i++) {
    const ang = rot + (i / 6) * Math.PI * 2;
    out.push(offsetMi(center[0], center[1], radiusMi, (ang * 180) / Math.PI));
  }
  return out;
}

// ----- curated Park Fire scenario --------------------------------------

const PARK_FIRE = {
  zones: [
    {
      id: "1a",
      label: "Zone 1A",
      status: "ORDER",
      population: 4200,
      vulnerable: { noVehicle: 28, elderly: 145 },
      polygon: [
        [-121.83, 39.99], [-121.76, 40.00], [-121.74, 39.96],
        [-121.79, 39.93], [-121.84, 39.95], [-121.83, 39.99],
      ],
      shelterId: "silver-dollar",
      egressRoadId: "ca-99",
      fireArrivalMin: 90,
      evacTimeMin: 165,
    },
    {
      id: "1b",
      label: "Zone 1B",
      status: "ORDER",
      population: 1890,
      vulnerable: { noVehicle: 19, elderly: 112 },
      polygon: [
        [-121.74, 39.96], [-121.68, 39.97], [-121.65, 39.92],
        [-121.71, 39.89], [-121.74, 39.93], [-121.74, 39.96],
      ],
      shelterId: "silver-dollar",
      egressRoadId: "ca-99",
      fireArrivalMin: 105,
      evacTimeMin: 180,
    },
    {
      id: "2",
      label: "Zone 2",
      status: "WARNING",
      population: 12400,
      vulnerable: { noVehicle: 0, elderly: 480 },
      polygon: [
        [-121.85, 39.93], [-121.65, 39.93], [-121.55, 39.85],
        [-121.65, 39.78], [-121.85, 39.78], [-121.90, 39.85],
        [-121.85, 39.93],
      ],
      shelterId: "glenn-co",
      egressRoadId: "hwy-36",
      fireArrivalMin: 240,
      evacTimeMin: 260,
    },
  ],
  shelters: [
    {
      id: "silver-dollar",
      name: "Silver Dollar Fairgrounds",
      city: "Chico",
      lng: -121.838, lat: 39.733,
      capacity: 1000, occupancy: 640, status: "OPEN",
    },
    {
      id: "glenn-co",
      name: "Glenn County Fairgrounds",
      city: "Orland",
      lng: -122.197, lat: 39.747,
      capacity: 800, occupancy: 120, status: "OPEN",
    },
  ],
  roads: [
    {
      id: "ca-32", name: "CA-32", status: "CLOSED",
      note: "Cohasset Rd → Forest Ranch",
      path: [
        [-121.838, 39.728], [-121.79, 39.79], [-121.74, 39.86],
        [-121.74, 39.93], [-121.78, 39.98],
      ],
    },
    {
      id: "ca-99", name: "CA-99", status: "OPEN",
      note: "Primary evacuation corridor",
      path: [
        [-121.838, 39.733], [-121.85, 39.79], [-121.86, 39.86],
        [-121.86, 39.93], [-121.86, 39.99],
      ],
    },
    {
      id: "hwy-36", name: "Hwy 36", status: "DEGRADED",
      note: "Smoke advisory · 25 mph",
      path: [
        [-122.20, 39.86], [-121.95, 39.87], [-121.65, 39.87],
        [-121.50, 39.85],
      ],
    },
  ],
};

// ----- synthesizer for non-curated fires --------------------------------

// For fires without curated geometry, we drop two evac zones into the
// downwind cone and a shelter ~18mi upwind (away from the fire). The
// shelter coordinate is plausibly placed even if it doesn't correspond
// to a named real-world facility.
function synthesize(fire) {
  const wind = fire.windDirTo || fire.windDirFrom || "NE";
  const bearingTo = dirToBearing(wind);
  const upwindBearing = (bearingTo + 180) % 360;
  const frames = getProgression(fire);
  // Size zones off the projected final extent so they're visible regardless
  // of how big the fire is.
  const rEnd = Math.max(1.5, frames[frames.length - 1].semiMajorMi);

  const zone1Off = Math.max(1.2, rEnd * 1.05);
  const zone2Off = Math.max(2.6, rEnd * 1.9);
  const zone1Radius = Math.max(1.4, rEnd * 0.55);
  const zone2Radius = Math.max(2.4, rEnd * 0.9);
  const shelterDist = Math.max(14, rEnd * 1.6);

  const zone1Center = offsetMi(fire.lng, fire.lat, zone1Off, bearingTo);
  const zone2Center = offsetMi(fire.lng, fire.lat, zone2Off, bearingTo);
  const shelterPt = offsetMi(fire.lng, fire.lat, shelterDist, upwindBearing);

  // Deterministic populations driven by acreage so the synthesis is stable
  // across renders (and matches "feels right" for the fire's scale).
  const baseAcres = Math.max(1000, fire.acres || 5000);
  const pop1 = Math.round(800 + Math.min(4500, baseAcres * 0.012));
  const pop2 = Math.round(2400 + Math.min(11000, baseAcres * 0.028));

  const evac1 = Math.round((pop1 / 600) * 60 * 0.7) + 30;
  const evac2 = Math.round((pop2 / 1200) * 60 * 0.7) + 45;

  return {
    zones: [
      {
        id: "z1",
        label: "Zone A",
        status: "ORDER",
        population: pop1,
        vulnerable: { noVehicle: Math.round(pop1 * 0.012), elderly: Math.round(pop1 * 0.07) },
        polygon: hexAround(zone1Center, zone1Radius),
        shelterId: "syn-shelter-1",
        egressRoadId: null,
        fireArrivalMin: 75,
        evacTimeMin: evac1,
      },
      {
        id: "z2",
        label: "Zone B",
        status: "WARNING",
        population: pop2,
        vulnerable: { noVehicle: 0, elderly: Math.round(pop2 * 0.06) },
        polygon: hexAround(zone2Center, zone2Radius),
        shelterId: "syn-shelter-1",
        egressRoadId: null,
        fireArrivalMin: 195,
        evacTimeMin: evac2,
      },
    ],
    shelters: [
      {
        id: "syn-shelter-1",
        name: "Regional Evac Shelter",
        city: fire.jurisdiction?.split(",")[0]?.trim() || "Nearest town",
        lng: shelterPt[0], lat: shelterPt[1],
        capacity: 1200, occupancy: Math.round(baseAcres * 0.012) % 600, status: "OPEN",
      },
    ],
    roads: [],
  };
}

// ----- public API ------------------------------------------------------

const CURATED = {
  "park-fire": PARK_FIRE,
};

export function getEvacPlan(fire) {
  if (!fire) return null;
  const base = CURATED[fire.id] || synthesize(fire);
  // Enrich zones with centroid + shelter ref for downstream consumers.
  const shelterById = Object.fromEntries(base.shelters.map((s) => [s.id, s]));
  const zones = base.zones.map((z) => ({
    ...z,
    centroid: polygonCentroid(z.polygon),
    shelter: shelterById[z.shelterId] || null,
  }));
  return { ...base, zones };
}

// Bounding box that contains the fire, all zones, and all shelters.
export function evacBounds(fire, plan) {
  let west = fire.lng, east = fire.lng, south = fire.lat, north = fire.lat;
  const grow = (lng, lat) => {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  };
  for (const z of plan.zones) for (const [lng, lat] of z.polygon) grow(lng, lat);
  for (const s of plan.shelters) grow(s.lng, s.lat);
  return [[west, south], [east, north]];
}

export function zoneToShelterMiles(zone) {
  if (!zone.shelter) return null;
  return distMi(zone.centroid, [zone.shelter.lng, zone.shelter.lat]);
}