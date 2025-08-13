from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone
from app.services import cloudinary_service
from fastapi import FastAPI, Depends, HTTPException, status, Request, Query, UploadFile, File,Response
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

from jose import JWTError, jwt
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

import cloudinary.uploader
import cloudinary.api

# Local imports
from app.config import settings
from app.database import Base, engine, get_db
from app.models.user import User
from app.models.image import Image
from app.models.schemas import UserCreate, UserOut, ImageOut
from app.auth.security import hash_password, create_access_token, oauth2_scheme
from app.auth.google_oauth import oauth
from app.billing.scheduler import start_scheduler
from app.billing.enforce import ensure_credits_or_admin

# =============================================================================
# DATABASE SETUP
# =============================================================================

# Create DB tables (dev convenience). Use Alembic in production.
Base.metadata.create_all(bind=engine)

# =============================================================================
# APP CONFIGURATION
# =============================================================================

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

# Serve static frontend from /public -> /static
app.mount("/static", StaticFiles(directory="public"), name="static")

@app.get("/")
def root():
    """Redirect root to frontend landing page"""
    return RedirectResponse(url="/static/index.html")

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

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

# =============================================================================
# DEPENDENCY FUNCTIONS
# =============================================================================

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Get current authenticated user from JWT token"""
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
    """Require admin privileges"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin access required"
        )
    return current_user

# =============================================================================
# ROUTER SETUP
# =============================================================================

auth_router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])
support_router = APIRouter(prefix="/support", tags=["support"])

# =============================================================================
# AUTHENTICATION ROUTES
# =============================================================================

@auth_router.get("/google/login")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    redirect_url = request.url_for("auth_google_callback")
    return await oauth.google.authorize_redirect(request, redirect_url)




FRONTEND_AFTER_LOGIN = "http://localhost:8000/static/dashboard.html"

