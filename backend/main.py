import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from core.database import engine, redis_client
from models import orm
from api.routes import router as api_router

# 1. IMPORT THE NEW AI BRAIN
from agent.runtime import openclaw_agent_loop

# 2. LIFESPAN MANAGEMENT
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safely create DB tables on startup
    try:
        orm.Base.metadata.create_all(bind=engine)
        print("✅ Database tables verified.")
    except Exception as e:
        print(f"⚠️ Database check failed (Server will still boot): {e}")
    
    # Start the OpenClaw 5-Minute GOES Loop
    print("🚀 Igniting OpenClaw Agent Loop...")
    loop_task = asyncio.create_task(openclaw_agent_loop())
    
    yield
    
    # Cleanup on shutdown
    loop_task.cancel()

# 3. APP INITIALIZATION
app = FastAPI(
    title="OpenClaw Command API",
    description="Autonomous Wildfire Incident Commander AI",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. ENDPOINTS
@app.get("/")
async def root():
    return {"status": "online", "message": "OpenClaw Backend is active and monitoring GOES-18."}

@app.get("/health")
async def health_check():
    health_status = {"api": "online", "db": "offline", "redis": "offline"}
    
    # Check Postgres (Supabase Logs)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            health_status["db"] = "online"
    except Exception as e:
        health_status["db"] = f"offline: {str(e)}"

    # Check Redis (State Cache)
    try:
        redis_client.set("health_check_ping", "connected", ex=1)
        health_status["redis"] = "online"
    except Exception as e:
        health_status["redis"] = f"offline: {str(e)}"

    return health_status

# 5. ROUTER INCLUSIONS
app.include_router(api_router, prefix="/api")
# Note: The WebSocket router is temporarily disabled until we build the live SSE stream.
# app.include_router(ws_router, prefix="/ws")