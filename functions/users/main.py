from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psycopg
from contextlib import contextmanager
import os

app = FastAPI(title="PaisaDekho API v1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_db():
    conn = psycopg.connect(DATABASE_URL)
    try:
        yield conn.cursor()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class UserCreate(BaseModel):
    phone: str


class UserProfile(BaseModel):
    full_name: str
    pincode: Optional[str] = None


@app.post("/users/")
async def create_or_get_user(user: UserCreate):
    try:
        with get_db() as cur:
            cur.execute("SELECT id FROM users WHERE phone = %s", (user.phone,))
            existing = cur.fetchone()
            if existing:
                return {
                    "user_id": existing[0],
                    "phone": user.phone,
                    "status": "existing_user",
                }
            cur.execute(
                "INSERT INTO users (phone) VALUES (%s) RETURNING id", (user.phone,)
            )
            user_id = cur.fetchone()[0]
            return {
                "user_id": user_id,
                "phone": user.phone,
                "status": "new_user_created",
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/{user_id}")
async def get_user_profile(user_id: int):
    try:
        with get_db() as cur:
            cur.execute("SELECT id, phone FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            cur.execute(
                "SELECT full_name, pincode FROM user_profiles WHERE user_id = %s",
                (user_id,),
            )
            profile = cur.fetchone()
            return {
                "user_id": user[0],
                "phone": user[1],
                "full_name": profile[0] if profile else None,
                "pincode": profile[1] if profile else None,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/users/{user_id}/profile")
async def save_profile(user_id: int, profile: UserProfile):
    with get_db() as cur:
        cur.execute(
            """
            INSERT INTO user_profiles (user_id, full_name, pincode) 
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                pincode = EXCLUDED.pincode
        """,
            (user_id, profile.full_name, profile.pincode),
        )
    return {"status": "profile_saved"}


@app.get("/")
async def root():
    return {"message": "PaisaDekho API + Neon DB LIVE ✅"}


@app.get("/health")
async def health():
    try:
        with get_db() as cur:
            cur.execute("SELECT 1")
        return {"status": "healthy"}
    except:
        return {"status": "db_error"}
