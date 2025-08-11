# app/main.py
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Request, Query
from fastapi.routing import APIRouter
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field
from app.config import settings
from app.database import Base, engine, get_db
from app.models.user import User
from app.models.schemas import UserCreate, UserOut, Token  # assuming these exist
from app.auth.security import (
    hash_password,
    verify_password,       # imported but not used here; likely for password-based login elsewhere
    create_access_token,
    oauth2_scheme,
)
from app.auth.google_oauth import oauth
from app.billing.scheduler import start_scheduler


# ---------- Development convenience: create tables (use Alembic in prod) ----------
# Comment this out in production; rely on Alembic migrations.
Base.metadata.create_all(bind=engine)


# ---------- Lifespan for background/scheduler startup/shutdown ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    print("Scheduler Started!")
    try:
        yield
    finally:
        print("Scheduler Stopped")


app = FastAPI(lifespan=lifespan)

# Needed for Authlib OAuth state storage
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)


# ---------- Schemas for admin updates (use body instead of query params) ----------
class AdminRoleUpdate(BaseModel):
    make_admin: bool


class UserStatusUpdate(BaseModel):
    is_active: bool


class CreditUpdate(BaseModel):
    credits: int = Field(ge=0)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Shared dependencies ----------
def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

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
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ---------- Routers ----------
auth_router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


# =========================== AUTH (Google OAuth) ===========================
@auth_router.get("/google/login")
async def google_login(request: Request):
    redirect_url = request.url_for("auth_google_callback")
    # Authlib returns a Starlette Response; FastAPI can return it directly
    return await oauth.google.authorize_redirect(request, redirect_url)


@auth_router.get("/google/callback", name="auth_google_callback", response_model=AuthResponse)
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if userinfo is None:
        raise HTTPException(status_code=400, detail="Failed to retrieve user info from Google")

    email: Optional[str] = userinfo.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account missing email")

    # Prefer full name; fall back to local-part of email
    username = userinfo.get("name") or email.split("@")[0]

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            username=username,
            hashed_password="google_oauth_no_password",
            credit_balance=10,
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id)})
    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),  # Pydantic v2: ensure ORM -> schema
    )


# ============================== USERS ======================================
@users_router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(userdata: UserCreate, db: Session = Depends(get_db)):
    existing_email = db.query(User).filter(User.email == userdata.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = db.query(User).filter(User.username == userdata.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = hash_password(userdata.password)
    new_user = User(
        email=userdata.email,
        username=userdata.username,
        hashed_password=hashed_password,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@users_router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db),current_admin: User = Depends(require_admin),limit: int = Query(50, ge=1, le=200),offset: int = Query(0, ge=0),):
    users = (
        db.query(User)
        .order_by(User.id.asc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return users


@users_router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


# ============================== ADMIN ======================================
@admin_router.post("/users/{user_id}/role")
def set_admin_role(user_id: int,update: AdminRoleUpdate,db: Session = Depends(get_db),current_admin: User = Depends(require_admin),):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin = bool(update.make_admin)
    db.commit()
    db.refresh(user)
    return {"message": "Role updated", "user_id": user.id, "is_admin": user.is_admin}


@admin_router.post("/users/{user_id}/status")
def set_user_status(user_id: int,update: UserStatusUpdate,db: Session = Depends(get_db),current_admin: User = Depends(require_admin),):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = bool(update.is_active)
    db.commit()
    db.refresh(user)
    return {"message": "Status updated", "user_id": user.id, "is_active": user.is_active}


@admin_router.post("/users/{user_id}/credits")
def set_user_credits(
    user_id: int,
    update: CreditUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.credit_balance = int(update.credits)
    db.commit()
    db.refresh(user)
    return {"message": "Credits updated", "user_id": user.id, "credit_balance": user.credit_balance}


# ---------- Mount routers ----------
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)