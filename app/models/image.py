from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.models.base import Base  # Import from base.py

class Image(Base):
    __tablename__ = 'images'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    public_id = Column(String, nullable=False)  # Cloudinary ID
    secure_url = Column(String, nullable=False)
    title = Column(String, nullable=True)
    transformation_type = Column(String, nullable=True)  # e.g., 'restore', 'remove_bg'
    config = Column(JSON, nullable=True)  # Parameters/config.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
