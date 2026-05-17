// Full-bleed OpenStreetMap view rendered with MapLibre GL JS. When a fire
// is selected the camera flies in and tilts to reveal 3D building
// extrusions sourced from OSM (via OpenFreeMap vector tiles), the
// burn-area polygon is drawn on top, and — for fires with an active evac
// order — evacuation zones, road statuses, shelters and animated driving
// routes from each zone to its assigned shelter are layered on as well.

import { useEffect, useRef } from "react";
import { loadMapLibre } from "./maplibre-loader.js";
import { getBurnPolygon, getProgression } from "./data.js";
import { evacBounds, getEvacPlan } from "./evac-data.js";
import { fetchRoutesForPlan } from "./evac-routing.js";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Camera choreography for fires WITHOUT an active evac plan — flies into
// a close 3D view to show building extrusions.
const ENTRY = { zoom: 13, pitch: 0, bearing: 0 };
const TARGET_LOCAL = { zoom: 15.6, pitch: 58, bearing: 22 };
const FIRST_FLY_DURATION = 2400; // ms
const NEXT_FLY_DURATION = 1800;

const RING_COLORS = ["#FFD66B", "#FFA744", "#FF6F2C", "#FF3D14", "#C82400"];

const ZONE_COLOR = { ORDER: "#FF3D14", WARNING: "#FFA744" };
const ROAD_COLOR = { OPEN: "#5EEAD4", DEGRADED: "#FFA744", CLOSED: "#FF3D14" };

