from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://iobal:iobal123@db:5432/arrend_db"
    SECRET_KEY: str = "cambia-esto-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DEBUG: bool = True  # en producción, ponlo en False vía variable de entorno DEBUG=false

    class Config:
        env_file = ".env"

settings = Settings()
