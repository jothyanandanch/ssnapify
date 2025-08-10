from passlib.context import CryptContext
from datetime import datetime, timedelta,timezone
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from app.config import settings
from typing import Optional

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Convert plain password to hashed version.
    Example: "Mypassword123!" -> "$2b$12$EixZaYVK1fsbw1ZfbX3OXeP4i"
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    
    #Check if plain password matches hashed version used during login
    return pwd_context.verify(plain_password, hashed_password)


oauth2_scheme=OAuth2PasswordBearer(tokenUrl='/login')


def create_access_token(data: dict, expires_minutes:int|None=None)->str:
    """
    Create JWT token for authenticated users.
    JWT = JSON Web Token (industry standard for API authentication)
    """
    expire=datetime.now(timezone.utc)+timedelta(minutes=expires_minutes or settings.access_token_expire_minutes)
    to_encode={**data,'exp':expire}
    return jwt.encode(to_encode,settings.secret_key,algorithm=settings.algorithm)