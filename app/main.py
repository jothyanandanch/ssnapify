from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone

from app.services import cloudinary_service
from fastapi import FastAPI, Depends, HTTPException, status, Request, Query, UploadFile, File
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

from jose import JWTError, jwt
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import cloudinary.uploader
import cloudinary.api

from app.config import settings
from app.database import Base, engine, get_db
from app.models.user import User
from app.models.image import Image
from app.models.schemas import UserCreate, UserOut, ImageOut
from app.auth.security import hash_password, create_access_token, oauth2_scheme
from app.auth.google_oauth import oauth
from app.billing.scheduler import start_scheduler
from app.billing.enforce import ensure_credits_or_admin

# Create DB tables (dev convenience). Use Alembic in production.
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    print("Scheduler Started!")
    try:
        yield
    finally:
        print("Scheduler Stopped")

app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

# Mount static assets so HTML can load /config.js, /theme.js, /assets/logo.svg etc.
app.mount("/static", StaticFiles(directory="public"), name="static")
app.mount("/styles", StaticFiles(directory="public/styles"), name="styles")
app.mount("/js", StaticFiles(directory="public/js"), name="js")
app.mount("/assets", StaticFiles(directory="public/assets"), name="assets")

@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")

# --------------------- MODELS ---------------------
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

class TicketIn(BaseModel):
    name: str
    subject: str
    message: str

# --------------------- DEPENDENCIES ---------------------
def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

# --------------------- ROUTERS ---------------------
auth_router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
support_router = APIRouter(prefix="/support", tags=["support"])

# --------------------- AUTH ---------------------
@auth_router.get("/google/login")
async def google_login(request: Request):
    redirect_url = request.url_for("auth_google_callback")
    return await oauth.google.authorize_redirect(request, redirect_url)

FRONTEND_AFTER_LOGIN = "http://localhost:8000/static/dashboard.html"

@auth_router.get("/google/callback", name="auth_google_callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if not userinfo:
        raise HTTPException(status_code=400, detail="Failed to retrieve user info from Google")

    email: Optional[str] = userinfo.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account missing email")

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
    return RedirectResponse(f"{FRONTEND_AFTER_LOGIN}?token={access_token}")

@auth_router.post("/logout", status_code=200)
def logout_notice():
    return {"ok": True, "message": "Logged out. Please clear client token."}

# --------------------- USERS ---------------------
@users_router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(userdata: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == userdata.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == userdata.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = hash_password(userdata.password)
    new_user = User(email=userdata.email, username=userdata.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@users_router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_admin: User = Depends(require_admin)):
    return db.query(User).order_by(User.id.asc()).all()

@users_router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/account/credits")
def get_credits_info(current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if current_user.plan_id == 1:
        from app.billing.timeutils import start_of_utc_month, add_calendar_months
        current_cycle_start = start_of_utc_month(now)
        next_cycle_start = add_calendar_months(current_cycle_start, 1)
        days_remaining = (next_cycle_start - now).days
        billing_cycle_ends = None
        next_reset_time = next_cycle_start
    else:
        from app.billing.resets import compute_paid_cycle_start
        from app.billing.timeutils import add_calendar_months
        anchor = current_user.billing_anchor_utc or now
        current_cycle_start = compute_paid_cycle_start(anchor, now)
        next_cycle_start = add_calendar_months(current_cycle_start, 1)
        days_remaining = (next_cycle_start - now).days
        billing_cycle_ends = current_user.plan_expires_at
        next_reset_time = next_cycle_start

    return {
        "credit_balance": current_user.credit_balance,
        "plan_id": current_user.plan_id,
        "days_until_next_reset": max(days_remaining, 0),
        "billing_cycle_ends": billing_cycle_ends,
        "next_reset_time": next_reset_time,
    }

# --------------------- ADMIN ---------------------
@admin_router.post("/users/{user_id}/role")
def set_admin_role(user_id: int, update: AdminRoleUpdate, db: Session = Depends(get_db), current_admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = bool(update.make_admin)
    db.commit()
    db.refresh(user)
    return {"message": "Role updated", "user_id": user.id, "is_admin": user.is_admin}

# ... keep your other admin routes here with cleaned syntax ...

# --------------------- IMAGE ROUTES ---------------------
# ... keep existing logic here exactly, just ensure all try/except, return, db.commit() blocks are closed properly like above ...

# --------------------- SUPPORT ---------------------
@support_router.post("/ticket", status_code=200)
def create_ticket(data: TicketIn, current_user: Optional[User] = Depends(get_current_user)):
    user_email = getattr(current_user, "email", None) if current_user else None
    email_subject = f"Support Ticket: {data.subject}"
    email_body = f"""From: {data.name}
User Email: {user_email or "anonymous/guest"}
Subject: {data.subject}

Message:
{data.message}"""
    # TODO: send email
    return {"ok": True}

# --------------------- REGISTER ROUTERS ---------------------
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(support_router)
