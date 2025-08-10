#The Fast Api is another alternative of flask. Fast Api is like Advanced version of Flask.The Fast Api automatically converts any thing to JSON files which webpages used to communicate
from fastapi import FastAPI
from app.config import settings
from app.database import Base,engine
from app.models.user import User
from fastapi import Depends, HTTPException, status,Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.schemas import UserCreate, UserOut
from app.auth.security import hash_password,oauth2_scheme
from jose import JWTError,jwt
from app.auth.security import hash_password,verify_password,create_access_token,oauth2_scheme
from app.models.schemas import UserLogin,Token
from app.auth.google_oauth import oauth
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel,conint

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


def get_current_user(db:Session=Depends(get_db),token:str=Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    return user

def require_admin(current_user:User=Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403,detail="Admin Access Required")
    return current_user




@app.get('/users',response_model=list[UserOut])
def list_users(db:Session=Depends(get_db),current_admin:User=Depends(require_admin)):
    users=db.query(User).order_by(User.id.asc()).all()
    return [UserOut.model_validate(user) for user in users]





@app.get('/me',response_model=UserOut)
def read_me(current_user:User=Depends(get_current_user)):
    return current_user



#-----------------------------------ADMIN------------------------


@app.post("/admin/users/{user_id}/role")

#can set or remove admin role for any user
def set_admin_role(user_id:int,make_admin:bool,current_admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    user=db.query(User).filter(User.id==user_id).first()
    if not user:
        raise HTTPException(status_code=404,detail="User Not Found")
    user.is_admin=bool(make_admin)
    db.commit()
    db.refresh()
    return {"message":"Role Updated","user_id":user.id,"is_admin":user.is_admin}

@app.post("/admin/users/{user_id}/role")
def set_user_status(user_id:int,is_active:bool,current_admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    user=db.query(User).filter(User.id==user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = bool(is_active)
    db.commit(); db.refresh(user)
    return {"message": "Status updated",
            "user_id": user.id,
            "is_active": user.is_active}




@app.post("/admin/users/{user_id}/credits")
def set_user_credits(user_id: int, credits: int, current_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if credits < 0: raise HTTPException(status_code=400, detail="Credits cannot be negative")
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.credit_balance = int(credits)
    db.commit(); db.refresh(user)
    return {"message": "Credits updated", "user_id": user.id, "credit_balance": user.credit_balance}


def ensure_credits_or_admin(current_user: User, db: Session, cost: int):
    if current_user.is_admin:
        return  # Free usage
    if current_user.credit_balance < cost:
        raise HTTPException(status_code=402, detail="Not enough credits")
    current_user.credit_balance -= cost
    db.commit()