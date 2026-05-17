from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models import orm
from agent.tools import latest_situation, compute_fire_centroid

router = APIRouter()

@router.get("/incidents")
def get_active_incidents(db: Session = Depends(get_db)):
    """Fetch all active fire incidents for the Mapbox initial load."""
    incidents = db.query(orm.Incident).filter(orm.Incident.status == "active").all()
    return incidents

@router.get("/incidents/{incident_id}/logs")
def get_incident_logs(incident_id: int, db: Session = Depends(get_db)):
    """Fetch the Nemotron reasoning history for a specific fire."""
    logs = db.query(orm.AgentActionLog).filter(orm.AgentActionLog.incident_id == incident_id).order_by(orm.AgentActionLog.created_at.desc()).all()
    if not logs:
        raise HTTPException(status_code=404, detail="No logs found for this incident")
    return logs

@router.get("/situation")
def get_situation():
    """Return the latest full situation report assembled by the agent loop."""
    if not latest_situation:
        raise HTTPException(status_code=404, detail="No situation data yet. Waiting for first scan cycle.")
    return latest_situation

@router.get("/evacuation-zones")
def get_evacuation_zones():
    """Return the latest evacuation zone GeoJSON."""
    zones = latest_situation.get("evacuation_zones")
    if not zones:
        raise HTTPException(status_code=404, detail="No evacuation zones generated yet.")
    return zones

@router.get("/comms")
def get_draft_comms():
    """Return the latest draft resource coordination messages."""
    comms = latest_situation.get("comms")
    if not comms:
        raise HTTPException(status_code=404, detail="No draft communications generated yet.")
    return comms

# ── Incident Report Generation (Frontend ↔ Backend) ─────────────────────

@router.post("/reports/generate")
async def generate_report():
    """Frontend calls this to trigger NemoClaw document generation.
    Uses cached situation if available, otherwise does an on-demand
    GOES + weather fetch so the endpoint never returns 409."""
    from agent.runtime import generate_incident_document
    from services.goes import fetch_latest_goes_metadata
    from services.weather import fetch_wind_data

    situation = dict(latest_situation) if latest_situation else None

    if not situation:
        data = await fetch_latest_goes_metadata()
        if data.get("status") != "success" or not data.get("coords"):
            raise HTTPException(
                status_code=503,
                detail="No active fire data available from GOES at this time."
            )
        hotspots = data["coords"]
        total_area = data.get("summary", {}).get("total_area", 0.0)
        max_frp = data.get("max_frp_mw", 0.0)
        centroid = compute_fire_centroid(hotspots)

        wind_data = {}
        try:
            wind_data = await fetch_wind_data(centroid[0], centroid[1])
        except Exception:
            wind_data = {"status": "error", "message": "weather unavailable"}

        situation = {
            "timestamp": data.get("timestamp", "on-demand"),
            "centroid": {"lat": centroid[0], "lon": centroid[1]},
            "hotspot_count": len(hotspots),
            "total_area": total_area,
            "max_frp": max_frp,
            "hotspots": hotspots,
            "wind": wind_data,
            "trend": {"trend": "INSUFFICIENT_DATA"},
            "osm": {},
            "comms": [],
        }

    result = await generate_incident_document(situation)
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.get("/reports")
def list_reports(limit: int = 20, db: Session = Depends(get_db)):
    """Fetch recent incident reports, newest first."""
    reports = (
        db.query(orm.IncidentReport)
        .order_by(orm.IncidentReport.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "report_type": r.report_type,
            "scan_timestamp": r.scan_timestamp,
            "hotspot_count": r.hotspot_count,
            "total_area_km2": r.total_area_km2,
            "max_frp_mw": r.max_frp_mw,
            "model_used": r.model_used,
            "created_at": str(r.created_at),
        }
        for r in reports
    ]

@router.get("/reports/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    """Fetch a single incident report with the full document."""
    report = db.query(orm.IncidentReport).filter(orm.IncidentReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {
        "id": report.id,
        "report_type": report.report_type,
        "scan_timestamp": report.scan_timestamp,
        "hotspot_count": report.hotspot_count,
        "total_area_km2": report.total_area_km2,
        "max_frp_mw": report.max_frp_mw,
        "centroid_lat": report.centroid_lat,
        "centroid_lon": report.centroid_lon,
        "wind_summary": report.wind_summary,
        "frp_trend": report.frp_trend,
        "document": report.document,
        "model_used": report.model_used,
        "requested_by": report.requested_by,
        "created_at": str(report.created_at),
    }