from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models import orm

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