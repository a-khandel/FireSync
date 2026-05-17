import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuth } from "./auth.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const [badge, setBadge] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (badge.trim() === "CAL001" && password === "firesync") {
      setAuth({ badge: "CAL001", name: "Officer Martinez", role: "IC" });
      navigate("/fires", { replace: true });
    } else {
      setError("Invalid badge number or password.");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 380,
        border: "1px solid var(--hairline-strong)",
        background: "var(--surface-1)",
        padding: "40px 36px",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 36,
          color: "var(--text-primary)",
          letterSpacing: "-0.01em",
          marginBottom: 8,
        }}>FireSync</div>
        <div style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 32,
        }}>Fire Official Portal</div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}>Badge Number</label>
            <input
              type="text"
              value={badge}
              onChange={(e) => { setBadge(e.target.value); setError(""); }}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--hairline-strong)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                borderRadius: 0,
              }}
              placeholder="e.g. CAL001"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--hairline-strong)",
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                borderRadius: 0,
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12,
              color: "var(--critical)",
              fontWeight: 500,
            }}>{error}</div>
          )}

          <button
            type="submit"
            style={{
              marginTop: 8,
              padding: "12px 16px",
              background: "var(--critical)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              border: "none",
              cursor: "pointer",
              transition: "opacity 180ms var(--ease)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
