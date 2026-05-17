-- ============================================================
-- OpenClaw: scan_logs table
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ============================================================

CREATE TABLE IF NOT EXISTS scan_logs (
    id              SERIAL PRIMARY KEY,
    scan_timestamp  TEXT NOT NULL,
    hotspot_count   INTEGER NOT NULL DEFAULT 0,
    total_area_km2  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    max_frp_mw      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    centroid_lat    DOUBLE PRECISION,
    centroid_lon    DOUBLE PRECISION,
    wind_speed      VARCHAR(50),
    wind_direction  VARCHAR(10),
    temperature_f   INTEGER,
    short_forecast  VARCHAR(100),
    frp_trend       VARCHAR(20),
    frp_delta_mw    DOUBLE PRECISION,
    hotspots        JSONB,
    evacuation_zones JSONB,
    draft_comms     JSONB,
    osm_infrastructure JSONB,
    nemoclaw_brief  TEXT,
    nemoclaw_model  VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast time-range queries
CREATE INDEX IF NOT EXISTS idx_scan_logs_created_at ON scan_logs (created_at DESC);

-- Index for trend lookups
CREATE INDEX IF NOT EXISTS idx_scan_logs_frp_trend ON scan_logs (frp_trend);

-- Enable Row-Level Security (public read, service-role write)
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
    ON scan_logs FOR SELECT
    USING (true);

CREATE POLICY "Allow service role insert"
    ON scan_logs FOR INSERT
    WITH CHECK (true);
