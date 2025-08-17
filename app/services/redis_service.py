import redis
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from app.config import settings

class RedisService:
    def __init__(self):
        self.redis_client = None
        self.connect()
    
    def connect(self):
        try:
            redis_url = os.getenv("REDIS_URL")
            if redis_url:
                self.redis_client = redis.from_url(
                    redis_url, 
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True
                )
                # Test connection
                self.redis_client.ping()
                print("✅ Redis connected successfully")
            else:
                print("⚠️ No Redis URL provided")
        except Exception as e:
            print(f"⚠️ Redis connection failed: {e}")
            self.redis_client = None
    
    def ping(self) -> bool:
        try:
            if self.redis_client:
                self.redis_client.ping()
                return True
            return False
        except:
            return False
    
    def blacklist_token(self, token: str, expires_in_minutes: int = None) -> bool:
        """Add token to blacklist with expiration"""
        if not self.available:
            return False
        try:
            if expires_in_minutes is None:
                expires_in_minutes = settings.access_token_expire_minutes
            
            blacklist_data = {
                "blacklisted_at": datetime.now(timezone.utc).isoformat(),
                "reason": "user_logout"
            }
            
            expiry_seconds = expires_in_minutes * 60
            
            return self.redis_client.setex(
                f"blacklist:{token}", 
                expiry_seconds, 
                json.dumps(blacklist_data)
            )
        except Exception as e:
            print(f"Redis blacklist error: {e}")
            return False
    
    def is_token_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted"""
        if not self.available:
            return False
        try:
            result = self.redis_client.get(f"blacklist:{token}")
            return result is not None
        except Exception as e:
            print(f"Redis blacklist check error: {e}")
            return False
    
    def blacklist_all_user_tokens(self, user_id: str) -> bool:
        """Blacklist all tokens for a specific user"""
        if not self.available:
            return False
        try:
            user_logout_data = {
                "logged_out_at": datetime.now(timezone.utc).isoformat(),
                "reason": "user_logout_all_devices"
            }
            
            expiry_seconds = 24 * 60 * 60  # 24 hours
            
            return self.redis_client.setex(
                f"user_logout:{user_id}", 
                expiry_seconds, 
                json.dumps(user_logout_data)
            )
        except Exception as e:
            print(f"Redis user logout error: {e}")
            return False
    
    def get_user_logout_time(self, user_id: str) -> Optional[datetime]:
        """Get when user logged out from all devices"""
        if not self.available:
            return None
        try:
            result = self.redis_client.get(f"user_logout:{user_id}")
            if result:
                data = json.loads(result)
                return datetime.fromisoformat(data["logged_out_at"])
            return None
        except Exception:
            return None

# Global Redis instance
redis_service = RedisService()
