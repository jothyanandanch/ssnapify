#The Fast Api is another alternative of flask. Fast Api is like Advanced version of Flask.The Fast Api automatically converts any thing to JSON files which webpages used to communicate
from fastapi import FastAPI
from app.config import settings
from app.database import Base,engine
from app.models.user import User
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.schemas import UserCreate, UserOut
from app.auth.security import hash_password
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError,jwt
from app.auth.security import hash_password,verify_password,create_access_token,oauth2_scheme
from app.models.schemas import UserLogin,Token


Base.metadata.create_all(bind=engine)
app=FastAPI()


#---------------------------LOGIN-----------------------

@app.post('/login',response_model=Token,status_code=201)



@app.post('/users',response_model=UserOut, status_code=201)
def create_user(userdata:UserCreate,db:Session=Depends(get_db)):

    existing_email=db.query(User).filter(User.email==userdata.email).first()
    
    if existing_email:
        raise HTTPException(status_code=400,detail='Email Already registered')
    
    existing_username=db.query(User).filter(User.username==userdata.username).first()
    
    if existing_username:
        raise HTTPException(status_code=400,detail='Username Already registered')
    
    hashed_password=hash_password(userdata.password)
    new_user=User(email=userdata.email,username=userdata.username,hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get('/users',response_model=list[UserOut])
def list_users(db:Session=Depends(get_db)):
    users=db.query(User).order_by(User.id.asc()).all()
    return [UserOut.model_validate(user) for user in users]