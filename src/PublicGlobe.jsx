// Public Globe surface — full-bleed Earth + corner UI + drawer + simulation

import { useEffect, useRef, useState } from "react";
import Globe from "./Globe.jsx";
import IncidentDrawer from "./IncidentDrawer.jsx";
import FireSimInset from "./FireSimInset.jsx";
import { FIRES } from "./data.js";
import { AgentStatusPill, Caption, LayerToggles, Mono, StatsTicker, StatusDot } from "./ui.jsx";

export default function PublicGlobe({ onOpenCommand }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [cycle, setCycle] = useState(4127);
  const [lastRun] = useState(Date.now() - 167_000);
  const [hintVisible, setHintVisible] = useState(true);
  const [sim, setSim] = useState({ fireId: null, day: 1, dayCount: 7, playing: false });
  const globeRef = useRef(null);
  const [layers, setLayers] = useState({
    perimeter: { label: "Fire Perimeter", on: true },
    wind: { label: "Wind Vectors", on: false },
    smoke: { label: "Smoke Plumes", on: false },
    evac: { label: "Evac Zones", on: true },
    shelters: { label: "Shelters", on: false },
  });
  const [stats, setStats] = useState({
    incidents: 247,
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
        incidents: s.incidents + (Math.random() < 0.4 ? (Math.random() < 0.5 ? 1 : -1) : 0),
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

  const selected = FIRES.find((f) => f.id === selectedId);
  const hovered = FIRES.find((f) => f.id === hoveredId);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", overflow: "hidden" }}>
      <Globe
        ref={globeRef}
        fires={FIRES}
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
              { label: "Active Incidents", value: stats.incidents },
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <Mono size={11} color="var(--text-secondary)">{hovered.acres?.toLocaleString() || "—"} ac</Mono>
            <Mono size={11} color="var(--text-secondary)">{hovered.containmentPct ?? "—"}% cont</Mono>
          </div>
        </div>
      )}

      {selected && <IncidentDrawer fire={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
