// FireSync Command Center — top rail + left queue + main panel + right rail

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Caption, Mono, StatusDot, TimeAgo } from "./ui.jsx";
import { AGENT_LOG, BRIEF, FIRES, REASONING, severityColor } from "./data.js";
import { clearAuth } from "./auth.js";
import { fetchScanLogs, compileScanLogs, fetchIncidentReports } from "./scanApi.js";

// ---- Incident queue rail ----
function IncidentQueueRail({ incidents, selectedId, onSelect }) {
  const [filter, setFilter] = useState("ALL");
  const filters = ["ALL", "EVAC", "MINE", "GROWING"];
  const filtered = incidents.filter((f) => {
    if (filter === "ALL") return true;
    if (filter === "EVAC") return f.evacOrderActive;
    if (filter === "MINE") return f.severity >= 4 || (f.maxFrp || 0) > 200;
    if (filter === "GROWING") return (f.growth24hAcres || 0) > 1000 || (f.hotspotCount || 0) >= 2;
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
                {row.createdAtMs && (
                  <Mono size={10} color="var(--text-tertiary)" style={{ marginLeft: "auto" }}>
                    <TimeAgo from={row.createdAtMs} /> ago
                  </Mono>
                )}
              </div>
              <Mono size={11} color="var(--text-secondary)">{row.target}</Mono>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultiAgencyBrief({ brief, fire }) {
  const [copied, setCopied] = useState(false);
  const title = fire?.name ? `${fire.name} Brief` : "Incident Brief";
  const recipients = fire?.draftComms?.map((c) => c.to) || [];
  const recipientLabel = recipients.length > 0 ? `${recipients.length} agencies` : "4 agencies";
  const recipientNames = recipients.length > 0
    ? recipients.join(" · ")
    : "CalFire Butte · Tehama OES · Red Cross NorCal · NWS Sacramento";
  const modelVersion = fire?.model ? fire.model.split("/").pop() : "v 4.127";

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Caption>Multi-Agency Brief</Caption>
        <Mono size={10} color="var(--text-tertiary)">{modelVersion}</Mono>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22, lineHeight: 1.25, color: "var(--text-primary)", marginBottom: 12 }}>
        {title}
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
          <Mono size={10} color="var(--text-secondary)">{recipientLabel}</Mono>
        </div>
        <Mono size={11} color="var(--text-secondary)" style={{ display: "block", lineHeight: 1.6 }}>
          {recipientNames}
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
function TopRail({ cycle, lastRunMs, onClose, onLogout }) {
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
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--critical)", fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap" }}>
          Logout
        </button>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--hairline-strong)", display: "grid", placeItems: "center", fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>JC</div>
      </div>
    </header>
  );
}

