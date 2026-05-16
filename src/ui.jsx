// FireSync UI primitives — atoms + molecules

import { useEffect, useState } from "react";

export function StatusDot({ variant = "info", pulse = false, size = 8, style }) {
  const colors = {
    critical: "var(--critical)",
    warning: "var(--warning)",
    info: "var(--info)",
    safe: "var(--safe)",
    neutral: "var(--neutral)",
    text: "var(--text-primary)",
  };
  return (
    <span
      className={pulse ? "pulse" : ""}
      style={{
        display: "inline-block",
        width: size, height: size, borderRadius: "50%",
        background: colors[variant] || variant,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function Hairline({ vertical = false, color, style }) {
  return (
    <div
      style={{
        background: color || "var(--hairline)",
        ...(vertical ? { width: 1, alignSelf: "stretch" } : { height: 1, width: "100%" }),
        ...style,
      }}
    />
  );
}

export function Pill({ active, children, onClick, leftDot, color = "info", style }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        border: "1px solid var(--hairline)",
        background: active ? "var(--surface-2)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontFamily: "var(--font-body)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "background 180ms var(--ease), color 180ms var(--ease)",
        ...style,
      }}
    >
      {leftDot && active && <StatusDot variant={color} size={6} />}
      {children}
    </button>
  );
}

export function Caption({ children, style, color }) {
  return (
    <div className="caption" style={{ color: color || "var(--text-tertiary)", ...style }}>
      {children}
    </div>
  );
}

export function Mono({ children, color, size, weight, style }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontVariantNumeric: "tabular-nums",
        color: color || "inherit",
        fontSize: size,
        fontWeight: weight,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function MetricRow({ label, value, unit, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", gap: 16 }}>
      <Caption style={{ color: "var(--text-tertiary)" }}>{label}</Caption>
      <Mono size={13} color={valueColor || "var(--text-primary)"} weight={500}>
        {value}
        {unit && <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>{unit}</span>}
      </Mono>
    </div>
  );
}

export function CapacityBar({ current, max, segments = 6, accent = "var(--safe)" }) {
  const filled = Math.round((current / max) * segments);
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 12, height: 4,
            background: i < filled ? accent : "var(--hairline-strong)",
            opacity: i < filled ? 0.9 : 1,
          }}
        />
      ))}
    </span>
  );
}

export function TimeAgo({ from }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Date.now() - from;
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{hh}:{mm}:{ss}</span>;
}

export function NumberCounter({ value, format = (v) => v.toLocaleString("en-US"), style }) {
  const [display, setDisplay] = useState(value);
  const [opacity, setOpacity] = useState(1);
  useEffect(() => {
    if (value === display) return;
    setOpacity(0);
    const t = setTimeout(() => {
      setDisplay(value);
      setOpacity(1);
    }, 120);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", opacity, transition: "opacity 180ms var(--ease)", ...style }}>
      {format(display)}
    </span>
  );
}

// ---- Composed widgets ----

export function AgentStatusPill({ cycle, lastRunMs }) {
  return (
    <div style={{ pointerEvents: "auto", whiteSpace: "nowrap" }}>
      <div className="display-md" style={{ color: "var(--text-primary)", letterSpacing: "0.02em" }}>FIRESYNC</div>
      <div style={{ width: 32, height: 1, background: "var(--hairline-strong)", margin: "10px 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusDot variant="info" pulse size={8} />
        <span className="caption" style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          AGENT ACTIVE · CYCLE&nbsp;<Mono size={11} weight={500} color="var(--text-primary)">{cycle.toLocaleString("en-US")}</Mono>
        </span>
      </div>
      <div className="mono-sm" style={{ color: "var(--text-tertiary)", marginTop: 4, paddingLeft: 16, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
        LAST RUN <TimeAgo from={lastRunMs} /> AGO
      </div>
    </div>
  );
}

export function StatsTicker({ stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, pointerEvents: "auto" }}>
      {stats.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <Caption style={{ width: 240, color: "var(--text-tertiary)" }}>{s.label}</Caption>
          <Mono size={14} color="var(--text-primary)" weight={500}>
            <NumberCounter value={s.value} />
          </Mono>
        </div>
      ))}
    </div>
  );
}

export function LayerToggles({ layers, onToggle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", pointerEvents: "auto" }}>
      {Object.entries(layers).map(([key, v]) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            border: `1px solid ${v.on ? "var(--hairline-strong)" : "var(--hairline)"}`,
            background: v.on ? "var(--surface-2)" : "transparent",
            color: v.on ? "var(--text-primary)" : "var(--text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            minWidth: 160,
            justifyContent: "flex-start",
            transition: "all 180ms var(--ease)",
          }}
        >
          <span
            style={{
              display: "inline-block", width: 6, height: 6, borderRadius: 1,
              background: v.on ? "var(--info)" : "transparent",
              border: v.on ? "none" : "1px solid var(--hairline-strong)",
            }}
          />
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function RoadStatusRow({ road }) {
  const colors = { OPEN: "var(--safe)", DEGRADED: "var(--warning)", CLOSED: "var(--critical)" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "64px 80px 1fr", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
      <Mono size={12} color="var(--text-primary)" weight={500}>{road.name}</Mono>
      <Mono size={11} color={colors[road.status]} weight={500} style={{ letterSpacing: "0.06em" }}>{road.status}</Mono>
      <Mono size={11} color="var(--text-tertiary)">{road.from && road.to ? `${road.from} → ${road.to}` : road.note || ""}</Mono>
    </div>
  );
}

export function ZoneRow({ zone }) {
  const colors = { ORDER: "var(--critical)", WARNING: "var(--warning)" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "76px 76px 1fr auto", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)", alignItems: "center" }}>
      <Mono size={12} color="var(--text-primary)" weight={500}>{zone.label}</Mono>
      <Mono size={11} color={colors[zone.status]} weight={500} style={{ letterSpacing: "0.06em" }}>{zone.status}</Mono>
      <span />
      <Mono size={12} color="var(--text-secondary)">{zone.population.toLocaleString()} ppl</Mono>
    </div>
  );
}

export function ShelterRow({ shelter }) {
  const pct = shelter.occupancy / shelter.capacity;
  const accent = pct < 0.7 ? "var(--safe)" : pct < 0.9 ? "var(--warning)" : "var(--critical)";
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="body-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{shelter.name}</span>
        <Mono size={11} color="var(--text-tertiary)">{shelter.distanceMi} mi</Mono>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Mono size={11} color="var(--text-tertiary)">{shelter.city} · <span style={{ color: "var(--safe)" }}>{shelter.status}</span></Mono>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CapacityBar current={shelter.occupancy} max={shelter.capacity} accent={accent} />
          <Mono size={11} color="var(--text-secondary)">{shelter.occupancy} / {shelter.capacity}</Mono>
        </div>
      </div>
    </div>
  );
}
