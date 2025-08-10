from pydantic import BaseModel,EmailStr
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    email:EmailStr
    username:str
    password:str
    
    #This doesnot affect the code but instead helps in documentation
    class Config:
        schema_extra={
            'example':{
                'email':'name@mail.com',
                'username':'TonyStark',
                'password':'MySecret123!'
            }
        }

class UserOut(BaseModel):
    id:int
    email:str
    username:str
    credit_balance:int
    plan_id:int
    is_active:bool
    is_admin:bool
    created_at:datetime

    class Config:
        from_attributes=True


class UserLogin(BaseModel):
    email:EmailStr
    password:str

class Token(BaseModel):
    access_token:str
    token_type:str='bearer'
    user:UserOut