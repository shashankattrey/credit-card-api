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


@app.post("/users/")
async def create_or_get_user(user: UserCreate):
    try:
        with get_db() as cur:
            # Check existing user
            cur.execute("SELECT id FROM users WHERE phone = %s", (user.phone,))
            existing = cur.fetchone()

            if existing:
                return {
                    "user_id": existing[0],
                    "phone": user.phone,
                    "status": "existing_user",
                }

            # Create new user
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


# ✅ NEW ENDPOINT - THIS WAS MISSING!
@app.get("/users/{user_id}")
async def get_user_profile(user_id: int):
    try:
        with get_db() as cur:
            # Get user
            cur.execute("SELECT id, phone FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            # Get profile
            cur.execute(
                """
                SELECT full_name, pincode 
                FROM user_profiles 
                WHERE user_id = %s
            """,
                (user_id,),
            )
            profile = cur.fetchone()

            return {
                "user_id": user[0],
                "phone": user[1],
                "full_name": profile[0] if profile else None,  # ✅ "Shashank"
                "pincode": profile[1] if profile else None,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/debug/users")
async def list_users():
    with get_db() as cur:
        cur.execute("SELECT id, phone FROM users ORDER BY id")
        users = cur.fetchall()
        cur.execute(
            "SELECT up.user_id, up.full_name, up.pincode FROM user_profiles up ORDER BY up.user_id"
        )
        profiles = cur.fetchall()
    return {"users": users, "profiles": profiles}


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


@app.get("/personal-loans")
async def get_personal_loans(user_id: Optional[int] = None):
    try:
        with get_db() as cur:
            cur.execute(
                """
                SELECT 
                    'lender_' || p.id as id,
                    p.name as name,
                    CASE WHEN lp.max_amount >= 100000 THEN 
                        '₹ ' || (lp.min_amount/100000)::text || ' Lakhs'
                    ELSE '₹ ' || lp.min_amount::text END as loan_amount,
                    lp.interest_rate_min::float as interest,
                    lp.min_amount::float as amountNumber,
                    (lp.max_tenure_months/12)::float as tenureYears
                FROM products p
                JOIN loan_products lp ON p.id = lp.product_id
                JOIN personal_loan_details pld ON p.id = pld.product_id
                JOIN product_categories pc ON p.category_id = pc.id
                WHERE pc.code = 'personal_loan'
                ORDER BY p.display_priority DESC
            """
            )

            lenders = []
            for row in cur.fetchall():
                lender = {
                    "id": row[0],
                    "name": row[1],
                    "loan_amount": row[2],
                    "interest": float(row[3]),
                    "amountNumber": float(row[4]),
                    "tenureYears": float(row[5]),
                    "charges": {
                        "partPrepayment": "Allowed",
                        "processingFee": "1%",
                        "foreclosure": "Allowed",
                        "interestRate": f"{row[3]}%",
                        "apr": f"{row[3]+0.5}%",
                    },
                    "documents": ["Aadhaar", "PAN"],
                    "process": ["KYC", "Approval", "Disbursal"],
                    "key_facts": ["Instant approval"],
                    "cashback": 1000,
                }
                lenders.append(lender)

            return {"lenders": lenders}
    except Exception as e:
        print(f"🚨 ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    try:
        with get_db() as cur:
            cur.execute(
                """
                SELECT 
                    'lender_' || p.id as id,
                    p.name,
                    CASE 
                        WHEN lp.max_amount >= 100000 THEN 
                            '₹ ' || (lp.min_amount/100000)::text || ' Lakhs'
                        ELSE '₹ ' || lp.min_amount::text 
                    END as loan_amount,
                    jsonb_build_object(
                        'partPrepayment', pld.part_prepayment,
                        'processingFee', pld.processing_fee,
                        'foreclosure', pld.foreclosure,
                        'interestRate', pld.interest_rate,
                        'apr', pld.apr
                    ) as charges,
                    pld.documents,
                    pld.process_steps as process,
                    pld.key_facts,
                    lp.interest_rate_min::float as interest,
                    lp.min_amount::float as amountNumber,
                    (lp.max_tenure_months/12)::float as tenureYears,
                    1000 as cashback
                FROM products p
                JOIN loan_products lp ON p.id = lp.product_id
                JOIN personal_loan_details pld ON p.id = pld.product_id
                WHERE p.category_id = (SELECT id FROM product_categories WHERE code = 'personal_loan')
                ORDER BY p.display_priority DESC
            """
            )
            lenders = []
            for row in cur.fetchall():
                lenders.append(dict(row))
            return {"lenders": lenders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ Test endpoint
@app.get("/personal-loans/test")
async def test_personal_loans():
    return {"message": "14 lenders ready!", "endpoint": "GET /personal-loans"}
