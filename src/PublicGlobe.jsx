// Public Globe surface — full-bleed Earth + corner UI + drawer + simulation

import { useCallback, useEffect, useRef, useState } from "react";
import Globe from "./Globe.jsx";
import IncidentDrawer from "./IncidentDrawer.jsx";
import FireSimInset from "./FireSimInset.jsx";
import { MOCK_FIRES } from "./data.js";
import {
  clusterSummariesToDraftIncidents,
  enrichDemoMocks,
  fetchFirmsClusterSummaries,
  fetchWeatherSnapshot,
  mergeIncidentSnapshots,
  queueReverseGeocodes,
} from "./firmsLive.js";
import { AgentStatusPill, Caption, LayerToggles, Mono, NumberCounter, StatsTicker, StatusDot } from "./ui.jsx";

const FIRMS_REFRESH_MS = 5 * 60 * 1000;
const FIRMS_LOG = "[FireSync FIRMS]";

export default function PublicGlobe({ onOpenCommand }) {
  const [fires, setFires] = useState([]);
  const [firesLoading, setFiresLoading] = useState(true);
  const [firesDemoFallback, setFiresDemoFallback] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [cycle, setCycle] = useState(4127);
  const [lastRun] = useState(Date.now() - 167_000);
  const [hintVisible, setHintVisible] = useState(true);
  const [sim, setSim] = useState({ fireId: null, day: 1, dayCount: 7, playing: false });
  const globeRef = useRef(null);
  const firesRef = useRef([]);
  firesRef.current = fires;

  const [layers, setLayers] = useState({
    perimeter: { label: "Fire Perimeter", on: true },
    wind: { label: "Wind Vectors", on: false },
    smoke: { label: "Smoke Plumes", on: false },
    evac: { label: "Evac Zones", on: true },
    shelters: { label: "Shelters", on: false },
  });
  const [stats, setStats] = useState({
    warningPpl: 1_284_901,
    evacOrders24h: 38,
    jurisdictions: 156,
  });

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setStats((s) => ({
        warningPpl: s.warningPpl + Math.floor((Math.random() - 0.4) * 400),
        evacOrders24h: s.evacOrders24h + (Math.random() < 0.15 ? 1 : 0),
        jurisdictions: s.jurisdictions + (Math.random() < 0.08 ? 1 : 0),
      }));
    }, 3200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const patchFire = useCallback((id, patch) => {
    setFires((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let abortCtl = null;
    let refreshGeneration = 0;

    const refresh = async () => {
      abortCtl?.abort();
      abortCtl = new AbortController();
      const signal = abortCtl.signal;
      const gen = ++refreshGeneration;

      try {
        console.log(`${FIRMS_LOG} Refresh tick — requesting live clusters…`);
        const summaries = await fetchFirmsClusterSummaries(signal);
        if (cancelled || gen !== refreshGeneration) return;

        const drafts = clusterSummariesToDraftIncidents(summaries);
        console.log(`${FIRMS_LOG} Mapped to globe incidents`, {
          pins: drafts.length,
          source: "NASA FIRMS VIIRS NOAA-20+21 merged",
        });
        setFires((prev) => {
          const merged = mergeIncidentSnapshots(prev, drafts);
          queueMicrotask(() =>
            queueReverseGeocodes(merged, (fireId, geoPatch) => patchFire(fireId, geoPatch)),
          );
          return merged;
        });
        setFiresDemoFallback(false);
      } catch (err) {
        if (cancelled || err?.name === "AbortError" || gen !== refreshGeneration) return;
        console.warn(`${FIRMS_LOG} Live fetch failed — using MOCK_FIRES (demo).`, {
          reason: err?.message || String(err),
        });
        setFires(enrichDemoMocks(MOCK_FIRES));
        setFiresDemoFallback(true);
      } finally {
        if (!cancelled && gen === refreshGeneration) setFiresLoading(false);
      }
    };

    refresh();
    const interval = setInterval(refresh, FIRMS_REFRESH_MS);
    return () => {
      cancelled = true;
      abortCtl?.abort();
      clearInterval(interval);
    };
  }, [patchFire]);

  useEffect(() => {
    if (selectedId && !fires.some((f) => f.id === selectedId)) setSelectedId(null);
  }, [fires, selectedId]);

  // Simulation auto-play
  useEffect(() => {
    if (!selectedId) { setSim({ fireId: null, day: 1, dayCount: 7, playing: false }); return; }
    setSim({ fireId: selectedId, day: 1, dayCount: 7, playing: true });
  }, [selectedId]);

  useEffect(() => {
    if (!sim.playing) return;
    const id = setInterval(() => {
      setSim((s) => {
        if (!s.playing) return s;
        const next = s.day + 0.18;
        if (next >= s.dayCount) return { ...s, day: s.dayCount, playing: false };
        return { ...s, day: next };
      });
    }, 90);
    return () => clearInterval(id);
  }, [sim.playing]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      const fire = firesRef.current.find((x) => x.id === selectedId);
      if (!fire || fire.windFetched || fire._demoMock) return;
      try {
        const { windMph, humidityPct } = await fetchWeatherSnapshot(fire.lat, fire.lng);
        if (cancelled) return;
        patchFire(fire.id, {
          windMph,
          humidityPct,
          wind_mph: windMph,
          humidity_pct: humidityPct,
          windFetched: true,
        });
      } catch {
        patchFire(fire.id, { windFetched: true });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, patchFire]);

  const selected = fires.find((f) => f.id === selectedId);
  const hovered = fires.find((f) => f.id === hoveredId);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", overflow: "hidden" }}>
      <Globe
        ref={globeRef}
        fires={fires}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setHintVisible(false); }}
        onHover={(id, pos) => { setHoveredId(id); setTooltipPos(pos); }}
        simulation={sim}
      />

      <div className="vignette" />

      <div style={{
        position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 14, zIndex: 15,
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)",
        letterSpacing: "0.16em",
      }}>
        <span style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          N 39.96° · W 121.78° · ALT 2.50AU
        </span>
        <div
          role="group"
          aria-label="Globe zoom"
          style={{
            display: "inline-flex",
            border: "1px solid var(--hairline-strong)",
            background: "var(--surface-1)",
            opacity: 0.92,
          }}
        >
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => globeRef.current?.zoomOut()}
            style={{
              width: 26, height: 26,
              padding: 0,
              margin: 0,
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            −
          </button>
          <div style={{ width: 1, alignSelf: "stretch", background: "var(--hairline-strong)" }} />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => globeRef.current?.zoomIn()}
            style={{
              width: 26, height: 26,
              padding: 0,
              margin: 0,
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
        </div>
      </div>

      <div className="fade-in" style={{ position: "absolute", top: 32, left: 32, zIndex: 20, pointerEvents: "none" }}>
        <AgentStatusPill cycle={cycle} lastRunMs={lastRun} />
        <Mono
          size={11}
          color="var(--text-tertiary)"
          className={firesLoading ? "dot-pulse" : undefined}
          style={{ marginTop: 14, letterSpacing: "0.12em", display: "block", whiteSpace: "nowrap" }}
        >
          {firesLoading ? (
            "loading fires…"
          ) : (
            <>
              <NumberCounter value={fires.length} /> active incidents worldwide
              {firesDemoFallback && (
                <span style={{ opacity: 0.72, marginLeft: 8 }}>· using demo data</span>
              )}
            </>
          )}
        </Mono>
      </div>

      <div className="fade-in" style={{ position: "absolute", top: 32, right: 32, zIndex: 20, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ border: "1px solid var(--hairline)", padding: "6px 12px", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500, pointerEvents: "auto" }}>Embed</button>
          <button style={{ border: "1px solid var(--hairline)", padding: "6px 12px", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500, pointerEvents: "auto" }}>Share</button>
        </div>
        <LayerToggles
          layers={layers}
          onToggle={(key) => setLayers((l) => ({ ...l, [key]: { ...l[key], on: !l[key].on } }))}
        />
      </div>

      {!selected && (
        <div className="fade-in" style={{ position: "absolute", bottom: 32, left: 32, zIndex: 20 }}>
          <StatsTicker
            stats={[
              { label: "People in Warning Zones", value: stats.warningPpl },
              { label: "Evac Orders Drafted (24h)", value: stats.evacOrders24h },
              { label: "Jurisdictions Notified", value: stats.jurisdictions },
            ]}
          />
        </div>
      )}

      {selected && (
        <div style={{ position: "absolute", bottom: 32, left: 32, zIndex: 25 }}>
          <FireSimInset
            fire={selected}
            simulation={sim}
            onSimChange={(patch) => setSim((s) => ({ ...s, ...patch }))}
          />
        </div>
      )}

      <div className="fade-in" style={{ position: "absolute", bottom: 32, right: 32, zIndex: 20, pointerEvents: "auto" }}>
        <button
          onClick={onOpenCommand}
          style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            padding: "12px 18px",
            border: "1px solid var(--hairline-strong)",
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
            cursor: "pointer",
            transition: "background 180ms var(--ease)",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-1)")}
        >
          <StatusDot variant="info" size={6} pulse />
          Open Command Center
          <span style={{ marginLeft: 4 }}>→</span>
        </button>
      </div>

      {hintVisible && (
        <div style={{
          position: "absolute", bottom: 92, left: "50%", transform: "translateX(-50%)",
          color: "var(--text-tertiary)", zIndex: 20, pointerEvents: "none",
          transition: "opacity 600ms var(--ease)",
          opacity: hintVisible ? 1 : 0,
        }}>
          <Caption>Drag to rotate · Scroll or +/− to zoom · Click a pin</Caption>
        </div>
      )}

      {hovered && tooltipPos && !selected && (
        <div style={{
          position: "fixed", left: tooltipPos.x + 16, top: tooltipPos.y + 16,
          background: "var(--surface-2)", border: "1px solid var(--hairline-strong)",
          padding: "10px 12px", zIndex: 25, pointerEvents: "none", minWidth: 200,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <StatusDot variant={hovered.evacOrderActive ? "critical" : "warning"} size={6} />
            <span className="body-sm" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{hovered.name}</span>
          </div>
          <Mono size={11} color="var(--text-tertiary)" style={{ display: "block", marginBottom: 6 }}>{hovered.jurisdiction}</Mono>
          {typeof hovered.point_count === "number" && (
            <Mono size={10} color="var(--text-disabled)" style={{ display: "block", marginBottom: 6 }}>
              {hovered.point_count} VIIRS detects · max FRP {hovered.max_frp != null ? hovered.max_frp.toFixed(1) : "—"} MW
            </Mono>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <Mono size={11} color="var(--text-secondary)">
              {hovered.acres != null ? `${hovered.acres.toLocaleString()} ac` : "Est. large"}
            </Mono>
            <Mono size={11} color="var(--text-secondary)">
              {hovered.containmentPct != null ? `${hovered.containmentPct}% cont` : "—"}
            </Mono>
          </div>
        </div>
      )}

      {selected && <IncidentDrawer fire={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
