#The Fast Api is another alternative of flask. Fast Api is like Advanced version of Flask.The Fast Api automatically converts any thing to JSON files which webpages used to communicate
from fastapi import FastAPI
from app.config import settings
from app.database import Base,engine
from app.models.user import User
from fastapi import Depends, HTTPException, status,Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.schemas import UserCreate, UserOut
from app.auth.security import hash_password
from jose import JWTError,jwt
from app.auth.security import hash_password,verify_password,create_access_token,oauth2_scheme
from app.models.schemas import UserLogin,Token
from app.auth.google_oauth import oauth
from starlette.middleware.sessions import SessionMiddleware


Base.metadata.create_all(bind=engine)
app=FastAPI()


#---------------------------LOGIN-----------------------


@app.get('/auth/google/login')
async def google_login(request: Request):
    redirect_url=request.url_for("auth_google_callback")
    return await oauth.google.authorize_redirect(request,redirect_url)


@app.get("/auth/google/callback")
async def auth_google_callback(request:Request,db:Session=Depends(get_db)):
    token=await oauth.google.authorize_access_token(request)

    userinfo=token.get("userinfo")
    if userinfo is None:
        raise HTTPException(status_code=400,detail="Failed to retrive user info from Google")
    
    email=userinfo.get('email')
    username=userinfo.get("name") or email.split('@')[0]
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Create a new user without password since Google login
        user = User(
            email=email,
            username=username,
            hashed_password="google_oauth_no_password",  # placeholder
            credit_balance=10,
            is_active=True,
            is_admin=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Create your own JWT token for the app
    access_token = create_access_token(data={"sub": str(user.id)})

    # Return token and user info as JSON (or redirect to frontend with token)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "credit_balance": user.credit_balance,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
        },
    }



#--------------------------------------------------------


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