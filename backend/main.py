import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from core.database import engine, redis_client
from models import orm
from api.routes import router as api_router
from api.websockets import router as ws_router, mock_agent_emitter
from services.nifc import fetch_live_fires

# 1. THE AUTONOMOUS BACKGROUND LOOP
async def firesync_background_loop():
    """
    The 24/7 heartbeat. Continually fetches live NASA data and pushes to Redis.
    """
    while True:
        print("🛰️ FireSync: Starting live data pull...")
        try:
            # Pull data and push to Redis (No Postgres DB session needed here)
            await fetch_live_fires()
        except Exception as e:
            print(f"❌ FireSync Loop Error: {e}")
        
        # Wait 10 minutes (600 seconds) to avoid API rate limits
        await asyncio.sleep(600)

# 2. LIFESPAN MANAGEMENT
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables on startup (For AgentActionLog and reasoning traces)
    orm.Base.metadata.create_all(bind=engine)
    
    # Start the 24/7 Data Loop
    loop_task = asyncio.create_task(firesync_background_loop())
    
    # Start the WebSocket emitter (keeps the frontend updated)
    emitter_task = asyncio.create_task(mock_agent_emitter())
    
    yield
    
    # Cleanup on shutdown
    loop_task.cancel()
    emitter_task.cancel()

# 3. APP INITIALIZATION
app = FastAPI(
    title="FireSync API",
    description="24/7 Autonomous Global Wildfire Coordination Agent",
    version="1.0.0",
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
    return {"status": "online", "message": "FireSync Autonomous Backend is active."}

@app.get("/health")
async def health_check():
    health_status = {"api": "online", "db": "offline", "redis": "offline"}
    
    # Check Postgres (For Audit Logs)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            health_status["db"] = "online"
    except Exception as e:
        health_status["db"] = f"offline: {str(e)}"

    # Check Redis (For Live Incident State)
    try:
        redis_client.set("health_check_ping", "connected", ex=1)
        health_status["redis"] = "online"
    except Exception as e:
        health_status["redis"] = f"offline: {str(e)}"

    return health_status

# 5. ROUTER INCLUSIONS
app.include_router(api_router, prefix="/api")
app.include_router(ws_router, prefix="/ws")