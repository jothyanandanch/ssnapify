# app/billing/enforce.py
from fastapi import HTTPException
from app.models.user import User
from sqlalchemy.orm import Session

def ensure_credits_or_admin(current_user: User, db: Session, cost: int):
    if current_user.is_admin:
        return
    if current_user.credit_balance < cost:
        raise HTTPException(status_code=402, detail="Not enough credits")
    current_user.credit_balance -= cost
    db.commit()