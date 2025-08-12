from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, Dict, Any, List

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "name@mail.com",
                "username": "TonyStark",
                "password": "MySecret123!",
            }
        }

class UserOut(BaseModel):
    id: int
    email: str
    username: str
    credit_balance: int
    plan_id: int
    is_active: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ImageOut(BaseModel):
    id: int
    user_id: int
    public_id: str          # Cloudinary public_id is a string
    secure_url: str
    title: Optional[str]
    transformation_type: Optional[str]
    config: Optional[Dict[str, Any] | List[Dict[str, Any]]]
    created_at: datetime

    class Config:
        from_attributes = True
