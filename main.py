from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
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

# Replace DATABASE_URL with your Render Postgres URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/db")


@contextmanager
def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn.cursor(cursor_factory=RealDictCursor)
        conn.commit()
    except:
        conn.rollback()
    finally:
        conn.close()


class UserCreate(BaseModel):
    phone: str
    email: Optional[str] = None


@app.post("/users/")
async def create_or_get_user(user: UserCreate):
    with get_db() as cur:
        cur.execute("SELECT id, phone FROM users WHERE phone = %s", (user.phone,))
        existing = cur.fetchone()

        if existing:
            return {
                "user_id": int(existing["id"]),
                "phone": existing["phone"],
                "status": "existing_user",
            }

        cur.execute(
            "INSERT INTO users (phone, email) VALUES (%s, %s) RETURNING id",
            (user.phone, user.email),
        )
        user_id = cur.fetchone()["id"]

        return {
            "user_id": int(user_id),
            "phone": user.phone,
            "status": "new_user_created",
        }


class UserProfile(BaseModel):
    full_name: str
    pincode: Optional[str] = None


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
    return {"message": "PaisaDekho API LIVE ✅", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
