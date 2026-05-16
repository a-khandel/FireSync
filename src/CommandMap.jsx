// Stylized 2D operational map (SVG) for the command center MAP tab.

import { Mono } from "./ui.jsx";
import { FIRES } from "./data.js";

export default function CommandMap({ layers }) {
  const W = 1200, H = 720;

  const perimeter = "M 540 280 L 600 250 L 680 245 L 740 270 L 800 305 L 830 360 L 815 420 L 770 470 L 700 495 L 620 500 L 540 475 L 480 430 L 460 370 L 480 310 Z";
  const perimeterYesterday = "M 575 305 L 640 285 L 705 290 L 760 320 L 785 365 L 770 415 L 720 450 L 660 460 L 590 450 L 540 415 L 525 365 L 545 320 Z";
  const zone1A = "M 620 250 L 740 245 L 770 305 L 720 340 L 650 335 L 615 295 Z";
  const zone1B = "M 770 305 L 830 320 L 855 380 L 825 425 L 765 415 L 760 360 Z";
  const zone2 = "M 460 200 L 605 195 L 615 295 L 480 310 Z";

  const roads = [
    { id: "ca-32", path: "M 350 220 L 460 270 L 540 320 L 620 360 L 720 380 L 820 400", status: "CLOSED", label: "CA-32" },
    { id: "ca-99", path: "M 200 580 L 360 560 L 540 550 L 720 540 L 900 530", status: "OPEN", label: "CA-99" },
    { id: "garland", path: "M 540 320 L 580 380 L 600 460 L 580 540 L 540 600", status: "DEGRADED", label: "Garland Rd" },
    { id: "hwy-36", path: "M 100 340 L 280 360 L 420 370 L 540 365", status: "DEGRADED", label: "Hwy 36" },
    { id: "skyway", path: "M 900 480 L 880 540 L 850 600 L 800 660", status: "OPEN", label: "Skyway" },
  ];

  const hotspots = FIRES[0].hotspots || [];
  const center = { lat: 39.96, lng: -121.78, x: 640, y: 380, scale: 950 };
  function project(lat, lng) {
    return { x: center.x + (lng - center.lng) * center.scale, y: center.y - (lat - center.lat) * center.scale };
  }

  const shelters = [
    { id: "silver-dollar", name: "Silver Dollar Fairgrounds", x: 200, y: 540, occ: 0.64 },
    { id: "glenn-co", name: "Glenn County FG", x: 140, y: 660, occ: 0.15 },
  ];

  const resources = [
    { id: "e21", type: "ENGINE_T1", label: "E-21", x: 555, y: 530, status: "ASSIGNED" },
    { id: "e22", type: "ENGINE_T1", label: "E-22", x: 605, y: 535, status: "ASSIGNED" },
    { id: "e07", type: "ENGINE_T3", label: "E-07", x: 460, y: 360, status: "EN_ROUTE" },
    { id: "h01", type: "HELI", label: "H-01", x: 720, y: 220, status: "ON_SCENE" },
    { id: "t02", type: "TANKER", label: "T-02", x: 820, y: 200, status: "STAGED" },
    { id: "c01", type: "HAND_CREW", label: "C-01", x: 490, y: 460, status: "ON_SCENE" },
  ];

  const windArrows = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 9; c++) {
      windArrows.push({ x: 200 + c * 110, y: 120 + r * 110, angle: -38 });
    }
  }

  const popCells = [];
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 20; c++) {
      const x = c * 60, y = r * 60;
      const d1 = Math.hypot(x - 200, y - 540);
      const d2 = Math.hypot(x - 640, y - 380);
      const d3 = Math.hypot(x - 900, y - 480);
      const v = Math.max(0, 1 - Math.min(d1, d2, d3) / 280);
      if (v > 0.15) popCells.push({ x, y, v });
    }
  }

  const roadColor = (s) => ({ OPEN: "#6FCF8E", DEGRADED: "#FFB23F", CLOSED: "#FF4D1C" }[s]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0c1014" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <pattern id="hashOrder" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#FF4D1C" strokeWidth="1.4" opacity="0.55" />
          </pattern>
          <pattern id="dotsWarn" patternUnits="userSpaceOnUse" width="8" height="8">
            <circle cx="3" cy="3" r="1.2" fill="#FFB23F" opacity="0.6" />
          </pattern>
          <linearGradient id="firePerim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF6F2C" stopOpacity="0.45" />
            <stop offset="1" stopColor="#C82400" stopOpacity="0.7" />
          </linearGradient>
          <radialGradient id="hot">
            <stop offset="0" stopColor="#FFD66B" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FF3D14" stopOpacity="0" />
          </radialGradient>
          <pattern id="grid" patternUnits="userSpaceOnUse" width="60" height="60">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1c2026" strokeWidth="0.6" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="#0e1218" />
        <rect x="0" y="0" width={W} height={H} fill="url(#grid)" />

        <g opacity="0.25">
          <ellipse cx="240" cy="160" rx="160" ry="60" fill="#1b2026" />
          <ellipse cx="980" cy="200" rx="180" ry="70" fill="#1b2026" />
          <ellipse cx="900" cy="600" rx="220" ry="80" fill="#1b2026" />
          <ellipse cx="180" cy="440" rx="140" ry="50" fill="#1b2026" />
        </g>

        {popCells.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={60} height={60} fill="#5EEAD4" opacity={p.v * 0.06} />
        ))}

        {layers.wind && windArrows.map((a, i) => (
          <g key={i} transform={`translate(${a.x}, ${a.y}) rotate(${a.angle})`} opacity="0.5">
            <line x1="-12" y1="0" x2="12" y2="0" stroke="#5EEAD4" strokeWidth="1" />
            <line x1="8" y1="-3" x2="12" y2="0" stroke="#5EEAD4" strokeWidth="1" />
            <line x1="8" y1="3" x2="12" y2="0" stroke="#5EEAD4" strokeWidth="1" />
            <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3s" repeatCount="indefinite" begin={`${(i % 6) * 0.25}s`} />
          </g>
        ))}

        {layers.evac && (
          <g>
            <path d={zone1A} fill="url(#hashOrder)" stroke="#FF4D1C" strokeWidth="1" />
            <path d={zone1B} fill="url(#hashOrder)" stroke="#FF4D1C" strokeWidth="1" />
            <path d={zone2} fill="url(#dotsWarn)" stroke="#FFB23F" strokeWidth="1" strokeDasharray="3 3" />
            <text x="680" y="293" fill="#FF4D1C" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="0.08em">ZONE 1A · ORDER</text>
            <text x="800" y="365" fill="#FF4D1C" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="0.08em">ZONE 1B · ORDER</text>
            <text x="500" y="245" fill="#FFB23F" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="0.08em">ZONE 2 · WARNING</text>
          </g>
        )}

        {layers.perimeter && (
          <>
            <path d={perimeterYesterday} fill="none" stroke="#6B6660" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
            <path d={perimeter} fill="url(#firePerim)" stroke="#FF3D14" strokeWidth="1.5" />
          </>
        )}

        {hotspots.map((h, i) => {
          const p = project(h.lat, h.lng);
          const r = 4 + (h.frp / 60) * 8;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={r * 2} fill="url(#hot)" />
              <circle cx={p.x} cy={p.y} r={2} fill="#FFD66B" />
            </g>
          );
        })}

        {roads.map((r) => (
          <g key={r.id}>
            <path d={r.path} fill="none" stroke={roadColor(r.status)} strokeWidth="2.4" strokeDasharray={r.status === "DEGRADED" ? "8 4" : "0"} opacity="0.9" />
          </g>
        ))}

        {resources.map((r) => {
          const glyph = ({
            ENGINE_T1: "▲", ENGINE_T3: "△", TANKER: "■", HELI: "◆", HAND_CREW: "●", DOZER: "▼",
          })[r.type] || "●";
          return (
            <g key={r.id} transform={`translate(${r.x}, ${r.y})`}>
              <rect x="-22" y="-12" width="44" height="22" fill="#131210" stroke="#3A3530" strokeWidth="1" />
              <text x="0" y="3" fill="#5EEAD4" fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">{glyph} {r.label}</text>
            </g>
          );
        })}

        {layers.shelters !== false && shelters.map((s) => (
          <g key={s.id} transform={`translate(${s.x}, ${s.y})`}>
            <rect x="-6" y="-6" width="12" height="12" fill="#6FCF8E" />
            <text x="14" y="3" fill="#F4F1EB" fontSize="11" fontFamily="JetBrains Mono">{s.name}</text>
            <text x="14" y="16" fill="#A8A29A" fontSize="9" fontFamily="JetBrains Mono">{Math.round(s.occ * 100)}% capacity</text>
          </g>
        ))}

        <g transform="translate(80, 100)">
          <circle cx="0" cy="0" r="20" fill="none" stroke="#3A3530" strokeWidth="1" />
          <line x1="0" y1="-16" x2="0" y2="16" stroke="#3A3530" />
          <line x1="-16" y1="0" x2="16" y2="0" stroke="#3A3530" />
          <text x="0" y="-22" fill="#A8A29A" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">N</text>
        </g>

        <text x="1120" y="40" fill="#6B6660" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="0.12em" textAnchor="end">PARK FIRE · TEHAMA CO · CA</text>
        <text x="1120" y="58" fill="#6B6660" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="0.08em" textAnchor="end">39.96°N · 121.78°W</text>

        <g transform="translate(80, 660)">
          <line x1="0" y1="0" x2="80" y2="0" stroke="#A8A29A" strokeWidth="1.5" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#A8A29A" strokeWidth="1.5" />
          <line x1="80" y1="-4" x2="80" y2="4" stroke="#A8A29A" strokeWidth="1.5" />
          <text x="0" y="20" fill="#A8A29A" fontSize="10" fontFamily="JetBrains Mono">0</text>
          <text x="80" y="20" fill="#A8A29A" fontSize="10" fontFamily="JetBrains Mono" textAnchor="middle">5 mi</text>
        </g>
      </svg>

      <div style={{
        position: "absolute", bottom: 16, right: 16,
        background: "rgba(19,18,16,0.86)", border: "1px solid var(--hairline-strong)",
        padding: "10px 14px", minWidth: 240,
      }}>
        <div className="caption" style={{ color: "var(--text-tertiary)", marginBottom: 6 }}>Selection</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <Mono size={11} color="var(--text-secondary)">Distance</Mono>
          <Mono size={11} color="var(--text-primary)" weight={500}>—</Mono>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <Mono size={11} color="var(--text-secondary)">Area</Mono>
          <Mono size={11} color="var(--text-primary)" weight={500}>429,600 ac</Mono>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <Mono size={11} color="var(--text-secondary)">Population</Mono>
          <Mono size={11} color="var(--text-primary)" weight={500}>18,490</Mono>
        </div>
      </div>
    </div>
  );
}
