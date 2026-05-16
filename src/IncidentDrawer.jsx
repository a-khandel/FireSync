// Civilian-readable fire detail drawer

import { Caption, Hairline, MetricRow, Mono, RoadStatusRow, ShelterRow, StatusDot, TimeAgo, ZoneRow } from "./ui.jsx";

export default function IncidentDrawer({ fire, onClose }) {
  if (!fire) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 0, right: 0, bottom: 0,
        width: 440,
        background: "var(--surface-1)",
        borderLeft: "1px solid var(--hairline-strong)",
        overflowY: "auto",
        zIndex: 30,
        animation: "fs-slide-right 360ms var(--ease) both",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px" }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ width: 28, height: 28, border: "1px solid var(--hairline)", color: "var(--text-secondary)", display: "grid", placeItems: "center", fontSize: 14 }}
        >×</button>
        <button style={{ border: "1px solid var(--hairline)", padding: "6px 12px", color: "var(--text-secondary)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>Share</button>
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        {fire.evacOrderActive && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <StatusDot variant="critical" pulse size={6} />
            <Caption style={{ color: "var(--critical)", letterSpacing: "0.1em" }}>EVAC ORDER ACTIVE</Caption>
          </div>
        )}
        <div style={{ width: 24, height: 1, background: "var(--hairline-strong)", margin: "12px 0" }} />
        <h1 className="display-lg" style={{ margin: 0, color: "var(--text-primary)" }}>{fire.name}</h1>
        <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 6 }}>{fire.jurisdiction}</div>
      </div>

      <Hairline />

      <div style={{ padding: "16px 24px" }}>
        <MetricRow label="Size" value={fire.acres?.toLocaleString()} unit="acres" />
        <MetricRow
          label="Containment"
          value={fire.containmentPct}
          unit="%"
          valueColor={fire.containmentPct < 30 ? "var(--critical)" : fire.containmentPct < 60 ? "var(--warning)" : "var(--safe)"}
        />
        {fire.perimeterMi != null && <MetricRow label="Perimeter" value={fire.perimeterMi} unit="mi" />}
        {fire.growth24hAcres != null && (
          <MetricRow
            label="Growth (24h)"
            value={<><span style={{ color: "var(--critical)" }}>↑</span> {fire.growth24hAcres.toLocaleString()}</>}
            unit="acres"
          />
        )}
        {fire.windMph != null && (
          <MetricRow
            label="Wind"
            value={`${fire.windMph} mph ${fire.windDirFrom || ""}${fire.windDirTo ? " → " + fire.windDirTo : ""}`}
          />
        )}
        {fire.humidityPct != null && <MetricRow label="Humidity" value={fire.humidityPct} unit="%" />}
        {fire.detectedAt && (
          <MetricRow
            label="Detected"
            value={new Date(fire.detectedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          />
        )}
      </div>

      {fire.zones && (
        <>
          <Hairline />
          <div style={{ padding: "16px 24px" }}>
            <Caption style={{ marginBottom: 8 }}>Evacuation Orders</Caption>
            {fire.zones.map((z) => <ZoneRow key={z.id} zone={z} />)}
          </div>
        </>
      )}

      {fire.roads && (
        <>
          <Hairline />
          <div style={{ padding: "16px 24px" }}>
            <Caption style={{ marginBottom: 8 }}>Road Status</Caption>
            {fire.roads.map((r) => <RoadStatusRow key={r.id} road={r} />)}
          </div>
        </>
      )}

      {fire.shelters && (
        <>
          <Hairline />
          <div style={{ padding: "16px 24px" }}>
            <Caption style={{ marginBottom: 8 }}>Nearest Shelters</Caption>
            {fire.shelters.map((s) => <ShelterRow key={s.id} shelter={s} />)}
          </div>
        </>
      )}

      <Hairline />
      <div style={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Caption>Sources</Caption>
          <Mono size={11} color="var(--text-secondary)">{(fire.sources || ["FIRMS", "NWS"]).join(" · ")}</Mono>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <Caption>Last Update</Caption>
          <Mono size={11} color="var(--text-secondary)"><TimeAgo from={fire.lastUpdateAt || Date.now() - 60_000} /> ago</Mono>
        </div>
      </div>
    </div>
  );
}
