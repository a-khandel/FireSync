from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from core.database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String, default="active") # active, contained, resolved
    population_at_risk = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AgentActionLog(Base):
    __tablename__ = "agent_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    agent_name = Column(String, nullable=False) # e.g., "Nemotron 3 Super"
    thought = Column(String, nullable=True)     # The reasoning
    action = Column(String, nullable=True)      # The tool called
    action_input = Column(JSON, nullable=True)  # The parameters passed
    observation = Column(String, nullable=True) # The result from the tool
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(50), nullable=False, default="full")
    scan_timestamp = Column(String, nullable=True)
    hotspot_count = Column(Integer, nullable=True)
    total_area_km2 = Column(Float, nullable=True)
    max_frp_mw = Column(Float, nullable=True)
    centroid_lat = Column(Float, nullable=True)
    centroid_lon = Column(Float, nullable=True)
    wind_summary = Column(String(200), nullable=True)
    frp_trend = Column(String(20), nullable=True)
    situation_snapshot = Column(JSON, nullable=True)
    document = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    requested_by = Column(String(100), nullable=True, default="frontend")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    scan_timestamp = Column(String, nullable=False)
    hotspot_count = Column(Integer, nullable=False, default=0)
    total_area_km2 = Column(Float, nullable=False, default=0.0)
    max_frp_mw = Column(Float, nullable=False, default=0.0)
    centroid_lat = Column(Float, nullable=True)
    centroid_lon = Column(Float, nullable=True)
    wind_speed = Column(String(50), nullable=True)
    wind_direction = Column(String(10), nullable=True)
    temperature_f = Column(Integer, nullable=True)
    short_forecast = Column(String(100), nullable=True)
    frp_trend = Column(String(20), nullable=True)
    frp_delta_mw = Column(Float, nullable=True)
    hotspots = Column(JSON, nullable=True)
    evacuation_zones = Column(JSON, nullable=True)
    draft_comms = Column(JSON, nullable=True)
    osm_infrastructure = Column(JSON, nullable=True)
    nemoclaw_brief = Column(Text, nullable=True)
    nemoclaw_model = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())