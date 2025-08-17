from fastapi import FastAPI, Depends, HTTPException, status, Request, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse, JSONResponse
from fastapi.routing import APIRouter
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import os
import logging
from typing import Optional, List
from starlette.middleware.sessions import SessionMiddleware

# App imports
from app.database import get_db, engine
from app import models
from app.auth.security import get_current_user, create_access_token, oauth2_scheme
from app.auth.google_oauth import oauth
from app.models.user import User
from app.models.image import Image
from app.services.cloudinary_service import cloudinary_service
from app.services.redis_service import redis_service
from app.billing.scheduler import start_scheduler
from app.billing.enforce import ensure_credits_or_admin
from app.billing.plans import PLANS, FREE_PLAN_ID
from app.billing.resets import apply_monthly_reset, handle_expiration
from app.billing.assigns import assign_paid_plan, revert_to_free
from app.billing.timeutils import now_utc
from app.models.schemas import UserOut, ImageOut
from app.config import settings
import cloudinary.uploader

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ssnapify")

# ------- Lifespan --------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 SSnapify starting up...")
    models.Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables created")
    if redis_service.ping():
        logger.info("✅ Redis connected successfully")
    else:
        logger.warning("⚠️ Redis connection failed. Token blacklisting will not work.")
    try:
        start_scheduler()
        logger.info("✅ Background billing scheduler started")
    except Exception as e:
        logger.error(f"Failed to start billing scheduler: {e}")
    yield
    logger.info("🛑 SSnapify shutting down...")

app = FastAPI(
    title="SSnapify API",
    description="AI-powered image enhancement and transformation service",
    version="1.0.0",
    lifespan=lifespan
)

# ------- Middlewares --------

# Secure cookies; set secure=True only for production!
is_prod = os.getenv("ENVIRONMENT", "development") == "production"
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    max_age=60 * 60 * 24 * 7,  # 1 week
    same_site="strict",
    secure=is_prod,
    httponly=True,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ssnapify.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://ssnapify-jothyanandanchs-projects.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

# Static Files (for local/dev - for Vercel you may want CDN or public static folder)
app.mount("/static", StaticFiles(directory="public"), name="static")
app.mount("/styles", StaticFiles(directory="public/styles"), name="styles")
app.mount("/js", StaticFiles(directory="public/js"), name="js")

# ------- Routers --------
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
images_router = APIRouter(prefix="/images", tags=["Images"])
account_router = APIRouter(prefix="/account", tags=["Account"])
admin_router = APIRouter(prefix="/admin", tags=["Admin"])
support_router = APIRouter(prefix="/support", tags=["Support"])
health_router = APIRouter(prefix="/health", tags=["Health"])

# ------- Routes --------
@auth_router.get("/google/login")
async def google_login(request: Request):
    # Google OAuth login
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)

@auth_router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    # Handle Google OAuth callback
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        user = db.query(User).filter(User.email == user_info["email"]).first()
        if not user:
            user = User(
                email=user_info["email"],
                username=user_info.get("name", user_info["email"].split("@")[0]),
                hashed_password="",
                is_active=True,
                is_admin=False,
                plan_id=FREE_PLAN_ID,
                credit_balance=PLANS[FREE_PLAN_ID].monthly_credits,
                last_credit_reset_at=now_utc(),
            )
            db.add(user); db.commit(); db.refresh(user)
        else:
            changed = False
            current_utc = now_utc()
            if handle_expiration(user, current_utc): changed = True
            if apply_monthly_reset(user, current_utc): changed = True
            if changed: db.commit()
        access_token = create_access_token(data={"sub": str(user.id)})
        redirect_url = f"/static/login.html?token={access_token}"
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"Google callback error: {e}")
        return RedirectResponse(url="/static/login.html?error=auth_failed")

@auth_router.post("/logout")
def logout(current_user: User = Depends(get_current_user), token: str = Depends(oauth2_scheme)):
    try:
        success = redis_service.blacklist_token(token, settings.access_token_expire_minutes)
        if not success:
            return {
                "ok": True,
                "message": "Logged out (client-side only)",
                "warning": "Server-side token invalidation unavailable",
            }
        return {
            "ok": True,
            "message": "Successfully logged out",
            "user_id": current_user.id,
        }
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return {
            "ok": True,
            "message": "Logged out (client-side only)",
            "error": "Server-side logout failed",
        }

@auth_router.post("/logout-all-devices")
def logout_all_devices(current_user: User = Depends(get_current_user)):
    try:
        success = redis_service.blacklist_all_user_tokens(str(current_user.id))
        if not success:
            raise HTTPException(status_code=500, detail="Failed to logout from all devices")
        return {"ok": True, "message": "Successfully logged out from all devices", "user_id": current_user.id}
    except Exception as e:
        logger.error(f"Logout all devices error: {e}")
        raise HTTPException(status_code=500, detail="Failed to logout from all devices")

@app.get("/users/me", response_model=UserOut)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/users", response_model=List[UserOut])
def get_all_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return db.query(User).all()