// ---- Main panel ----
function MainPanel({ fire }) {
  const [tab, setTab] = useState("TIMELINE");
  const tabs = [
    { id: "TIMELINE", label: "Agent Log" },
    { id: "COMMS", label: "Draft Comms" },
    { id: "REPORTS", label: "Previous Reports" },
  ];

  return (
    <section style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden", minWidth: 0 }}>
      {/* Incident header */}
      <div style={{ padding: "16px 24px 12px", borderBottom: "1px solid var(--hairline-strong)", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0, gap: 24, flexWrap: "wrap" }}>
        <div style={{ minWidth: 240 }}>
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
          {fire.hotspotCount != null ? (
            <>
              <div style={{ textAlign: "right" }}>
                <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>HOTSPOTS</Mono>
                <Mono size={16} color="var(--critical)" weight={500}>{fire.hotspotCount}</Mono>
              </div>
              <div style={{ textAlign: "right" }}>
                <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>MAX FRP</Mono>
                <Mono size={16} color="var(--critical)" weight={500}>{Math.round(fire.maxFrp)}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>MW</span></Mono>
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: "right" }}>
                <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>CONTAINED</Mono>
                <Mono size={16} color="var(--critical)" weight={500}>{fire.containmentPct}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>%</span></Mono>
              </div>
              <div style={{ textAlign: "right" }}>
                <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>GROWTH 24H</Mono>
                <Mono size={16} color="var(--critical)" weight={500}>↑{(fire.growth24hAcres || 0).toLocaleString()}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>ac</span></Mono>
              </div>
            </>
          )}
          <div style={{ textAlign: "right" }}>
            <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>WIND</Mono>
            <Mono size={16} color="var(--text-primary)" weight={500}>{fire.windMph}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>{fire.windDirFrom}{fire.windDirTo ? `→${fire.windDirTo}` : ""}</span></Mono>
          </div>
          {fire.temperature != null && (
            <div style={{ textAlign: "right" }}>
              <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>TEMP</Mono>
              <Mono size={16} color="var(--text-primary)" weight={500}>{fire.temperature}<span style={{ color: "var(--text-tertiary)", marginLeft: 4, fontSize: 11 }}>°F</span></Mono>
            </div>
          )}
          {fire.weatherSummary && (
            <div style={{ textAlign: "right" }}>
              <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em" }}>CONDITIONS</Mono>
              <Mono size={11} color="var(--text-primary)" weight={500}>{fire.weatherSummary}</Mono>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 24px", borderBottom: "1px solid var(--hairline-strong)", flexShrink: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "12px 20px",
              fontFamily: "var(--font-body)",
              fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-tertiary)",
              borderBottom: "2px solid " + (tab === t.id ? "var(--info)" : "transparent"),
              marginBottom: -1,
              cursor: "pointer", background: "transparent",
            }}
          >{t.label}</button>
        ))}
        {tab === "TIMELINE" && fire.timeline && (
          <Mono size={10} color="var(--text-tertiary)" style={{ marginLeft: "auto", letterSpacing: "0.08em" }}>
            {fire.timeline.length} SCAN{fire.timeline.length !== 1 ? "S" : ""} · OLDEST FIRST
          </Mono>
        )}
        {tab === "COMMS" && fire.draftComms?.length > 0 && (
          <Mono size={10} color="var(--text-tertiary)" style={{ marginLeft: "auto", letterSpacing: "0.08em" }}>
            FROM LATEST SCAN
          </Mono>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "TIMELINE" && <TimelineTab fire={fire} />}
        {tab === "COMMS" && <DraftCommsTab fire={fire} />}
        {tab === "REPORTS" && <PreviousReportsTab />}
      </div>
    </section>
  );
}

