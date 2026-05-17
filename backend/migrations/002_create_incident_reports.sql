-- ============================================================
-- OpenClaw: incident_reports table
-- Run this in Supabase SQL Editor (Dashboard > SQL > New Query)
-- ============================================================

CREATE TABLE IF NOT EXISTS incident_reports (
    id                  SERIAL PRIMARY KEY,
    report_type         VARCHAR(50) NOT NULL DEFAULT 'full',
    scan_timestamp      TEXT,
    hotspot_count       INTEGER,
    total_area_km2      DOUBLE PRECISION,
    max_frp_mw          DOUBLE PRECISION,
    centroid_lat        DOUBLE PRECISION,
    centroid_lon        DOUBLE PRECISION,
    wind_summary        VARCHAR(200),
    frp_trend           VARCHAR(20),
    situation_snapshot  JSONB,
    document            TEXT NOT NULL,
    model_used          VARCHAR(100),
    requested_by        VARCHAR(100) DEFAULT 'frontend',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at
    ON incident_reports (created_at DESC);

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
    ON incident_reports FOR SELECT
    USING (true);

CREATE POLICY "Allow service role insert"
    ON incident_reports FOR INSERT
    WITH CHECK (true);
