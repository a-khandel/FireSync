import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, clearAuth } from "./auth.js";
import { Mono } from "./ui.jsx";

export default function FiresListPage() {
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    if (!auth) {
      navigate("/login", { replace: true });
    }
  }, [auth, navigate]);

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  if (!auth) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      padding: "32px 40px",
      color: "var(--text-primary)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 32,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}>FireSync</div>
          <Mono size={11} color="var(--text-tertiary)">Fires in Your County</Mono>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Mono size={12} color="var(--text-secondary)">{auth.name}</Mono>
          <button
            onClick={handleLogout}
            style={{
              padding: "8px 14px",
              border: "1px solid var(--hairline-strong)",
              background: "var(--surface-1)",
              color: "var(--text-secondary)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-1)")}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Fire card */}
      <div style={{
        maxWidth: 560,
        borderLeft: "4px solid var(--critical)",
        background: "var(--surface-1)",
        border: "1px solid var(--hairline-strong)",
        borderLeftWidth: 4,
        padding: "24px 28px",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px",
          background: "rgba(255, 77, 28, 0.15)",
          color: "var(--critical)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--critical)",
            display: "inline-block",
          }} />
          Live Incident
        </div>

        <h2 style={{
          fontSize: 20,
          fontWeight: 600,
          margin: "0 0 4px",
          color: "var(--text-primary)",
        }}>Santa Rosa Island Fire</h2>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Santa Barbara County, CA
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <Mono size={11} color="var(--text-tertiary)">SIZE</Mono>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>1,200 acres</div>
          </div>
          <div>
            <Mono size={11} color="var(--text-tertiary)">CONTAINMENT</Mono>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>0%</div>
          </div>
          <div>
            <Mono size={11} color="var(--text-tertiary)">THREAT</Mono>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
              padding: "2px 8px",
              background: "rgba(255, 77, 28, 0.12)",
              color: "var(--critical)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              Critical
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <Mono size={11} color="var(--text-tertiary)">WIND</Mono>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2, color: "var(--text-secondary)" }}>33 mph</div>
          </div>
          <div>
            <Mono size={11} color="var(--text-tertiary)">HUMIDITY</Mono>
            <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2, color: "var(--text-secondary)" }}>51%</div>
          </div>
        </div>

        <Link
          to="/dashboard/santa-rosa-island"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "var(--critical)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
            transition: "opacity 180ms var(--ease)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          View Dashboard
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
