from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.billing.timeutils import now_utc
from app.billing.resets import handle_expiration, apply_monthly_reset

def reset_all_users():
    """
    Run expirations and resets for all users.
    For large datasets, switch to batched queries or SQL UPDATEs.
    """
    db: Session = SessionLocal()
    try:
        current = now_utc()
        # Simple approach: iterate. For scale, paginate by primary key ranges.
        users = db.query(User).all()
        any_changes = False
        for user in users:
            changed = False
            # 1) Expiration check (flip to free if expired)
            if handle_expiration(user, current):
                changed = True
            # 2) Reset check (free or paid cycle)
            if apply_monthly_reset(user, current):
                changed = True
            if changed:
                any_changes = True
        if any_changes:
            db.commit()
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler(timezone="UTC")  # ensure UTC schedule
    # Run at 00:05 UTC every day (handle all resets/expirations that became due)
    scheduler.add_job(reset_all_users, CronTrigger(hour=0, minute=5, timezone="UTC"))
    scheduler.start()