function polygonFeature(coords, props = {}) {
  return {
    type: "Feature",
    properties: props,
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

function lineFeature(coords, props = {}) {
  return {
    type: "Feature",
    properties: props,
    geometry: { type: "LineString", coordinates: coords },
  };
}

export default function FireLocationMap({ fire, simulation, visible }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const shelterMarkersRef = useRef([]);
  const initialFireIdRef = useRef(null);
  const styleReadyRef = useRef(false);
  const pendingFlyRef = useRef(null);
  const dashAnimRef = useRef(0);

  // ---- map init / fire change --------------------------------------
  useEffect(() => {
    if (!fire) return;
    let cancelled = false;
    const plan = getEvacPlan(fire);

    loadMapLibre().then((maplibregl) => {
      if (cancelled || !mapElRef.current) return;

      if (!mapRef.current) {
        const map = new maplibregl.Map({
          container: mapElRef.current,
          style: STYLE_URL,
          center: [fire.lng, fire.lat],
          zoom: ENTRY.zoom,
          pitch: ENTRY.pitch,
          bearing: ENTRY.bearing,
          antialias: true,
          attributionControl: true,
          maxPitch: 75,
          dragRotate: true,
        });

        map.addControl(
          new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }),
          "top-right"
        );
        map.addControl(
          new maplibregl.ScaleControl({ unit: "imperial", maxWidth: 120 }),
          "bottom-left"
        );

        map.on("style.load", () => {
          styleReadyRef.current = true;
          installCustomLayers(map);
          installFireMarker(map, maplibregl);
          updateBurnLayers(map);
          if (plan) {
            installShelterMarkers(map, maplibregl, plan);
            updateEvacLayers(map, plan);
            kickOffRouteFetch(map, plan);
          }
        });

        map.on("load", () => {
          pendingFlyRef.current = setTimeout(() => {
            if (!mapRef.current) return;
            flyToTarget(mapRef.current, fire, plan, maplibregl, FIRST_FLY_DURATION);
          }, 450);
        });

        mapRef.current = map;
        initialFireIdRef.current = fire.id;
      } else if (initialFireIdRef.current !== fire.id) {
        const map = mapRef.current;
        initialFireIdRef.current = fire.id;
        flyToTarget(map, fire, plan, maplibregl, NEXT_FLY_DURATION);
        if (styleReadyRef.current) {
          installFireMarker(map, maplibregl);
          clearShelterMarkers();
          if (plan) {
            installShelterMarkers(map, maplibregl, plan);
            updateEvacLayers(map, plan);
            kickOffRouteFetch(map, plan);
          } else {
            updateEvacLayers(map, null);
          }
          updateBurnLayers(map);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fire?.id]);

  // ---- cleanup -----------------------------------------------------
  useEffect(() => {
    return () => {
      if (pendingFlyRef.current) clearTimeout(pendingFlyRef.current);
      if (dashAnimRef.current) cancelAnimationFrame(dashAnimRef.current);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      clearShelterMarkers();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      styleReadyRef.current = false;
    };
  }, []);

  // ---- burn polygons update on day change --------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !fire) return;
    updateBurnLayers(map);
  }, [fire, simulation?.day, simulation?.dayCount]);

  // ---- helpers -----------------------------------------------------

  function flyToTarget(map, fire, plan, maplibregl, duration) {
    if (plan) {
      // Frame the entire evac scenario (fire + zones + shelters) and keep
      // a moderate tilt so 3D buildings still read.
      const [[w, s], [e, n]] = evacBounds(fire, plan);
      const bounds = new maplibregl.LngLatBounds([w, s], [e, n]);
      map.fitBounds(bounds, {
        padding: { top: 80, right: 460, bottom: 220, left: 80 },
        pitch: 36,
        bearing: 0,
        duration,
        essential: true,
        maxZoom: 13.2,
      });
    } else {
      map.flyTo({
        center: [fire.lng, fire.lat],
        zoom: TARGET_LOCAL.zoom,
        pitch: TARGET_LOCAL.pitch,
        bearing: TARGET_LOCAL.bearing,
        duration,
        curve: 1.5,
        essential: true,
      });
    }
  }

  function installCustomLayers(map) {
    const layers = map.getStyle().layers || [];
    let labelLayerId;
    for (const l of layers) {
      if (l.type === "symbol" && l.layout && l.layout["text-field"]) {
        labelLayerId = l.id;
        break;
      }
    }

    if (!map.getLayer("fs-3d-buildings")) {
      map.addLayer(
        {
          id: "fs-3d-buildings",
          source: "openmaptiles",
          "source-layer": "building",
          filter: ["!=", ["get", "hide_3d"], true],
          type: "fill-extrusion",
          minzoom: 13.5,
          paint: {
            "fill-extrusion-color": [
              "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 0],
              0, "#5a5249", 25, "#6b6258", 80, "#7c7367", 200, "#8e8576",
            ],
            "fill-extrusion-height": [
              "interpolate", ["linear"], ["zoom"],
              13.5, 0, 15.2, ["coalesce", ["get", "render_height"], 0],
            ],
            "fill-extrusion-base": [
              "interpolate", ["linear"], ["zoom"],
              13.5, 0, 15.2, ["coalesce", ["get", "render_min_height"], 0],
            ],
            "fill-extrusion-opacity": 0.9,
          },
        },
        labelLayerId
      );
    }

    if (!map.getSource("fs-evac-zones")) {
      map.addSource("fs-evac-zones", { type: "geojson", data: emptyFC() });
      map.addLayer({
        id: "fs-evac-zones-fill",
        type: "fill",
        source: "fs-evac-zones",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "case",
            ["==", ["get", "status"], "ORDER"], 0.28,
            0.18,
          ],
        },
      });
      map.addLayer({
        id: "fs-evac-zones-line",
        type: "line",
        source: "fs-evac-zones",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-opacity": 0.85,
        },
      });
    }

    if (!map.getSource("fs-evac-roads")) {
      map.addSource("fs-evac-roads", { type: "geojson", data: emptyFC() });
      // Glow under the open evac corridor for emphasis.
      map.addLayer({
        id: "fs-evac-roads-glow",
        type: "line",
        source: "fs-evac-roads",
        filter: ["==", ["get", "status"], "OPEN"],
        paint: {
          "line-color": "#5EEAD4",
          "line-width": 9,
          "line-opacity": 0.18,
          "line-blur": 4,
        },
      });
      // Solid OPEN / DEGRADED roads.
      map.addLayer({
        id: "fs-evac-roads-line",
        type: "line",
        source: "fs-evac-roads",
        filter: ["!=", ["get", "status"], "CLOSED"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
      // Dashed CLOSED roads.
      map.addLayer({
        id: "fs-evac-roads-closed",
        type: "line",
        source: "fs-evac-roads",
        filter: ["==", ["get", "status"], "CLOSED"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.95,
          "line-dasharray": [2, 1.5],
        },
      });
    }

    if (!map.getSource("fs-evac-routes")) {
      map.addSource("fs-evac-routes", { type: "geojson", data: emptyFC() });
      map.addLayer({
        id: "fs-evac-routes-base",
        type: "line",
        source: "fs-evac-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#5EEAD4",
          "line-width": 5,
          "line-opacity": 0.25,
          "line-blur": 0.5,
        },
      });
      map.addLayer({
        id: "fs-evac-routes-dash",
        type: "line",
        source: "fs-evac-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#5EEAD4",
          "line-width": 3,
          "line-opacity": 0.95,
          "line-dasharray": [0, 2, 4],
        },
      });
      startDashAnimation(map);
    }

    if (!map.getSource("fs-burn-rings")) {
      map.addSource("fs-burn-rings", { type: "geojson", data: emptyFC() });
      // Outline only — historical day rings are drawn as dashed boundaries
      // so the fills don't stack into an opaque orange wash on the basemap.
      map.addLayer({
        id: "fs-burn-rings-line",
        type: "line",
        source: "fs-burn-rings",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.2,
          "line-opacity": 0.7,
          "line-dasharray": [2, 2],
        },
      });
    }

    if (!map.getSource("fs-burn-current")) {
      map.addSource("fs-burn-current", { type: "geojson", data: emptyFC() });
      map.addLayer({
        id: "fs-burn-current-fill",
        type: "fill",
        source: "fs-burn-current",
        paint: {
          "fill-color": "#FF6F2C",
          // Stay translucent at city zoom so streets / buildings / evac
          // layers remain visible through the burn area.
          "fill-opacity": [
            "interpolate", ["linear"], ["zoom"],
            6, 0.32, 10, 0.22, 13, 0.12, 15, 0.06, 18, 0.04,
          ],
        },
      });
      map.addLayer({
        id: "fs-burn-current-line",
        type: "line",
        source: "fs-burn-current",
        paint: {
          "line-color": "#FF3D14",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            8, 2, 13, 2.5, 16, 3.5,
          ],
          "line-opacity": 0.95,
        },
      });
    }
  }

  function installFireMarker(map, maplibregl) {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    const el = document.createElement("div");
    el.className = "fs-map-pin";
    el.innerHTML = `
      <div class="fs-map-pin-halo"></div>
      <div class="fs-map-pin-dot"></div>
      <div class="fs-map-pin-label">${escapeHtml(fire.name)}</div>
    `;
    markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([fire.lng, fire.lat])
      .addTo(map);
  }

  function installShelterMarkers(map, maplibregl, plan) {
    for (const s of plan.shelters) {
      const pct = Math.min(1, s.occupancy / Math.max(1, s.capacity));
      const accent = pct < 0.7 ? "#5EEAD4" : pct < 0.9 ? "#FFA744" : "#FF3D14";
      const el = document.createElement("div");
      el.className = "fs-shelter-pin";
      el.innerHTML = `
        <div class="fs-shelter-icon">⌂</div>
        <div class="fs-shelter-card">
          <div class="fs-shelter-name">${escapeHtml(s.name)}</div>
          <div class="fs-shelter-meta">${escapeHtml(s.city)} · ${s.status}</div>
          <div class="fs-shelter-bar">
            <div class="fs-shelter-bar-fill" style="width:${(pct * 100).toFixed(0)}%; background:${accent};"></div>
          </div>
          <div class="fs-shelter-bar-label">${s.occupancy.toLocaleString()} / ${s.capacity.toLocaleString()}</div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      shelterMarkersRef.current.push(marker);
    }
  }

  function clearShelterMarkers() {
    for (const m of shelterMarkersRef.current) m.remove();
    shelterMarkersRef.current = [];
  }

  function updateEvacLayers(map, plan) {
    const zonesData = !plan
      ? emptyFC()
      : {
          type: "FeatureCollection",
          features: plan.zones.map((z) =>
            polygonFeature(z.polygon, {
              status: z.status,
              color: ZONE_COLOR[z.status] || "#FF3D14",
              label: z.label,
              population: z.population,
            })
          ),
        };
    map.getSource("fs-evac-zones").setData(zonesData);

    const roadsData = !plan
      ? emptyFC()
      : {
          type: "FeatureCollection",
          features: (plan.roads || []).map((r) =>
            lineFeature(r.path, {
              status: r.status,
              color: ROAD_COLOR[r.status] || "#5EEAD4",
              name: r.name,
            })
          ),
        };
    map.getSource("fs-evac-roads").setData(roadsData);
  }

  async function kickOffRouteFetch(map, plan) {
    const routes = await fetchRoutesForPlan(plan);
    if (!mapRef.current || mapRef.current !== map) return;
    if (!map.getSource("fs-evac-routes")) return;
    map.getSource("fs-evac-routes").setData({
      type: "FeatureCollection",
      features: routes.map((r) =>
        lineFeature(r.coordinates, {
          zoneId: r.zoneId,
          durationSec: r.durationSec,
          distanceMi: r.distanceMi,
          source: r.source,
        })
      ),
    });
  }

  function startDashAnimation(map) {
    if (dashAnimRef.current) cancelAnimationFrame(dashAnimRef.current);
    // Cycle a 6-step dash pattern to create the "chasing arrows" effect.
    const seq = [
      [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
      [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [3.5, 3.5, 0],
    ];
    let i = 0;
    let last = performance.now();
    function tick(now) {
      if (!mapRef.current || mapRef.current !== map) return;
      if (now - last > 90) {
        i = (i + 1) % seq.length;
        try {
          map.setPaintProperty("fs-evac-routes-dash", "line-dasharray", seq[i]);
        } catch (e) { /* layer not ready */ }
        last = now;
      }
      dashAnimRef.current = requestAnimationFrame(tick);
    }
    dashAnimRef.current = requestAnimationFrame(tick);
  }

  function updateBurnLayers(map) {
    if (!fire) return;
    const frames = getProgression(fire);
    const dayFloat = simulation?.day || 1;
    const curIdx = Math.max(0, Math.min(frames.length - 1, Math.floor(dayFloat) - 1));
    const fracIdx = Math.max(0, Math.min(frames.length - 1, dayFloat - 1));
    const i0 = Math.floor(fracIdx);
    const i1 = Math.min(frames.length - 1, i0 + 1);
    const tFrac = fracIdx - i0;

    const ringFeatures = [];
    for (let i = 0; i < curIdx; i++) {
      const poly = getBurnPolygon(fire, frames[i], 48);
      ringFeatures.push(
        polygonFeature(poly, {
          color: RING_COLORS[Math.min(RING_COLORS.length - 1, i)],
          fillOpacity: 0.08 + 0.03 * i,
        })
      );
    }
    map.getSource("fs-burn-rings").setData({
      type: "FeatureCollection",
      features: ringFeatures,
    });

    if (curIdx >= 1) {
      const blended = {
        ...frames[i0],
        semiMajorMi:
          frames[i0].semiMajorMi +
          (frames[i1].semiMajorMi - frames[i0].semiMajorMi) * tFrac,
        semiMinorMi:
          frames[i0].semiMinorMi +
          (frames[i1].semiMinorMi - frames[i0].semiMinorMi) * tFrac,
      };
      const poly = getBurnPolygon(fire, blended, 64);
      map.getSource("fs-burn-current").setData({
        type: "FeatureCollection",
        features: [polygonFeature(poly)],
      });
    } else {
      map.getSource("fs-burn-current").setData(emptyFC());
    }
  }

  if (!fire) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(1.06)",
        transformOrigin: "center center",
        transition:
          "opacity 820ms cubic-bezier(0.22, 0.65, 0.34, 1), transform 920ms cubic-bezier(0.22, 0.65, 0.34, 1)",
        pointerEvents: visible ? "auto" : "none",
        willChange: "opacity, transform",
      }}
    >
      <div
        ref={mapElRef}
        style={{ position: "absolute", inset: 0, background: "#0a0908" }}
      />
    </div>
  );
}

function emptyFC() {
  return { type: "FeatureCollection", features: [] };
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
