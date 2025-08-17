# config.py (add validation)
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import ValidationError

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    @property
    def patched_database_url(self):
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql://", 1)
        return self.database_url
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    google_client_id: str
    google_client_secret: str
    google_redirect_url: str
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str
    redis_url: str
    database_url: str
    postgres_user: str
    postgres_password: str
    postgres_database: str

    def validate(self):
        required_vars = [
            'secret_key', 'google_client_id', 'google_client_secret',
            'cloudinary_cloud_name', 'cloudinary_api_key', 'cloudinary_api_secret', 'database_url'
        ]
        for var in required_vars:
            if not getattr(self, var, None):
                raise ValueError(f"Missing required config: {var}")

settings = Settings()
try:
    settings = Settings()
    settings.validate()
except ValidationError as ve:
    print("Config validation failed:", ve)
    raise
