# app/services/cloudinary_service.py

import cloudinary
import cloudinary.uploader
import cloudinary.api
from cloudinary import CloudinaryImage
import os
from typing import Optional, Dict, Any
from app.config import settings

class CloudinaryService:
    def __init__(self):
        # Configure Cloudinary with environment variables
        cloudinary.config(
            cloud_name = settings.cloudinary_cloud_name,
            api_key = settings.cloudinary_api_key,
            api_secret = settings.cloudinary_api_secret,
            secure = True
        )

    
    def upload_image(self, file_content: bytes, public_id: str, folder: str = "ssnapify", **options) -> Dict[str, Any]:
        """Upload an image to Cloudinary"""
        try:
            result = cloudinary.uploader.upload(
                file_content,
                public_id=public_id,
                folder=folder,
                resource_type="image",
                **options
            )
            return result
        except Exception as e:
            raise Exception(f"Cloudinary upload failed: {str(e)}")
    
    def destroy_image(self, public_id: str) -> Dict[str, Any]:
        """Delete an image from Cloudinary"""
        try:
            result = cloudinary.uploader.destroy(public_id)
            return result
        except Exception as e:
            raise Exception(f"Cloudinary delete failed: {str(e)}")
    
    def apply_transformation(self, public_id: str, transformation: Dict[str, Any]) -> str:
        """Apply transformation to an image and return the URL"""
        try:
            transformed_image = CloudinaryImage(public_id).build_url(**transformation)
            return transformed_image
        except Exception as e:
            raise Exception(f"Cloudinary transformation failed: {str(e)}")
    
    def get_image_info(self, public_id: str) -> Dict[str, Any]:
        """Get information about an image"""
        try:
            result = cloudinary.api.resource(public_id)
            return result
        except Exception as e:
            raise Exception(f"Failed to get image info: {str(e)}")

# Create the instance that will be imported
cloudinary_service = CloudinaryService()
