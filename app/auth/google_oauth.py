from authlib.integrations.starlette_client import OAuth
from app.config import settings

oauth=OAuth()

oauth.register(
    name='google',
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=settings.google_client_id,
    client_secrer=settings.google_client_secret,
    client_kwargs={"scope": "openid email profile"},
)