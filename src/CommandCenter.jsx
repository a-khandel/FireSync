// FireSync Command Center — top rail + left queue + main panel + right rail

import { useEffect, useState } from "react";
import CommandMap from "./CommandMap.jsx";
import { Caption, Mono, StatusDot, TimeAgo } from "./ui.jsx";
import { AGENT_LOG, BRIEF, FIRES, REASONING, severityColor } from "./data.js";

// ---- Incident queue rail ----
function IncidentQueueRail({ incidents, selectedId, onSelect }) {
  const [filter, setFilter] = useState("ALL");
  const filters = ["ALL", "EVAC", "MINE", "GROWING"];
  const filtered = incidents.filter((f) => {
    if (filter === "ALL") return true;
    if (filter === "EVAC") return f.evacOrderActive;
    if (filter === "MINE") return ["park-fire", "creek-2", "siskiyou", "front-range"].includes(f.id);
    if (filter === "GROWING") return (f.growth24hAcres || 0) > 1000;
    return true;
  });

  return (
    <aside style={{ width: 300, borderRight: "1px solid var(--hairline-strong)", display: "flex", flexDirection: "column", background: "var(--surface-1)", flexShrink: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--hairline)" }}>
        <Caption style={{ marginBottom: 12 }}>Incident Queue · {incidents.length}</Caption>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 8px",
                fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500,
                border: "1px solid " + (filter === f ? "var(--hairline-strong)" : "var(--hairline)"),
                background: filter === f ? "var(--surface-2)" : "transparent",
                color: filter === f ? "var(--text-primary)" : "var(--text-tertiary)",
                cursor: "pointer",
              }}
            >{f}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {filtered.map((f) => {
          const sel = f.id === selectedId;
          const color = severityColor(f.severity || 2);
          return (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "12px 16px",
                borderBottom: "1px solid var(--hairline)",
                background: sel ? "var(--surface-2)" : "transparent",
                borderLeft: sel ? "2px solid var(--info)" : "2px solid transparent",
                cursor: "pointer",
                transition: "background 120ms var(--ease)",
              }}
              onMouseEnter={(e) => !sel && (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              onMouseLeave={(e) => !sel && (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}
                  className={f.evacOrderActive ? "pulse" : ""}
                />
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.name.toUpperCase()}
                </span>
              </div>
              <Mono size={11} color="var(--text-tertiary)" style={{ display: "block", marginLeft: 16, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.jurisdiction} · {f.acres ? (f.acres / 1000).toFixed(1) + "k ac" : "—"} · {f.containmentPct ?? "—"}% cont
              </Mono>
              <div style={{ display: "flex", gap: 12, marginLeft: 16 }}>
                {(f.growth24hAcres || 0) > 1000 && (
                  <Mono size={10} color="var(--critical)" weight={500} style={{ letterSpacing: "0.08em" }}>▲ GROWING</Mono>
                )}
                {f.evacOrderActive && (
                  <Mono size={10} color="var(--critical)" weight={500} style={{ letterSpacing: "0.08em" }}>EVAC</Mono>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ---- Agent Log ----
function AgentLog({ log, onSelect, selectedIdx }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "12px 0" }}>
      {log.map((row, i) => {
        const sel = i === selectedIdx;
        const isCycle = row.type === "CYCLE_START";
        const typeColor = {
          DRAFT_EVAC_ORDER: "var(--critical)",
          ASSESS_ROAD_STATUS: "var(--warning)",
          FLAG_UNCERTAINTY: "var(--warning)",
          GENERATE_ALERT: "var(--critical)",
          INGEST: "var(--info)",
          COMPUTE_ROUTE: "var(--info)",
          BRIEF_AGENCY: "var(--safe)",
          CYCLE_START: "var(--text-tertiary)",
        }[row.type] || "var(--text-secondary)";
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 180px 1fr 60px",
              gap: 16,
              padding: "8px 24px",
              borderBottom: isCycle ? "1px solid var(--hairline-strong)" : "1px solid var(--hairline)",
              background: sel ? "var(--surface-2)" : "transparent",
              cursor: "pointer",
              alignItems: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              transition: "background 120ms var(--ease)",
            }}
            onMouseEnter={(e) => !sel && (e.currentTarget.style.background = "rgba(255,255,255,0.018)")}
            onMouseLeave={(e) => !sel && (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ color: "var(--text-tertiary)" }}>{row.t}</span>
            <span style={{ color: typeColor, letterSpacing: "0.04em" }}>{row.type}</span>
            <span style={{ color: "var(--text-primary)" }}>{row.target}</span>
            <span style={{ color: "var(--text-tertiary)", textAlign: "right", fontSize: 11 }}>VIEW →</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Reasoning trace with typewriter ----
function useTypewriter(text, speed = 14, key) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setOut(""); setDone(false);
    if (!text) { setDone(true); return; }
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      if (i >= text.length) { setOut(text); setDone(true); clearInterval(id); }
      else setOut(text.slice(0, i));
    }, speed);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, key]);
  return [out, done];
}

function ReasoningTrace({ trace, replayKey }) {
  const [reasoningText, reasoningDone] = useTypewriter(trace.reasoning, 14, replayKey);
  return (
    <div style={{ padding: "24px 32px", maxWidth: 920, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)" }}>
      <div style={{ marginBottom: 24 }}>
        <Caption style={{ color: "var(--text-tertiary)", marginBottom: 4 }}>── Decision ───────────────────────────────────────</Caption>
        <div style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 500, fontFamily: "var(--font-mono)", marginBottom: 6 }}>{trace.decision}</div>
        <div style={{ display: "flex", gap: 24, color: "var(--text-tertiary)", fontSize: 12 }}>
          <span>Issued {trace.issuedAt}</span>
          <span>Confidence <span style={{ color: trace.confidence > 0.8 ? "var(--safe)" : "var(--warning)" }}>{trace.confidence.toFixed(2)}</span></span>
        </div>
      </div>

      <Caption style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>── Inputs ─────────────────────────────────────────</Caption>
      <div style={{ marginBottom: 24 }}>
        {trace.inputs.map((inp, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 16, padding: "4px 0" }}>
            <span style={{ color: "var(--info)" }}>[{inp.src}]</span>
            <span style={{ color: "var(--text-secondary)" }}>{inp.obs}</span>
          </div>
        ))}
      </div>

      <Caption style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>── Reasoning ──────────────────────────────────────</Caption>
      <div style={{ marginBottom: 24, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
        {reasoningText}
        {!reasoningDone && <span className="caret" />}
      </div>

      {reasoningDone && (
        <>
          <Caption style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>── Tradeoffs Considered ───────────────────────────</Caption>
          <div style={{ marginBottom: 24 }}>
            {trace.tradeoffs.map((t, i) => (
              <div key={i} style={{ paddingLeft: 16, paddingBottom: 8, color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--text-tertiary)", marginRight: 8 }}>·</span>{t}
              </div>
            ))}
          </div>

          <Caption style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>── Uncertainty Flags ──────────────────────────────</Caption>
          <div style={{ marginBottom: 24 }}>
            {trace.uncertaintyFlags.map((f, i) => (
              <div key={i} style={{ paddingLeft: 16, paddingBottom: 4, color: "var(--warning)" }}>
                <span style={{ marginRight: 8 }}>△</span>{f}
              </div>
            ))}
          </div>

          <Caption style={{ color: "var(--text-tertiary)", marginBottom: 12 }}>── Action ─────────────────────────────────────────</Caption>
          <div style={{ display: "flex", gap: 8, animation: "fs-fade-in 400ms var(--ease) both" }}>
            <button style={{ padding: "10px 18px", border: "1px solid var(--critical)", background: "rgba(255,77,28,0.08)", color: "var(--critical)", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>[ Accept ]</button>
            <button style={{ padding: "10px 18px", border: "1px solid var(--hairline-strong)", background: "transparent", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>[ Edit ]</button>
            <button style={{ padding: "10px 18px", border: "1px solid var(--hairline-strong)", background: "transparent", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>[ Escalate to Manual ]</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Right rail ----
function LiveActionStream({ log }) {
  const top = log.slice(0, 6);
  return (
    <div style={{ borderBottom: "1px solid var(--hairline-strong)" }}>
      <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Caption>Live Action Stream</Caption>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusDot variant="safe" pulse size={6} />
          <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.08em" }}>STREAMING</Mono>
        </div>
      </div>
      <div>
        {top.map((row, i) => {
          const typeColor = {
            DRAFT_EVAC_ORDER: "var(--critical)",
            ASSESS_ROAD_STATUS: "var(--warning)",
            FLAG_UNCERTAINTY: "var(--warning)",
            GENERATE_ALERT: "var(--critical)",
            INGEST: "var(--info)",
            COMPUTE_ROUTE: "var(--info)",
            BRIEF_AGENCY: "var(--safe)",
            CYCLE_START: "var(--text-tertiary)",
          }[row.type] || "var(--text-secondary)";
          return (
            <div key={i} style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--hairline)",
              animation: i === 0 ? "fs-slide-top 380ms var(--ease) both" : undefined,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <Mono size={11} color="var(--text-tertiary)">{row.t}</Mono>
                <Mono size={11} color={typeColor} weight={500} style={{ letterSpacing: "0.04em" }}>{row.type}</Mono>
              </div>
              <Mono size={11} color="var(--text-secondary)">{row.target}</Mono>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultiAgencyBrief({ brief }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Caption>Multi-Agency Brief</Caption>
        <Mono size={10} color="var(--text-tertiary)">v 4.127</Mono>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22, lineHeight: 1.25, color: "var(--text-primary)", marginBottom: 12 }}>
        Park Fire Brief
      </div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.65, color: "var(--text-secondary)", margin: "0 0 16px", textWrap: "pretty" }}>{brief}</p>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(brief);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          style={{ padding: "8px 12px", border: "1px solid var(--hairline-strong)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500, cursor: "pointer", background: "transparent" }}
        >{copied ? "Copied" : "Copy"}</button>
        <button style={{ padding: "8px 12px", border: "1px solid var(--hairline-strong)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500, cursor: "pointer", background: "transparent" }}>Email</button>
        <button style={{ padding: "8px 12px", border: "1px solid var(--hairline)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500, cursor: "pointer", background: "transparent" }}>Translate</button>
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.08em" }}>RECIPIENTS</Mono>
          <Mono size={10} color="var(--text-secondary)">4 agencies</Mono>
        </div>
        <Mono size={11} color="var(--text-secondary)" style={{ display: "block", lineHeight: 1.6 }}>
          CalFire Butte · Tehama OES · Red Cross NorCal · NWS Sacramento
        </Mono>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.08em" }}>NEXT OP PERIOD</Mono>
          <Mono size={10} color="var(--text-secondary)">18:00 PDT</Mono>
        </div>
      </div>
    </div>
  );
}

// ---- Top rail ----
function TopRail({ cycle, lastRunMs, onClose }) {
  return (
    <header style={{
      height: 56, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
      borderBottom: "1px solid var(--hairline-strong)",
      background: "var(--surface-1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="display-md" style={{ fontStyle: "italic", color: "var(--text-primary)", fontSize: 22 }}>FIRESYNC</span>
          <span style={{ width: 1, height: 16, background: "var(--hairline-strong)" }} />
          <Caption style={{ color: "var(--text-secondary)" }}>Command</Caption>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid var(--hairline)", flex: "0 1 380px", minWidth: 220, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden" }}>
        <span style={{ fontSize: 13 }}>⌕</span>
        <Mono size={12} color="var(--text-tertiary)" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>Search incidents, zones, agencies…</Mono>
        <span style={{ border: "1px solid var(--hairline)", padding: "1px 4px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>⌘ K</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <StatusDot variant="info" pulse size={6} />
          <Mono size={11} color="var(--text-secondary)" style={{ letterSpacing: "0.08em" }}>CYCLE&nbsp;{cycle.toLocaleString()}</Mono>
          <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.06em" }}><TimeAgo from={lastRunMs} /></Mono>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--hairline-strong)" }} />
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap" }}>
          ← Public View
        </button>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--hairline-strong)", display: "grid", placeItems: "center", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>JC</div>
      </div>
    </header>
  );
}

// ---- Main panel ----
function MainPanel({ tab, onTab, fire, layers, onToggleLayer, selectedLogIdx, onSelectLogIdx, log }) {
  const tabs = [
    { id: "MAP", label: "Map" },
    { id: "LOG", label: "Agent Log" },
    { id: "REASON", label: "Reasoning" },
  ];

  return (
    <section style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: "16px 24px 12px", borderBottom: "1px solid var(--hairline-strong)", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0, gap: 24, flexWrap: "wrap" }}>
        <div style={{ minWidth: 240 }}>
          <Caption style={{ color: "var(--critical)", marginBottom: 4 }}>● EVAC ORDER ACTIVE</Caption>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span className="display-md" style={{ fontStyle: "italic", color: "var(--text-primary)", fontSize: 36, whiteSpace: "nowrap" }}>{fire.name}</span>
            <Mono size={11} color="var(--text-tertiary)" style={{ letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{fire.jurisdiction.toUpperCase()}</Mono>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "right" }}>
            <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>SIZE</Mono>
            <Mono size={16} color="var(--text-primary)" weight={500}>{fire.acres.toLocaleString()}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>ac</span></Mono>
          </div>
          <div style={{ textAlign: "right" }}>
            <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>CONTAINED</Mono>
            <Mono size={16} color="var(--critical)" weight={500}>{fire.containmentPct}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>%</span></Mono>
          </div>
          <div style={{ textAlign: "right" }}>
            <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>GROWTH 24H</Mono>
            <Mono size={16} color="var(--critical)" weight={500}>↑{fire.growth24hAcres.toLocaleString()}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>ac</span></Mono>
          </div>
          <div style={{ textAlign: "right" }}>
            <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>WIND</Mono>
            <Mono size={16} color="var(--text-primary)" weight={500}>{fire.windMph}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>{fire.windDirFrom}→{fire.windDirTo}</span></Mono>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid var(--hairline)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              style={{
                padding: "12px 18px",
                fontFamily: "var(--font-body)",
                fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
                color: tab === t.id ? "var(--text-primary)" : "var(--text-tertiary)",
                borderBottom: "2px solid " + (tab === t.id ? "var(--info)" : "transparent"),
                marginBottom: -1,
                cursor: "pointer", background: "transparent",
              }}
            >{t.label}</button>
          ))}
        </div>
        {tab === "MAP" && (
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(layers).map(([k, v]) => (
              <button
                key={k}
                onClick={() => onToggleLayer(k)}
                style={{
                  padding: "4px 8px",
                  fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
                  border: "1px solid " + (v.on ? "var(--hairline-strong)" : "var(--hairline)"),
                  background: v.on ? "var(--surface-2)" : "transparent",
                  color: v.on ? "var(--text-primary)" : "var(--text-tertiary)",
                  cursor: "pointer",
                }}
              >{v.label}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {tab === "MAP" && <CommandMap layers={Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.on]))} />}
        {tab === "LOG" && <AgentLog log={log} onSelect={onSelectLogIdx} selectedIdx={selectedLogIdx} />}
        {tab === "REASON" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <ReasoningTrace trace={REASONING} replayKey={selectedLogIdx} />
          </div>
        )}
      </div>
    </section>
  );
}

// ---- Command Center root ----
export default function CommandCenter({ onClose }) {
  const [selectedId, setSelectedId] = useState("park-fire");
  const [tab, setTab] = useState("MAP");
  const [selectedLogIdx, setSelectedLogIdx] = useState(0);
  const [cycle, setCycle] = useState(4127);
  const [lastRun] = useState(Date.now() - 167_000);
  const [layers, setLayers] = useState({
    perimeter: { label: "Perimeter", on: true },
    evac: { label: "Evac Zones", on: true },
    wind: { label: "Wind", on: true },
    shelters: { label: "Shelters", on: true },
    hotspots: { label: "Hotspots", on: true },
    pop: { label: "Population", on: true },
  });

  const fire = FIRES.find((f) => f.id === selectedId) || FIRES[0];
  const log = AGENT_LOG;

  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const onSelectLogIdx = (i) => {
    setSelectedLogIdx(i);
    const t = log[i].type;
    if (t === "DRAFT_EVAC_ORDER" || t === "GENERATE_ALERT" || t === "COMPUTE_ROUTE") setTab("REASON");
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)", minWidth: 1200, overflowX: "auto" }}>
      <TopRail cycle={cycle} lastRunMs={lastRun} onClose={onClose} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <IncidentQueueRail incidents={FIRES} selectedId={selectedId} onSelect={setSelectedId} />
        <MainPanel
          tab={tab}
          onTab={setTab}
          fire={fire}
          layers={layers}
          onToggleLayer={(k) => setLayers((l) => ({ ...l, [k]: { ...l[k], on: !l[k].on } }))}
          selectedLogIdx={selectedLogIdx}
          onSelectLogIdx={onSelectLogIdx}
          log={log}
        />
        <aside style={{ width: 360, flexShrink: 0, borderLeft: "1px solid var(--hairline-strong)", background: "var(--surface-1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: "0 0 auto", maxHeight: "55%", overflowY: "auto" }}>
            <LiveActionStream log={log} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <MultiAgencyBrief brief={BRIEF} />
          </div>
        </aside>
      </div>
    </div>
  );
}
