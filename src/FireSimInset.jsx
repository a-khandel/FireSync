// Live fire-spread simulation inset — small floating widget showing the
// piece of land where a fire ignited, with the burn area growing day by day.

import { useMemo } from "react";
import { Caption, Mono, StatusDot } from "./ui.jsx";
import { getBurnPolygon, getProgression } from "./data.js";

function fireSeed(fire) {
  let s = 0;
  const k = fire.id || fire.name || "x";
  for (let i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) | 0;
  return Math.abs(s);
}
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function localFeatures(fire) {
  const rand = seededRand(fireSeed(fire));
  const townNames = ["Cohasset", "Forest Ranch", "Paradise", "Magalia", "Chico", "Stirling", "Concow", "Inskip", "Helltown", "Butte Creek"];
  const towns = [];
  for (let i = 0; i < 4; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 0.18 + rand() * 0.6;
    towns.push({
      name: townNames[(fireSeed(fire) + i) % townNames.length],
      ux: Math.cos(ang) * dist,
      uy: Math.sin(ang) * dist,
      size: 8 + Math.floor(rand() * 8),
    });
  }
  const roads = [];
  for (let i = 0; i < towns.length - 1; i++) {
    const a = towns[i], b = towns[i + 1];
    const cx = (a.ux + b.ux) / 2 + (rand() - 0.5) * 0.4;
    const cy = (a.uy + b.uy) / 2 + (rand() - 0.5) * 0.4;
    roads.push({ ax: a.ux, ay: a.uy, cx, cy, bx: b.ux, by: b.uy, kind: rand() > 0.6 ? "highway" : "local" });
  }
  for (let i = 0; i < 2; i++) {
    const ax = -1 + rand() * 0.2 + i * 0.1;
    const ay = -1 + rand() * 0.4;
    const bx = 1 - rand() * 0.2 - i * 0.1;
    const by = 1 - rand() * 0.4;
    roads.push({ ax, ay, cx: (rand() - 0.5) * 0.6, cy: (rand() - 0.5) * 0.6, bx, by, kind: "highway" });
  }
  const ridges = [];
  for (let i = 0; i < 6; i++) {
    const points = [];
    let x = -1.2, y = -1 + rand() * 2;
    while (x < 1.2) {
      points.push([x, y]);
      x += 0.12 + rand() * 0.08;
      y += (rand() - 0.5) * 0.18;
      y = Math.max(-1, Math.min(1, y));
    }
    ridges.push(points);
  }
  return { towns, roads, ridges };
}

