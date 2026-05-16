// FireSync — root app

import { useEffect, useState } from "react";
import PublicGlobe from "./PublicGlobe.jsx";
import CommandCenter from "./CommandCenter.jsx";
import { Mono } from "./ui.jsx";

const STAGES = [
  "INITIALIZING GLOBE...",
  "LOADING NASA FIRMS...",
  "LOADING NOAA NWS...",
  "LOADING WORLDPOP...",
  "AGENT ONLINE",
];

function LoadingSplash({ onDone }) {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    let p = 0;
    const id = setInterval(() => {
      p = Math.min(1, p + 0.045 + Math.random() * 0.025);
      setProgress(p);
      const s = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
      setStage(s);
      if (p >= 1) {
        clearInterval(id);
        setTimeout(() => { setHide(true); onDone(); }, 350);
      }
    }, 55);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "var(--bg)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 24,
      opacity: hide ? 0 : 1,
      transition: "opacity 600ms var(--ease)",
      pointerEvents: hide ? "none" : "auto",
    }}>
      <div className="fade-in" style={{
        fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 64, lineHeight: 1,
        color: "var(--text-primary)", letterSpacing: "-0.015em",
      }}>FireSync</div>
      <div style={{ width: 280, height: 1, background: "var(--hairline)", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: progress * 100 + "%", background: "var(--info)",
          transition: "width 60ms linear",
        }} />
      </div>
      <Mono size={11} color="var(--text-tertiary)" style={{ letterSpacing: "0.12em" }}>
        {STAGES[stage]}
        <span className="caret" style={{ display: stage >= STAGES.length - 1 ? "none" : "inline" }} />
      </Mono>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("public");
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && <LoadingSplash onDone={() => setLoading(false)} />}
      {!loading && (
        <>
          <div style={{ position: "absolute", inset: 0, display: view === "public" ? "block" : "none" }}>
            <PublicGlobe onOpenCommand={() => setView("command")} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: view === "command" ? "block" : "none" }}>
            <CommandCenter onClose={() => setView("public")} />
          </div>
        </>
      )}
    </>
  );
}
