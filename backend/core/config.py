from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FireSync"
    
    # Database URLs (Defaults match your docker-compose setup)
    DATABASE_URL: str 
    REDIS_URL: str = ""
    UPSTASH_REDIS_REST_URL: str
    UPSTASH_REDIS_REST_TOKEN: str
    NASA_FIRMS_MAP_KEY: str

    class Config:
        env_file = ".env"
        extra="ignore"

settings = Settings()