from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.orm import Session
from app.config import settings
from app.services.redis_service import redis_service
from app.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    """Create JWT with issued at timestamp"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    to_encode = {
        **data,
        "exp": expire,
        "iat": now,  # Add issued at timestamp
        "nbf": now   # Not before timestamp
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Get current authenticated user from JWT token with blacklist check"""
    # Check if token is blacklisted
    if redis_service.is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated",
        )
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        issued_at = payload.get("iat")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
            
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Load user
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User inactive",
        )
    
    # Invalidate if user performed "logout from all devices" after this token was issued
    if issued_at:
        user_logout_time = redis_service.get_user_logout_time(str(user.id))
        if user_logout_time:
            # Handle both timestamp formats
            if isinstance(issued_at, (int, float)):
                token_issued_time = datetime.fromtimestamp(issued_at, tz=timezone.utc)
            else:
                token_issued_time = issued_at
            
            if user_logout_time > token_issued_time:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token invalidated due to security logout",
                )
    
    return user
