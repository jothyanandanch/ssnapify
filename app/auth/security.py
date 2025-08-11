from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi.security import OAuth2PasswordBearer
from app.config import settings
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login") # tokenUrl is required by the spec

def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or settings.access_token_expire_minutes)
    to_encode = {**data, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)