@auth_router.get("/google/callback", name="auth_google_callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback"""
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if userinfo is None:
        raise HTTPException(status_code=400, detail="Failed to retrieve user info from Google")

    email: Optional[str] = userinfo.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account missing email")

    username = userinfo.get("name") or email.split("@")[0]

    # Find or create user
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

    # 🔁 Redirect to frontend with token as query param
    url = f"{FRONTEND_AFTER_LOGIN}?token={access_token}"
    return RedirectResponse(url)

@auth_router.post("/logout",status_code=200)
def logout_notice():
    {
        "ok": True,
        "message": "Logged out. Please clear client token."}
# =============================================================================
# USER MANAGEMENT ROUTES
# =============================================================================

@users_router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(userdata: UserCreate, db: Session = Depends(get_db)):
    """Create new user (non-Google registration)"""
    # Check for existing email
    existing_email = db.query(User).filter(User.email == userdata.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check for existing username
    existing_username = db.query(User).filter(User.username == userdata.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Create new user
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
def list_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all users (admin only)"""
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
    """Get current user profile"""
    return current_user

@app.get("/account/credits")
def get_credits_info(current_user: User = Depends(get_current_user)):
    """Get user's credit balance and billing information"""
    # Always compute strictly in UTC
    now = datetime.now(timezone.utc)

    if current_user.plan_id == 1:
        # Free plan: calendar month boundaries in UTC
        from app.billing.timeutils import start_of_utc_month, add_calendar_months
        current_cycle_start = start_of_utc_month(now)
        next_cycle_start = add_calendar_months(current_cycle_start, 1)
        days_remaining = (next_cycle_start - now).days
        billing_cycle_ends = None
        next_reset_time = next_cycle_start
    else:
        # Paid plan: anchored to billing_anchor_utc
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

# =============================================================================
# ADMIN ROUTES
# =============================================================================

@admin_router.post("/users/{user_id}/role")
def set_admin_role(
    user_id: int,
    update: AdminRoleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Set user admin role"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin = bool(update.make_admin)
    db.commit()
    db.refresh(user)
    return {"message": "Role updated", "user_id": user.id, "is_admin": user.is_admin}

@admin_router.post("/users/{user_id}/status")
def set_user_status(
    user_id: int,
    update: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Set user active status"""
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
    """Set user credit balance"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.credit_balance = int(update.credits)
    db.commit()
    db.refresh(user)
    return {"message": "Credits updated", "user_id": user.id, "credit_balance": user.credit_balance}

# =============================================================================
# IMAGE MANAGEMENT ROUTES
# =============================================================================

@app.get("/images", response_model=List[ImageOut])
def list_user_images(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user's uploaded images"""
    return (
        db.query(Image)
        .filter(Image.user_id == current_user.id)
        .order_by(Image.created_at.desc())
        .all()
    )

@app.post('/images', response_model=ImageOut)
def upload_image(
    title: str | None = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload new image to Cloudinary"""
    ensure_credits_or_admin(current_user, db, cost=1)
    
    try:
        upload_response = cloudinary.uploader.upload(file.file, resource_type='image')
    except Exception as e:
        raise HTTPException(500, detail=f"Cloudinary upload failed: {str(e)}")

    img = Image(
        user_id=current_user.id,
        public_id=upload_response['public_id'],
        secure_url=upload_response['secure_url'],
        title=title,
        transformation_type=None,
        config=None,
    )
    db.add(img)
    db.commit()
    db.refresh(img)
    return img

@app.delete("/images/{image_id}", status_code=204)
def delete_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete image from database and Cloudinary"""
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(404, detail="Image not found")

    # Allow if owner OR admin; deny otherwise
    if img.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, detail="Not authorized to delete this image")

    try:
        cloudinary.api.delete_resources([img.public_id], resource_type="image")
    except Exception as e:
        raise HTTPException(500, detail=f"Failed to delete image from Cloudinary: {str(e)}")

    db.delete(img)
    db.commit()

# =============================================================================
# IMAGE TRANSFORMATION ROUTES
# =============================================================================

@app.post("/images/{image_id}/restore", response_model=ImageOut)
def restore_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore damaged/old image using AI"""
    img = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not img:
        raise HTTPException(404, "Image Not Found")

    ensure_credits_or_admin(current_user, db, cost=1)
    
    try:
        restored = cloudinary.uploader.upload(img.secure_url, transformation=[{"effect": "restore"}])
    except Exception as e:
        raise HTTPException(500, detail=f"Cloudinary restore failed: {str(e)}")

    new_img = Image(
        user_id=current_user.id,
        public_id=restored['public_id'],
        secure_url=restored['secure_url'],
        title="Restored " + (img.title or ""),
        transformation_type="restore",
        config={"effect": "restore"},
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    return new_img

@app.post("/images/{image_id}/remove_bg", response_model=ImageOut)
def remove_background(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove background from image"""
    img = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not img:
        raise HTTPException(404, "Image Not Found")

    ensure_credits_or_admin(current_user, db, cost=1)
    
    try:
        processed = cloudinary.uploader.upload(img.secure_url, transformation=[{"effect": "background_removal"}])
    except Exception as e:
        raise HTTPException(500, detail=f"Cloudinary background removal failed: {str(e)}")

    new_img = Image(
        user_id=current_user.id,
        public_id=processed['public_id'],
        secure_url=processed['secure_url'],
        title="Background Removed " + (img.title or ""),
        transformation_type="remove_bg",
        config={"effect": "background_removal"},
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    return new_img

@app.post("/images/{image_id}/remove_obj", response_model=ImageOut)
def remove_object(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove objects from image"""
    img = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not img:
        raise HTTPException(404, "Image Not Found")

    ensure_credits_or_admin(current_user, db, cost=1)
    
    try:
        processed = cloudinary.uploader.upload(img.secure_url, transformation=[{"effect": "object_removal"}])
    except Exception as e:
        raise HTTPException(500, detail=f"Cloudinary object removal failed: {str(e)}")

    new_img = Image(
        user_id=current_user.id,
        public_id=processed['public_id'],
        secure_url=processed['secure_url'],
        title="Object Removed " + (img.title or ""),
        transformation_type="object_removal",
        config={"effect": "object_removal"},
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    return new_img

@app.post("/images/{image_id}/generative_fill", response_model=ImageOut)
def generative_fill(
    image_id: int,
    prompt: str = Query(..., description="Text prompt describing the fill content"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fill areas of image using AI generation"""
    img = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not img:
        raise HTTPException(404, "Image Not Found")

    ensure_credits_or_admin(current_user, db, cost=3)
    
    try:
        processed = cloudinary.uploader.upload(
            img.secure_url,
            transformation=[{"effect": "generative_fill", "prompt": prompt}],
        )
    except Exception as e:
        raise HTTPException(500, detail=f"Cloudinary generative fill failed: {str(e)}")

    new_img = Image(
        user_id=current_user.id,
        public_id=processed['public_id'],
        secure_url=processed['secure_url'],
        title=f"Generative Fill: {prompt} " + (img.title or ""),
        transformation_type="generative_fill",
        config={"effect": "generative_fill", "prompt": prompt},
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    return new_img

@app.post("/images/{image_id}/image_enhancer", response_model=ImageOut)
def image_enhancer(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enhance image quality and sharpness"""
    img = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not img:
        raise HTTPException(404, "Image Not Found")

    ensure_credits_or_admin(current_user, db, cost=1)
    
    try:
        processed = cloudinary.uploader.upload(
            img.secure_url,
            transformation=[
                {"quality": "auto"},
                {"effect": "sharpen", "strength": 50},
            ],
        )
    except Exception as e:
        raise HTTPException(500, detail=f"Cloudinary image enhancer failed: {str(e)}")

    new_img = Image(
        user_id=current_user.id,
        public_id=processed['public_id'],
        secure_url=processed['secure_url'],
        title="Enhanced Image " + (img.title or ""),
        transformation_type="image_enhancer",
        config=[
            {"quality": "auto"},
            {"effect": "sharpen", "strength": 50},
        ],
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    return new_img

@app.post("/images/{image_id}/replace_background", response_model=ImageOut)
def replace_background(
    image_id: int,
    prompt: str = Query(..., description="Description of new background"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace image background with AI-generated content"""
    img = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not img:
        raise HTTPException(404, "Image Not Found")

    ensure_credits_or_admin(current_user, db, cost=2)
    
    try:
        processed = cloudinary.uploader.upload(
            img.secure_url,
            transformation=[{"effect": "background_replacement", "background": prompt}],
        )
    except Exception as e:
        raise HTTPException(500, detail=f"Cloudinary background replacement failed: {str(e)}")

    new_img = Image(
        user_id=current_user.id,
        public_id=processed['public_id'],
        secure_url=processed['secure_url'],
        title=f"Background replaced: {prompt} " + (img.title or ""),
        transformation_type="replace_background",
        config={"effect": "background_replacement", "background": prompt},
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    return new_img

# =============================================================================
# SUPPORT ROUTES
# =============================================================================

@support_router.post("/ticket", status_code=200)
def create_ticket(
    data: TicketIn,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Create support ticket"""
    # Compose email content for your mailer (implement send_email separately)
    user_email = getattr(current_user, "email", None) if current_user else None
    email_subject = f"Support Ticket: {data.subject}"
    email_body = f"""
From: {data.name}
User Email: {user_email or "anonymous/guest"}
Subject: {data.subject}

Message:
{data.message}
""".strip()
    
    # TODO: send_email(to="jothyanandan123@gmail.com", subject=email_subject, body=email_body)
    return {"ok": True}

# =============================================================================
# ROUTER REGISTRATION
# =============================================================================

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(support_router)