// ---- Timeline tab: all scans oldest→newest as long compiled log ----
function TimelineTab({ fire }) {
  const entries = fire.timeline || [];
  const isMock = entries.length === 0;

  if (isMock) {
    return (
      <div style={{ height: "100%", overflowY: "auto" }}>
        <ReasoningTrace trace={REASONING} replayKey={fire?.id} />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 40px" }}>
      {entries.map((entry, idx) => (
        <TimelineEntry key={entry.scanId} entry={entry} isLatest={idx === entries.length - 1} />
      ))}
    </div>
  );
}

function TimelineEntry({ entry, isLatest }) {
  const [expanded, setExpanded] = useState(true);
  const ts = entry.createdAt
    ? new Date(entry.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    : entry.scanTimestamp || "—";
  const trendColor = entry.frpTrend === "INCREASING" ? "var(--critical)" : entry.frpTrend === "DECREASING" ? "var(--safe)" : "var(--text-tertiary)";

  return (
    <div style={{ borderBottom: "1px solid var(--hairline-strong)" }}>
      {/* Entry header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%", textAlign: "left", padding: "14px 32px",
          display: "flex", alignItems: "center", gap: 20,
          background: isLatest ? "rgba(255,255,255,0.03)" : "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 12,
        }}
      >
        <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.06em", flexShrink: 0 }}>
          #{entry.entryNum}
        </Mono>
        <Mono size={11} color="var(--text-secondary)" style={{ flexShrink: 0 }}>{ts}</Mono>
        {entry.createdAt && (
          <Mono size={10} color="var(--text-tertiary)" style={{ flexShrink: 0 }}>
            <TimeAgo from={new Date(entry.createdAt).getTime()} /> ago
          </Mono>
        )}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", flex: 1 }}>
          {entry.hotspotCount != null && (
            <span style={{ color: "var(--critical)" }}>{entry.hotspotCount} hotspot{entry.hotspotCount !== 1 ? "s" : ""}</span>
          )}
          {entry.maxFrp != null && (
            <span style={{ color: "var(--critical)" }}>{Math.round(entry.maxFrp)} MW max FRP</span>
          )}
          {entry.frpTrend && (
            <span style={{ color: trendColor }}>{entry.frpTrend}</span>
          )}
          {entry.frpDelta != null && Math.abs(entry.frpDelta) > 0 && (
            <span style={{ color: "var(--warning)" }}>Δ {entry.frpDelta > 0 ? "+" : ""}{Math.round(entry.frpDelta)} MW</span>
          )}
          {entry.totalAreaKm2 != null && (
            <span style={{ color: "var(--text-tertiary)" }}>{Math.round(entry.totalAreaKm2 * 247.105).toLocaleString()} ac</span>
          )}
          {entry.temperature != null && (
            <span style={{ color: "var(--text-tertiary)" }}>{entry.temperature}°F</span>
          )}
          {entry.windSpeed && (
            <span style={{ color: "var(--text-tertiary)" }}>{entry.windDirection} {entry.windSpeed}</span>
          )}
        </div>
        {isLatest && (
          <Mono size={9} color="var(--safe)" style={{ letterSpacing: "0.1em", flexShrink: 0 }}>LATEST</Mono>
        )}
        <span style={{ color: "var(--text-tertiary)", fontSize: 10, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: "0 32px 24px", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.75 }}>
          {/* NemoClaw brief */}
          {entry.brief && (
            <div style={{ marginBottom: 20 }}>
              <Caption style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>── NemoClaw Assessment</Caption>
              <div style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{entry.brief}</div>
            </div>
          )}

          {/* Hotspot table */}
          {entry.hotspots?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Caption style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>── Hotspots ({entry.hotspots.length})</Caption>
              <div style={{ display: "grid", gridTemplateColumns: "24px 180px 90px 90px 80px", gap: "6px 16px" }}>
                <Mono size={10} color="var(--text-tertiary)">#</Mono>
                <Mono size={10} color="var(--text-tertiary)">COORDINATES</Mono>
                <Mono size={10} color="var(--text-tertiary)">FRP (MW)</Mono>
                <Mono size={10} color="var(--text-tertiary)">AREA</Mono>
                <Mono size={10} color="var(--text-tertiary)">CONF</Mono>
                {entry.hotspots.map((h, i) => (
                  <>
                    <span key={`n-${i}`} style={{ color: "var(--text-tertiary)" }}>{i + 1}</span>
                    <span key={`c-${i}`} style={{ color: "var(--text-secondary)" }}>
                      {h.lat?.toFixed(4)}°N, {Math.abs(h.lon ?? h.lng)?.toFixed(4)}°W
                    </span>
                    <span key={`f-${i}`} style={{ color: "var(--critical)" }}>{(h.frp_mw ?? h.frp)?.toFixed(1)}</span>
                    <span key={`a-${i}`} style={{ color: "var(--text-tertiary)" }}>{h.area_km2 != null ? `${h.area_km2} km²` : "—"}</span>
                    <span key={`k-${i}`} style={{ color: "var(--text-tertiary)" }}>{h.conf_code ?? "—"}</span>
                  </>
                ))}
              </div>
            </div>
          )}

          {entry.model && (
            <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", marginTop: 8 }}>MODEL: {entry.model}</Mono>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Previous reports tab ----
function PreviousReportsTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [fetched, setFetched] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncidentReports(30);
      setReports(data);
      setFetched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const trendColor = (t) =>
    t === "INCREASING" ? "var(--critical)" : t === "DECREASING" ? "var(--safe)" : "var(--text-tertiary)";

  const typeBadgeColor = (t) =>
    t === "full" ? "var(--info)" : "var(--text-tertiary)";

  return (
    <div style={{ padding: "24px 32px 40px", maxWidth: 960 }}>
      {/* Fetch button */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button
          onClick={handleFetch}
          disabled={loading}
          style={{
            padding: "9px 20px",
            border: "1px solid var(--info)",
            background: "rgba(100,180,255,0.07)",
            color: loading ? "var(--text-tertiary)" : "var(--info)",
            fontFamily: "var(--font-body)",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: loading ? "default" : "pointer",
            transition: "all 120ms var(--ease)",
          }}
        >
          {loading ? "Fetching…" : fetched ? "[ Refresh Reports ]" : "[ Fetch Previous Reports ]"}
        </button>
        {fetched && !loading && (
          <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.08em" }}>
            {reports.length} REPORT{reports.length !== 1 ? "S" : ""} · LATEST FIRST
          </Mono>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", border: "1px solid var(--critical)", color: "var(--critical)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          ERROR: {error}
        </div>
      )}

      {/* Empty state */}
      {fetched && !loading && reports.length === 0 && !error && (
        <div style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          No reports found in incident_reports table.
        </div>
      )}

      {/* Report cards */}
      {reports.map((r) => {
        const isOpen = !!expanded[r.id];
        const ts = r.scan_timestamp
          ? new Date(r.scan_timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
          : r.created_at
            ? new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
            : "—";

        return (
          <div
            key={r.id}
            style={{ marginBottom: 12, border: "1px solid var(--hairline-strong)", background: "var(--surface-1)" }}
          >
            {/* Card header */}
            <button
              onClick={() => toggle(r.id)}
              style={{
                width: "100%", textAlign: "left", padding: "14px 20px",
                display: "flex", alignItems: "center", gap: 16,
                cursor: "pointer", background: "transparent",
                fontFamily: "var(--font-mono)", fontSize: 12,
              }}
            >
              <Mono size={10} color="var(--text-tertiary)" style={{ flexShrink: 0 }}>#{r.id}</Mono>
              <Mono
                size={9}
                color={typeBadgeColor(r.report_type)}
                style={{ border: `1px solid ${typeBadgeColor(r.report_type)}`, padding: "1px 5px", letterSpacing: "0.08em", flexShrink: 0 }}
              >
                {(r.report_type || "?").toUpperCase()}
              </Mono>
              <Mono size={11} color="var(--text-secondary)" style={{ flexShrink: 0 }}>{ts}</Mono>
              <div style={{ display: "flex", gap: 18, flex: 1, flexWrap: "wrap" }}>
                {r.hotspot_count != null && (
                  <span style={{ color: "var(--critical)" }}>{r.hotspot_count} hotspot{r.hotspot_count !== 1 ? "s" : ""}</span>
                )}
                {r.max_frp_mw != null && (
                  <span style={{ color: "var(--critical)" }}>{Math.round(r.max_frp_mw)} MW</span>
                )}
                {r.total_area_km2 != null && (
                  <span style={{ color: "var(--text-tertiary)" }}>{Math.round(r.total_area_km2 * 247.105).toLocaleString()} ac</span>
                )}
                {r.wind_summary && (
                  <span style={{ color: "var(--text-tertiary)" }}>{r.wind_summary}</span>
                )}
                {r.frp_trend && (
                  <span style={{ color: trendColor(r.frp_trend) }}>{r.frp_trend.replace(/_/g, " ")}</span>
                )}
              </div>
              <Mono size={10} color="var(--text-tertiary)" style={{ flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</Mono>
            </button>

            {/* Document body */}
            {isOpen && (
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--hairline)" }}>
                {/* Quick stats row */}
                <div style={{ display: "flex", gap: 24, padding: "12px 0 16px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)", marginBottom: 16 }}>
                  {r.centroid_lat != null && (
                    <span>CENTROID: {r.centroid_lat.toFixed(4)}°N, {Math.abs(r.centroid_lon).toFixed(4)}°W</span>
                  )}
                  {r.model_used && (
                    <span>MODEL: {r.model_used.split("/").pop()}</span>
                  )}
                  {r.created_at && (
                    <span>GENERATED: {new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                  )}
                </div>

                {/* Document text */}
                {r.document ? (
                  <div style={{
                    fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.75,
                    color: "var(--text-secondary)", whiteSpace: "pre-wrap",
                    maxHeight: 500, overflowY: "auto",
                    padding: "4px 0",
                  }}>
                    {r.document}
                  </div>
                ) : (
                  <Mono size={11} color="var(--text-tertiary)">No document content.</Mono>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Draft comms tab ----
const REPORT_API = "http://169.233.156.76:8000/api/reports";

function DraftCommsTab({ fire }) {
  const comms = fire.draftComms || [];
  const [states, setStates] = useState({});

  if (comms.length === 0) {
    return (
      <div style={{ padding: "48px 32px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>
        No draft communications in the latest scan.
      </div>
    );
  }

  const priorityColor = (p) =>
    p === "CRITICAL" ? "var(--critical)" : p === "HIGH" ? "var(--warning)" : "var(--text-tertiary)";

  const setState = (idx, patch) =>
    setStates((s) => ({ ...s, [idx]: { ...(s[idx] || {}), ...patch } }));

  const handleSubmit = async (idx) => {
    setState(idx, { loading: true, error: null });
    try {
      const res = await fetch(`${REPORT_API}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comms[idx]),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const { report_id, document } = await res.json();
      setState(idx, { loading: false, report_id, document });
    } catch (err) {
      setState(idx, { loading: false, error: err.message });
    }
  };

  const handleFetch = async (idx) => {
    const { report_id } = states[idx] || {};
    if (!report_id) return;
    setState(idx, { fetching: true, error: null });
    try {
      const report = await fetch(`${REPORT_API}/${report_id}`).then((r) => {
        if (!r.ok) throw new Error(`Fetch failed ${r.status}`);
        return r.json();
      });
      setState(idx, { fetching: false, document: report.document ?? JSON.stringify(report, null, 2) });
    } catch (err) {
      setState(idx, { fetching: false, error: err.message });
    }
  };

  return (
    <div style={{ padding: "24px 32px 40px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      {comms.map((c, idx) => {
        const s = states[idx] || {};
        const isDone = !!s.report_id;
        const isLoading = !!s.loading;

        return (
          <div
            key={idx}
            style={{
              border: `1px solid ${isDone ? "var(--hairline-strong)" : "var(--hairline-strong)"}`,
              background: "var(--surface-1)",
              padding: "20px 24px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Mono
                size={10}
                color={priorityColor(c.priority)}
                weight={700}
                style={{ letterSpacing: "0.1em", border: `1px solid ${priorityColor(c.priority)}`, padding: "2px 6px" }}
              >
                {c.priority}
              </Mono>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                → {c.to}
              </span>
              {isDone && (
                <Mono size={10} color="var(--safe)" style={{ marginLeft: "auto", letterSpacing: "0.08em" }}>✓ SUBMITTED</Mono>
              )}
              {isLoading && (
                <Mono size={10} color="var(--text-tertiary)" style={{ marginLeft: "auto", letterSpacing: "0.08em" }}>GENERATING…</Mono>
              )}
            </div>

            {/* Message body */}
            <div style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 16, whiteSpace: "pre-wrap" }}>
              {c.message}
            </div>

            {/* Report output */}
            {isDone && (
              <div style={{ marginBottom: 16, padding: "14px 16px", background: "var(--bg)", border: "1px solid var(--hairline)", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.65 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Mono size={10} color="var(--text-tertiary)" style={{ letterSpacing: "0.08em" }}>REPORT ID</Mono>
                  <Mono size={10} color="var(--info)">{s.report_id}</Mono>
                </div>
                {s.document && (
                  <>
                    <Mono size={10} color="var(--text-tertiary)" style={{ display: "block", letterSpacing: "0.08em", marginBottom: 6 }}>DOCUMENT</Mono>
                    <div style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}>
                      {typeof s.document === "string" ? s.document : JSON.stringify(s.document, null, 2)}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Error */}
            {s.error && (
              <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid var(--critical)", color: "var(--critical)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                ERROR: {s.error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handleSubmit(idx)}
                disabled={isDone || isLoading}
                style={{
                  padding: "8px 18px",
                  border: (isDone || isLoading) ? "1px solid var(--hairline)" : "1px solid var(--safe)",
                  background: (isDone || isLoading) ? "transparent" : "rgba(0,200,100,0.08)",
                  color: (isDone || isLoading) ? "var(--text-tertiary)" : "var(--safe)",
                  fontFamily: "var(--font-body)",
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: (isDone || isLoading) ? "default" : "pointer",
                  transition: "all 120ms var(--ease)",
                }}
              >
                {isLoading ? "Generating…" : isDone ? "Submitted" : "[ Submit ]"}
              </button>
              {isDone && (
                <button
                  onClick={() => handleFetch(idx)}
                  disabled={s.fetching}
                  style={{
                    padding: "8px 18px",
                    border: "1px solid var(--info)",
                    background: "rgba(100,180,255,0.06)",
                    color: s.fetching ? "var(--text-tertiary)" : "var(--info)",
                    fontFamily: "var(--font-body)",
                    fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
                    cursor: s.fetching ? "default" : "pointer",
                    transition: "all 120ms var(--ease)",
                  }}
                >
                  {s.fetching ? "Fetching…" : "[ Refresh Report ]"}
                </button>
              )}
              {!isDone && (
                <button
                  style={{
                    padding: "8px 18px",
                    border: "1px solid var(--hairline)",
                    background: "transparent",
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-body)",
                    fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Discard
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SCAN_REFRESH_INTERVAL_MS = 60_000;
const SCAN_AGE_THRESHOLD_MS = 6 * 60_000;

// ---- Command Center root ----
export default function CommandCenter({ onClose }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState("park-fire");
  const [cycle, setCycle] = useState(4127);
  const [lastRun] = useState(Date.now() - 167_000);
  const [fires, setFires] = useState(FIRES);
  const [rawScans, setRawScans] = useState([]);

  const applyScans = (scans) => {
    const compiled = compileScanLogs(scans);
    if (compiled) {
      setFires([compiled]);
      setSelectedId((prev) => prev === "park-fire" ? compiled.id : prev);
    }
  };

  useEffect(() => {
    fetchScanLogs()
      .then((scans) => {
        setRawScans(scans);
        applyScans(scans);
      })
      .catch((err) => console.error("[CommandCenter] scan fetch error:", err));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setRawScans((prev) => {
        if (prev.length === 0) return prev;
        const latest = [...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const ageMs = Date.now() - new Date(latest.created_at).getTime();
        if (ageMs < SCAN_AGE_THRESHOLD_MS) return prev;

        console.log("[CommandCenter] Latest scan is", Math.round(ageMs / 60000), "min old — checking for new logs…");
        fetchScanLogs()
          .then((newScans) => {
            setRawScans((current) => {
              const existingIds = new Set(current.map((s) => s.id));
              const added = newScans.filter((s) => !existingIds.has(s.id));
              if (added.length === 0) {
                console.log("[CommandCenter] No new scan logs.");
                return current;
              }
              console.log(`[CommandCenter] ${added.length} new scan(s) added.`);
              const merged = [...current, ...added];
              applyScans(merged);
              return merged;
            });
          })
          .catch((err) => console.error("[CommandCenter] scan refresh error:", err));

        return prev;
      });
    }, SCAN_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const fire = fires.find((f) => f.id === selectedId) || fires[0];
  const log = fire?.draftComms ? buildLog(fire) : AGENT_LOG;
  const brief = fire?.brief || BRIEF;

  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleClose = () => {
    if (onClose) onClose();
    else navigate("/", { replace: true });
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)", minWidth: 1200, overflowX: "auto" }}>
      <TopRail cycle={cycle} lastRunMs={lastRun} onClose={handleClose} onLogout={handleLogout} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <IncidentQueueRail incidents={fires} selectedId={selectedId} onSelect={setSelectedId} />
        <MainPanel fire={fire} />
        <aside style={{ width: 360, flexShrink: 0, borderLeft: "1px solid var(--hairline-strong)", background: "var(--surface-1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: "0 0 auto", maxHeight: "55%", overflowY: "auto" }}>
            <LiveActionStream log={log} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <MultiAgencyBrief brief={brief} fire={fire} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function buildLog(fire) {
  const entries = fire.timeline || [];
  return entries.map((e) => ({
    t: e.createdAt ? new Date(e.createdAt).toLocaleTimeString("en-US", { hour12: false }) : "00:00:00",
    createdAtMs: e.createdAt ? new Date(e.createdAt).getTime() : null,
    type: e.frpTrend === "INCREASING" ? "GENERATE_ALERT" : e.hotspotCount > 0 ? "INGEST" : "CYCLE_START",
    target: `Scan #${e.entryNum} · ${e.hotspotCount ?? 0} hotspots · ${e.maxFrp != null ? Math.round(e.maxFrp) + " MW" : "—"}`,
    conf: 0.9,
    severity: e.frpTrend === "INCREASING" ? "critical" : "warning",
  }));
}
