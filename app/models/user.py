from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
       
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    credit_balance = Column(Integer, default=10)

    plan_id = Column(Integer, default=1)
    plan_started_at = Column(DateTime(timezone=True), nullable=True)
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)
    billing_anchor_utc = Column(DateTime(timezone=True), nullable=True)
    last_credit_reset_at = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())