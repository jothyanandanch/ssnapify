#Reads Environment Variables and validates them
from pydantic_settings import BaseSettings,SettingsConfigDict

#If any variable is not needed it can be marked as Optional using this Keyword
from typing import Optional

class Settings(BaseSettings):
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    #Accepts Database settings from .env file

    database_url:str
    postgres_user:str
    postgres_password:str
    postgres_db:str

    #Security Settings
    secret_key:str
    algorithm:str='HS256'
    access_token_expire_minutes:int=60


settings=Settings()