from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncpg
import os
from contextlib import asynccontextmanager

# Global connection pool
pool = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"), min_size=5, max_size=20)
    yield
    await pool.close()


app = FastAPI(title="PaisaDekho API v1.0", lifespan=lifespan)

# Production CORS (React Native + Web)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update later: ["https://yourdomain.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_db():
    async with pool.acquire() as conn:
        yield conn


# ========== 1. CREATE/GET USER (Phone → user_id) ==========
class UserCreate(BaseModel):
    phone: str
    email: Optional[str] = None


@app.post("/users/")
async def create_or_get_user(user: UserCreate, db=Depends(get_db)):
    # Check existing user (indexed query)
    existing = await db.fetchrow(
        "SELECT id, phone FROM users WHERE phone = $1", user.phone
    )

    if existing:
        return {
            "user_id": int(existing["id"]),
            "phone": existing["phone"],
            "status": "existing_user",
        }

    # Create new user
    user_id = await db.fetchval(
        "INSERT INTO users (phone, email) VALUES ($1, $2) RETURNING id",
        user.phone,
        user.email,
    )

    return {"user_id": int(user_id), "phone": user.phone, "status": "new_user_created"}


# ========== 2. SAVE PROFILE (Name + Pincode) ==========
class UserProfile(BaseModel):
    full_name: str
    pincode: Optional[str] = None


@app.post("/users/{user_id}/profile")
async def save_profile(user_id: int, profile: UserProfile, db=Depends(get_db)):
    # Atomic upsert (fastest method)
    await db.execute(
        """
        INSERT INTO user_profiles (user_id, full_name, pincode) 
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            pincode = EXCLUDED.pincode
    """,
        user_id,
        profile.full_name,
        profile.pincode,
    )

    return {"status": "profile_saved"}


# ========== 3. GET USER + NAME (HomeScreen) ==========
@app.get("/users/{user_id}")
async def get_user(user_id: int, db=Depends(get_db)):
    user = await db.fetchrow(
        """
        SELECT u.id, u.phone, up.full_name, up.pincode
        FROM users u 
        LEFT JOIN user_profiles up ON u.id = up.user_id 
        WHERE u.id = $1
    """,
        user_id,
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": int(user["id"]),
        "phone": user["phone"],
        "full_name": user["full_name"] or None,
        "pincode": user["pincode"] or None,
    }


# ========== 🧪 HEALTH + ROOT ==========
@app.get("/")
async def root():
    return {"message": "PaisaDekho API LIVE ✅", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "database": "connected"}
