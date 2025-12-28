from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
import os

app = FastAPI(title="PaisaDekho API v1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory "database" (persists during deploy)
users_db: Dict[str, int] = {}
profiles_db: Dict[int, dict] = {}


class UserCreate(BaseModel):
    phone: str
    email: Optional[str] = None


@app.post("/debug/users/")
async def create_or_get_user(user: UserCreate):
    if user.phone in users_db:
        return {
            "user_id": users_db[user.phone],
            "phone": user.phone,
            "status": "existing_user",
        }

    user_id = len(users_db) + 1
    users_db[user.phone] = user_id
    return {"user_id": user_id, "phone": user.phone, "status": "new_user_created"}


class UserProfile(BaseModel):
    full_name: str
    pincode: Optional[str] = None


@app.post("/users/{user_id}/profile")
async def save_profile(user_id: int, profile: UserProfile):
    profiles_db[user_id] = {"full_name": profile.full_name, "pincode": profile.pincode}
    return {"status": "profile_saved"}


@app.get("/users/{user_id}")
async def get_user(user_id: int):
    profile = profiles_db.get(user_id)
    return {
        "user_id": user_id,
        "full_name": profile["full_name"] if profile else None,
        "pincode": profile["pincode"] if profile else None,
    }


@app.get("/")
async def root():
    return {"message": "PaisaDekho API LIVE ✅", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
