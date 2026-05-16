from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
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