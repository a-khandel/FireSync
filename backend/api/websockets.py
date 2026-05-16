from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import random
from datetime import datetime

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Background task to simulate the Nemotron agent acting over time
async def mock_agent_emitter():
    actions = [
        {"action": "get_wind_vector", "status": "completed", "result": "Winds 45mph West"},
        {"action": "get_vulnerable_population", "status": "completed", "result": "3400 people in path"},
        {"action": "draft_evacuation_order", "status": "in_progress", "result": "Drafting Spanish translation..."},
        {"action": "calculate_evac_route", "status": "completed", "result": "Highway 17 blocked. Rerouting."}
    ]
    
    while True:
        await asyncio.sleep(10) # Fires every 10 seconds for easy UI testing
        mock_event = {
            "timestamp": datetime.utcnow().isoformat(),
            "agent": "Nemotron 3 Super",
            "update": random.choice(actions)
        }
        await manager.broadcast(json.dumps(mock_event))

@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We just need to keep the connection open to push data
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)