export default function FireSimInset({ fire, simulation, onSimChange }) {
  if (!fire) return null;

  const frames = getProgression(fire);
  const dayCount = simulation?.dayCount || frames.length;
  const curIdx = Math.max(0, Math.min(frames.length - 1, Math.floor(simulation?.day || 1) - 1));
  const dayFloat = simulation?.day || 1;
  const fracIdx = Math.max(0, Math.min(frames.length - 1, dayFloat - 1));
  const playing = !!simulation?.playing;
  const features = useMemo(() => localFeatures(fire), [fire.id]);

  const VB = 200;
  const half = VB / 2;
  const W = 340, H = 220;
  const ux = (u) => u * (half - 6);
  const uy = (u) => u * (half - 6);

  const maxRadius = frames[frames.length - 1].semiMajorMi;
  const extentMi = Math.max(8, maxRadius * 1.6);

  function burnPolyForFrame(frame) {
    const poly = getBurnPolygon(fire, frame, 48);
    const cosLat = Math.cos((fire.lat * Math.PI) / 180);
    const pts = poly.map(([lng, lat]) => {
      const eMi = (lng - fire.lng) * 69.0 * cosLat;
      const nMi = (lat - fire.lat) * 69.0;
      const u = eMi / extentMi;
      const v = -nMi / extentMi;
      return `${ux(u).toFixed(2)},${uy(v).toFixed(2)}`;
    });
    return "M " + pts.join(" L ") + " Z";
  }

  function interpolatedPolyD() {
    const i0 = Math.floor(fracIdx);
    const i1 = Math.min(frames.length - 1, i0 + 1);
    const t = fracIdx - i0;
    const f0 = frames[i0], f1 = frames[i1];
    const blended = {
      ...f0,
      semiMajorMi: f0.semiMajorMi + (f1.semiMajorMi - f0.semiMajorMi) * t,
      semiMinorMi: f0.semiMinorMi + (f1.semiMinorMi - f0.semiMinorMi) * t,
    };
    return burnPolyForFrame(blended);
  }

  const i0 = Math.floor(fracIdx);
  const i1 = Math.min(frames.length - 1, i0 + 1);
  const t = fracIdx - i0;
  const curAcres = Math.round(frames[i0].acres + (frames[i1].acres - frames[i0].acres) * t);
  const windBearing = frames[0].bearingDeg;

  return (
    <div
      style={{
        width: W,
        background: "var(--surface-1)",
        border: "1px solid var(--hairline-strong)",
        boxShadow: "0 24px 48px -16px rgba(0,0,0,0.7)",
        pointerEvents: "auto",
        position: "relative",
        animation: "fs-fade-in 360ms var(--ease) both",
      }}
    >
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <StatusDot variant="critical" pulse={playing} size={6} />
          <Caption style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Live Simulation</Caption>
        </div>
        <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          {fire.lat.toFixed(2)}°N · {Math.abs(fire.lng).toFixed(2)}°{fire.lng < 0 ? "W" : "E"}
        </Mono>
      </div>

      <div style={{ padding: "10px 14px 6px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ whiteSpace: "nowrap" }}>
          <span className="display-md" style={{ fontStyle: "italic", color: "var(--text-primary)", fontSize: 26 }}>Day {Math.max(1, Math.floor(dayFloat))}</span>
          <Mono size={10} color="var(--text-tertiary)" style={{ marginLeft: 8, letterSpacing: "0.08em" }}>OF {dayCount}</Mono>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <Mono size={15} color="var(--critical)" weight={500}>{curAcres.toLocaleString()}</Mono>
          <Mono size={9} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>ACRES BURNED</Mono>
        </div>
      </div>

      <Mono size={10} color="var(--text-secondary)" style={{ display: "block", margin: "0 14px 6px", fontStyle: "italic" }}>
        {frames[curIdx].label}
      </Mono>

      <div style={{ position: "relative", margin: "4px 14px", border: "1px solid var(--hairline)", background: "#0c0b09", overflow: "hidden" }}>
        <svg viewBox={`-100 -100 200 ${VB}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
          <defs>
            <pattern id={`sim-grid-${fire.id}`} patternUnits="userSpaceOnUse" width="20" height="20">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(244,241,235,0.045)" strokeWidth="0.4" />
            </pattern>
            <radialGradient id={`sim-fire-${fire.id}`}>
              <stop offset="0" stopColor="#FFD66B" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#FF6F2C" stopOpacity="0.55" />
              <stop offset="1" stopColor="#C82400" stopOpacity="0.15" />
            </radialGradient>
            <linearGradient id={`sim-burn-${fire.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFA744" stopOpacity="0.42" />
              <stop offset="1" stopColor="#C82400" stopOpacity="0.62" />
            </linearGradient>
          </defs>

          <rect x="-100" y="-100" width="200" height="200" fill={`url(#sim-grid-${fire.id})`} />

          {features.ridges.map((pts, i) => (
            <polyline
              key={i}
              fill="none"
              stroke="rgba(244,241,235,0.07)"
              strokeWidth="0.6"
              points={pts.map(([x, y]) => `${ux(x)},${uy(y)}`).join(" ")}
            />
          ))}

          {features.roads.map((r, i) => (
            <path
              key={i}
              d={`M ${ux(r.ax)} ${uy(r.ay)} Q ${ux(r.cx)} ${uy(r.cy)} ${ux(r.bx)} ${uy(r.by)}`}
              fill="none"
              stroke={r.kind === "highway" ? "rgba(244,241,235,0.22)" : "rgba(244,241,235,0.12)"}
              strokeWidth={r.kind === "highway" ? 1.1 : 0.7}
            />
          ))}

          {features.towns.map((tw, i) => (
            <g key={i} transform={`translate(${ux(tw.ux)}, ${uy(tw.uy)})`}>
              <rect x="-2" y="-2" width="4" height="4" fill="rgba(244,241,235,0.55)" />
              <text x="6" y="2" fill="rgba(244,241,235,0.55)" fontSize="5" fontFamily="JetBrains Mono">{tw.name}</text>
            </g>
          ))}

          {frames.slice(0, curIdx + 1).map((f, i) => {
            if (i === curIdx) return null;
            const d = burnPolyForFrame(f);
            const stroke = ["#FFD66B", "#FFA744", "#FF6F2C", "#FF3D14", "#C82400"][Math.min(4, i)];
            return (
              <path
                key={i}
                d={d}
                fill={stroke}
                fillOpacity={0.18 + 0.04 * i}
                stroke={stroke}
                strokeOpacity="0.35"
                strokeWidth="0.4"
                strokeDasharray="1 1.5"
              />
            );
          })}

          {curIdx >= 1 && (
            <path
              d={interpolatedPolyD()}
              fill={`url(#sim-burn-${fire.id})`}
              stroke="#FF3D14"
              strokeWidth="1.1"
              style={{ filter: "drop-shadow(0 0 6px rgba(255, 61, 20, 0.55))" }}
            />
          )}

          <g transform={`translate(78, -82) rotate(${windBearing})`}>
            <line x1="0" y1="-7" x2="0" y2="7" stroke="rgba(94,234,212,0.7)" strokeWidth="1" />
            <line x1="0" y1="7" x2="-3" y2="3" stroke="rgba(94,234,212,0.7)" strokeWidth="1" />
            <line x1="0" y1="7" x2="3" y2="3" stroke="rgba(94,234,212,0.7)" strokeWidth="1" />
          </g>
          <text x="78" y="-58" fill="rgba(94,234,212,0.7)" fontSize="4" fontFamily="JetBrains Mono" textAnchor="middle">WIND</text>

          <g transform="translate(0, 0)">
            {dayFloat < 1.6 && (
              <circle r="8" fill="none" stroke="#FFD66B" strokeWidth="0.7">
                <animate attributeName="r" values="3;12" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle r={dayFloat < 1.5 ? 3.5 : 2.2} fill={`url(#sim-fire-${fire.id})`} />
            <circle r="1.6" fill="#FFD66B" />
            <line x1="-6" y1="0" x2="-3" y2="0" stroke="rgba(244,241,235,0.8)" strokeWidth="0.5" />
            <line x1="3" y1="0" x2="6" y2="0" stroke="rgba(244,241,235,0.8)" strokeWidth="0.5" />
            <line x1="0" y1="-6" x2="0" y2="-3" stroke="rgba(244,241,235,0.8)" strokeWidth="0.5" />
            <line x1="0" y1="3" x2="0" y2="6" stroke="rgba(244,241,235,0.8)" strokeWidth="0.5" />
            <text x="9" y="-7" fill="#FFD66B" fontSize="5" fontFamily="JetBrains Mono" letterSpacing="0.5">IGNITION</text>
            <text x="9" y="-1" fill="rgba(244,241,235,0.6)" fontSize="4" fontFamily="JetBrains Mono">{frames[0].acres.toLocaleString()} ac · D1</text>
          </g>

          <g transform="translate(-90, 88)">
            <line x1="0" y1="0" x2="40" y2="0" stroke="rgba(244,241,235,0.5)" strokeWidth="0.6" />
            <line x1="0" y1="-2" x2="0" y2="2" stroke="rgba(244,241,235,0.5)" strokeWidth="0.6" />
            <line x1="40" y1="-2" x2="40" y2="2" stroke="rgba(244,241,235,0.5)" strokeWidth="0.6" />
            <text x="20" y="-3" fill="rgba(244,241,235,0.5)" fontSize="4" fontFamily="JetBrains Mono" textAnchor="middle">
              {(extentMi * (40 / (VB - 12)) * 2).toFixed(0)} mi
            </text>
          </g>

          <g transform="translate(86, 86)">
            <circle r="6" fill="none" stroke="rgba(244,241,235,0.3)" strokeWidth="0.4" />
            <path d="M 0 -4 L 1.5 3 L 0 1.5 L -1.5 3 Z" fill="rgba(244,241,235,0.7)" />
            <text x="0" y="-7" fill="rgba(244,241,235,0.7)" fontSize="4" fontFamily="JetBrains Mono" textAnchor="middle">N</text>
          </g>
        </svg>
      </div>

      <div style={{ padding: "10px 14px 12px" }}>
        <div style={{ position: "relative", height: 22 }}>
          <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 2, background: "var(--hairline)" }} />
          <div style={{
            position: "absolute", top: 10, left: 0, height: 2,
            width: `${((dayFloat - 1) / (dayCount - 1)) * 100}%`,
            background: "linear-gradient(90deg, var(--fire-1), var(--fire-5))",
            transition: "width 90ms linear",
          }} />
          {frames.map((f, i) => {
            const active = i <= curIdx;
            const isCur = i === curIdx;
            return (
              <button
                key={i}
                onClick={() => onSimChange && onSimChange({ day: i + 1, playing: false })}
                style={{
                  position: "absolute", top: 5, left: `calc(${(i / (dayCount - 1)) * 100}% - 6px)`,
                  width: 12, height: 12, borderRadius: "50%",
                  background: isCur ? "var(--text-primary)" : (active ? "var(--fire-3)" : "var(--surface-2)"),
                  border: `1px solid ${active ? "var(--fire-5)" : "var(--hairline-strong)"}`,
                  cursor: "pointer", padding: 0,
                  transform: isCur ? "scale(1.15)" : "scale(1)",
                  transition: "transform 140ms var(--ease)",
                }}
                aria-label={`Day ${f.day}`}
              />
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            onClick={() => {
              if (curIdx >= dayCount - 1) onSimChange && onSimChange({ day: 1, playing: true });
              else onSimChange && onSimChange({ playing: !playing });
            }}
            style={{
              flex: 1, padding: "7px 10px",
              border: "1px solid var(--hairline-strong)",
              background: playing ? "var(--surface-2)" : "transparent",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {curIdx >= dayCount - 1 ? "↻ Replay" : playing ? "❚❚ Pause" : "▶ Play"}
          </button>
          <button
            onClick={() => onSimChange && onSimChange({ day: 1, playing: false })}
            style={{
              padding: "7px 10px",
              border: "1px solid var(--hairline)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-body)",
              fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            ⤺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}