# ----- Image routes -----
@images_router.post("/", response_model=ImageOut)
async def upload_image(
    file: UploadFile = File(...),
    title: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        logger.info(f"Upload Request - User: {current_user.email}, File: {file.filename}, Content-Type: {file.content_type}, Title: '{title}'")
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File must be an image. Received: {file.content_type}")
        file_content = await file.read()
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        upload_result = cloudinary.uploader.upload(
            file_content,
            public_id=f"user_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            folder="ssnapify/originals",
            resource_type="image",
        )
        logger.info(f"Cloudinary upload successful: {upload_result['public_id']}")
        image = Image(
            user_id=current_user.id,
            public_id=upload_result["public_id"],
            secure_url=upload_result["secure_url"],
            title=title or file.filename or "Untitled",
            transformation_type=None,
            config=None,
        )
        db.add(image); db.commit(); db.refresh(image)
        logger.info(f"Database save successful: Image ID {image.id}")
        return image
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@images_router.get("/", response_model=List[ImageOut])
def get_user_images(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
):
    query = db.query(Image).filter(Image.user_id == current_user.id)
    if from_date:
        try:
            from_datetime = datetime.fromisoformat(from_date)
            query = query.filter(Image.created_at >= from_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format")
    if to_date:
        try:
            to_datetime = datetime.fromisoformat(to_date)
            query = query.filter(Image.created_at <= to_datetime)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format")
    return query.order_by(Image.created_at.desc()).offset(skip).limit(limit).all()

@images_router.get("/{image_id}", response_model=ImageOut)
def get_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    image = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image

@images_router.delete("/{image_id}")
def delete_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    image = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        import cloudinary.uploader
        cloudinary.uploader.destroy(image.public_id)
        db.delete(image); db.commit()
        return {"message": "Image deleted successfully"}
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete image")

# --------- Transformations ---------
@images_router.post("/{image_id}/restore")
async def restore_image(image_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await apply_transformation(image_id, "restore", current_user, db, cost=1)

@images_router.post("/{image_id}/remove_bg")
async def remove_background(image_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await apply_transformation(image_id, "remove_bg", current_user, db, cost=1)

@images_router.post("/{image_id}/remove_obj")
async def remove_object(image_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await apply_transformation(image_id, "remove_obj", current_user, db, cost=1)

@images_router.post("/{image_id}/enhance")
async def enhance_image(image_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await apply_transformation(image_id, "enhance", current_user, db, cost=1)

@images_router.post("/{image_id}/generative_fill")
async def generative_fill(
    image_id: int,
    prompt: str = Query(..., description="Description for generative fill"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await apply_transformation(image_id, "generative_fill", current_user, db, cost=3, prompt=prompt)

@images_router.post("/{image_id}/replace_bg")
async def replace_background(
    image_id: int,
    prompt: str = Query(..., description="Description for new background"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await apply_transformation(image_id, "replace_bg", current_user, db, cost=2, prompt=prompt)

async def apply_transformation(
    image_id: int,
    transformation: str,
    current_user: User,
    db: Session,
    cost: int,
    prompt: str = None,
):
    image = db.query(Image).filter(Image.id == image_id, Image.user_id == current_user.id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    ensure_credits_or_admin(current_user, db, cost)
    try:
        logger.info(f"Applying transformation: {transformation} for user {current_user.id}")
        base_url = image.secure_url
        url_parts = base_url.split("/upload/")
        if len(url_parts) != 2:
            raise Exception("Invalid Cloudinary URL format")
        base_part = url_parts[0] + "/upload/"
        image_part = url_parts[1]
        transformation_map = {
            "restore": "e_improve",
            "remove_bg": "e_background_removal",
            "remove_obj": "e_gen_remove",
            "enhance": "e_auto_contrast,e_auto_brightness",
            "generative_fill": "e_gen_fill",
            "replace_bg": "e_gen_background_replace",
        }
        transformation_params = transformation_map.get(transformation, "")
        transformed_url = f"{base_part}{transformation_params}/{image_part}"
        logger.info(f"Transformation URL: {transformed_url}")
        new_image = Image(
            user_id=current_user.id,
            public_id=f"transformed_{transformation}_{image.public_id.replace('/', '_')}",
            secure_url=transformed_url,
            title=f"{transformation.replace('_', ' ').title()} - {image.title}",
            transformation_type=transformation,
            config={"original_image_id": image.id, "prompt": prompt} if prompt else {"original_image_id": image.id},
        )
        db.add(new_image); db.commit(); db.refresh(new_image)
        logger.info(f"Transformation complete: Image ID {new_image.id}")
        return new_image
    except Exception as e:
        logger.error(f"Transformation error: {e}")
        current_user.credit_balance += cost
        db.commit()
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")

# ------------ Account, Admin, Support, and Health routes omitted for brevity (you already have these, keep as is) ------------

# --------- Static and Error Handling ---------
@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")

@app.get("/{filename}")
def serve_html_pages(filename: str):
    if filename.endswith(".html"):
        file_path = f"public/{filename}"
        if os.path.exists(file_path):
            return FileResponse(file_path)
        raise HTTPException(status_code=404, detail="Page not found")

@app.get("/test-session")
async def test_session(request: Request):
    try:
        session = request.session
        session["test"] = session.get("test", 0) + 1
        return {"session_count": session["test"], "message": "SessionMiddleware is working!"}
    except Exception as e:
        return {"error": f"SessionMiddleware not working: {str(e)}"}

# Register all routers
app.include_router(auth_router)
app.include_router(images_router)
app.include_router(account_router)
app.include_router(admin_router)
app.include_router(support_router)
app.include_router(health_router)

# ----------- Custom Error Handlers -----------
@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    try:
        return FileResponse("public/404.html", status_code=404)
    except FileNotFoundError:
        return JSONResponse(
            status_code=404,
            content={"error": "Page not found", "detail": "The requested resource was not found"}
        )

@app.exception_handler(500)
async def custom_500_handler(request: Request, exc):
    logger.error(f"Internal Server Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "An unexpected error occurred."}
    )

# Vercel/production entrypoint (NO uvicorn.run here)
app_instance = app
