from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import engine, redis_client
from sqlalchemy import text
from models import orm

app = FastAPI(
    title="FireSync API",
    description="Backend for Autonomous Global Wildfire Coordination Agent",
    version="1.0.0"
)

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "online", "message": "FireSync Backend is running."}

@app.get("/health")
async def health_check():
    health_status = {"api": "online", "db": "offline", "redis": "offline"}
    
    # 1. Check Postgres (Cloud Supabase)
    try:
        with engine.connect() as conn:
            # We use text() to wrap the raw SQL for SQLAlchemy 2.0+
            conn.execute(text("SELECT 1"))
            health_status["db"] = "online"
    except Exception as e:
        health_status["db"] = f"offline: {str(e)}"

    # 2. Check Redis (Cloud Upstash HTTP)
    try:
        # We try a simple SET command. If it doesn't throw an error, we're online.
        # 'ex=1' ensures this dummy key disappears in 1 second.
        redis_client.set("health_check_ping", "connected", ex=1)
        health_status["redis"] = "online"
    except Exception as e:
        health_status["redis"] = f"offline: {str(e)}"

    return health_status

import asyncio
from contextlib import asynccontextmanager
from api.websockets import router as ws_router, mock_agent_emitter

# This runs the mock emitter in the background when FastAPI starts
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(mock_agent_emitter())
    yield
    task.cancel()

# Update your FastAPI instance to use the lifespan hook
app.router.lifespan_context = lifespan

# Register the WebSocket route
app.include_router(ws_router, prefix="/ws")

# Create the database tables if they don't exist
orm.Base.metadata.create_all(bind=engine)

# --- Router Inclusions ---
from api.routes import router as api_router
from api.websockets import router as ws_router

# Register the standard REST endpoints
app.include_router(api_router, prefix="/api")

# Register the WebSocket route
app.include_router(ws_router, prefix="/ws")