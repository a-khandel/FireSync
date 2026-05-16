from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from upstash_redis import Redis
from .config import settings

# --- PostgreSQL Setup (Persistent Storage) ---
# Create the SQLAlchemy engine using the Supabase URL
engine = create_engine(settings.DATABASE_URL)

# Create a session factory for database transactions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for your ORM models to inherit from
Base = declarative_base()

# --- Redis Setup (Upstash HTTP / Firewall-Proof) ---
# We initialize this ONLY ONCE using the REST URL and Token.
# upstash-redis does not use .from_url(), so we pass the params directly.
redis_client = Redis(
    url=settings.UPSTASH_REDIS_REST_URL, 
    token=settings.UPSTASH_REDIS_REST_TOKEN
)

# --- Dependencies ---

def get_db():
    """FastAPI dependency to get a Postgres session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_redis():
    """Dependency to get the Redis client."""
    return redis_client