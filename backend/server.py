from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, Header
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import shutil
import zipfile
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import uvicorn
import os
import sys
import time
import logging
import asyncio
import traceback
import uuid
import httpx
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# Create the main app
app = FastAPI(title="Final Message API")
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------
# BACKUP SYSTEM SETUP (Automatic & Redundant Data Storage)
# ---------------------------------------------------------
BACKUP_DIR = ROOT_DIR / "backups"
BACKUP_UPLOADS_DIR = BACKUP_DIR / "uploads"
BACKUP_MESSAGES_DIR = BACKUP_DIR / "messages"
BACKUP_DATABASE_DIR = BACKUP_DIR / "database"

BACKUP_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_MESSAGES_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DATABASE_DIR.mkdir(parents=True, exist_ok=True)

import json
import shutil

async def backup_message_to_file(message_dict: dict):
    """Saves a standalone copy of the message (including encrypted payload) to backups/messages/."""
    try:
        msg_id = message_dict.get("_id") or str(uuid.uuid4())
        backup_file = BACKUP_MESSAGES_DIR / f"msg_backup_{msg_id}.json"
        
        serializable_msg = {}
        for k, v in message_dict.items():
            if isinstance(v, datetime):
                serializable_msg[k] = v.isoformat()
            elif isinstance(v, ObjectId):
                serializable_msg[k] = str(v)
            else:
                serializable_msg[k] = v
                
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump(serializable_msg, f, ensure_ascii=False, indent=2)
            
        content = message_dict.get("encrypted_content", "")
        if isinstance(content, str) and content.startswith("data:"):
            media_backup_file = BACKUP_UPLOADS_DIR / f"msg_media_{msg_id}.bin"
            with open(media_backup_file, "w", encoding="utf-8") as f_media:
                f_media.write(content)
    except Exception as e:
        logging.getLogger(__name__).error(f"Error making message backup: {e}")

class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, ObjectId):
            return str(o)
        return super().default(o)

async def perform_full_database_backup() -> dict:
    """Creates a complete JSON snapshot of all database collections and uploads directory, then archives to .zip."""
    try:
        now_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        snapshot_id = f"db_snapshot_{now_str}"
        snapshot_dir = BACKUP_DATABASE_DIR / snapshot_id
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        
        # 1. Export all database collections to JSON
        collections = await db.list_collection_names()
        stats_summary = {}
        
        for coll_name in collections:
            docs = await db[coll_name].find({}).to_list(100000)
            coll_file = snapshot_dir / f"{coll_name}.json"
            with open(coll_file, "w", encoding="utf-8") as f:
                f.write(json.dumps(docs, cls=MongoJSONEncoder, ensure_ascii=False, indent=2))
            stats_summary[coll_name] = len(docs)

        # 2. Copy uploads folder (audio, video, images, attachments) if present
        uploads_backup_dir = snapshot_dir / "uploads"
        media_files_count = 0
        if UPLOAD_DIR.exists():
            uploads_backup_dir.mkdir(parents=True, exist_ok=True)
            for item in UPLOAD_DIR.rglob("*"):
                if item.is_file():
                    rel_path = item.relative_to(UPLOAD_DIR)
                    dest_file = uploads_backup_dir / rel_path
                    dest_file.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(item, dest_file)
                    media_files_count += 1

        # 3. Create zip archive
        zip_path = BACKUP_DATABASE_DIR / f"{snapshot_id}.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(snapshot_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, snapshot_dir)
                    zipf.write(file_path, arcname)

        zip_size_bytes = zip_path.stat().st_size if zip_path.exists() else 0
        zip_size_mb = round(zip_size_bytes / (1024 * 1024), 2)

        backup_record = {
            "snapshot_id": snapshot_id,
            "timestamp": datetime.utcnow().isoformat(),
            "collections": stats_summary,
            "media_files_count": media_files_count,
            "size_bytes": zip_size_bytes,
            "size_mb": zip_size_mb,
            "path": str(zip_path)
        }

        # Store in DB without mutating ObjectId in returned dict
        rec_to_insert = dict(backup_record)
        res = await db.system_backups.insert_one(rec_to_insert)
        backup_record["_id"] = str(res.inserted_id)

        logging.getLogger(__name__).info(f"Full system backup (DB + Media) completed: {snapshot_id}")
        return backup_record
    except Exception as e:
        logging.getLogger(__name__).error(f"Error performing database backup: {e}")
        raise e

# ---------------------------------------------------------
# LOGGING SETUP (Winston & Morgan Style Dual-File Logging)
# ---------------------------------------------------------
LOGS_DIR = ROOT_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

access_log_file = LOGS_DIR / "access.log"
error_log_file = LOGS_DIR / "error.log"

# Access Logger (Morgan style HTTP Request Logger)
access_logger = logging.getLogger("access_logger")
access_logger.setLevel(logging.INFO)
access_logger.propagate = False

if not access_logger.handlers:
    access_file_handler = logging.FileHandler(access_log_file, encoding="utf-8")
    access_file_formatter = logging.Formatter("[%(asctime)s] %(message)s")
    access_file_handler.setFormatter(access_file_formatter)
    access_logger.addHandler(access_file_handler)
    
    access_console_handler = logging.StreamHandler(sys.stdout)
    access_console_handler.setFormatter(access_file_formatter)
    access_logger.addHandler(access_console_handler)

# Error Logger (Winston style Exception & Error Logger)
error_logger = logging.getLogger("error_logger")
error_logger.setLevel(logging.WARNING)
error_logger.propagate = False

if not error_logger.handlers:
    error_file_handler = logging.FileHandler(error_log_file, encoding="utf-8")
    error_file_formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")
    error_file_handler.setFormatter(error_file_formatter)
    error_logger.addHandler(error_file_handler)
    
    error_console_handler = logging.StreamHandler(sys.stderr)
    error_console_handler.setFormatter(error_file_formatter)
    error_logger.addHandler(error_console_handler)


# ---------------------------------------------------------
# REQUEST LOGGER MIDDLEWARE (Morgan Style)
# ---------------------------------------------------------
@app.middleware("http")
async def morgan_request_logger(request: Request, call_next):
    start_time = time.time()
    
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    
    method = request.method
    url_path = request.url.path
    
    user_info = "Anonymous"
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_signature": False})
            user_info = payload.get("sub") or "User"
        except Exception:
            user_info = "TokenUser"
            
    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    status_code = response.status_code
    
    log_msg = f"IP: {client_ip} | Method: {method} | Path: {url_path} | Status: {status_code} | Duration: {process_time:.2f}ms | User: {user_info}"
    access_logger.info(log_msg)
    
    return response


# ---------------------------------------------------------
# ERROR LOGGER EXCEPTION HANDLERS (Winston Style)
# ---------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    body_str = ""
    try:
        body = await request.body()
        body_str = body.decode("utf-8") if body else ""
    except Exception:
        body_str = "Could not read body"

    error_msg = (
        f"[VALIDATION ERROR 422] Path: {request.url.path} | Method: {request.method} | "
        f"Validation Details: {errors} | Payload: {body_str}"
    )
    error_logger.warning(error_msg)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors, "message": "Validation Error", "error": str(errors)}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    level = logging.ERROR if exc.status_code >= 500 else logging.WARNING
    error_msg = (
        f"[HTTP {exc.status_code}] Path: {request.url.path} | Method: {request.method} | "
        f"Detail: {exc.detail}"
    )
    error_logger.log(level, error_msg)
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "message": exc.detail, "error": str(exc.detail)},
        headers=getattr(exc, "headers", None)
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    error_msg = (
        f"[500 INTERNAL SERVER ERROR] Path: {request.url.path} | Method: {request.method} | "
        f"Exception: {str(exc)}\nStack Trace:\n{tb}"
    )
    error_logger.error(error_msg)
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Sunucu içi beklenmeyen bir hata oluştu", "message": "Internal Server Error", "error": str(exc)}
    )

# Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def check_user_subscription_expiry(user: dict) -> dict:
    if not user:
        return user
    expiry = user.get("subscription_expiry")
    if expiry:
        if expiry.tzinfo is not None:
            expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
        if datetime.utcnow() > expiry:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "subscription_tier": "free",
                    "subscription_status": "inactive",
                    "subscription_expiry": None,
                    "updated_at": datetime.utcnow()
                }}
            )
            user["subscription_tier"] = "free"
            user["subscription_status"] = "inactive"
            user["subscription_expiry"] = None
    return user

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Supports both JWT tokens (email/password login) and session_tokens (Google login)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")
    
    token = authorization.replace("Bearer ", "").strip()
    
    # First, try session_token (Google auth)
    session = await db.user_sessions.find_one({"session_token": token})
    if session:
        expires_at = session.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at and expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"user_id": session["user_id"]})
        if user:
            return await check_user_subscription_expiry(user)
    
    # Fall back to JWT (email/password auth)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return await check_user_subscription_expiry(user)

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class SubscriptionPlan(BaseModel):
    name: str
    price: float
    max_recipients: int
    max_messages: int
    allowed_types: List[str]
    features: List[str]
    is_active: bool = True
    discount_percentage: float = 0

class MessageCreate(BaseModel):
    recipient_id: str
    message_type: Literal["text", "audio", "video"]
    content: str  # For text or base64 encoded audio/video
    encryption_password: str
    delivery_mode: Optional[Literal["checkin_based", "scheduled_date"]] = "checkin_based"
    scheduled_at: Optional[datetime] = None
    delivery_channel: Optional[Literal["email", "sms", "both"]] = "both"

class AvatarUpdate(BaseModel):
    picture: str

class RecipientCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    relation: str

class RecipientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    relation: Optional[str] = None

class CheckInResponse(BaseModel):
    success: bool
    message: str
    last_checkin: datetime
    streak: int

class SubscribeRequest(BaseModel):
    plan_name: str
    campaign_code: Optional[str] = None

class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: str
    permissions: dict

class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[dict] = None

class StaffPasswordReset(BaseModel):
    password: str

class PlanPricing(BaseModel):
    price: float
    currency: str
    payment_methods: List[str]

class PlanUpdate(BaseModel):
    display_name: Optional[str] = None
    price: Optional[float] = None
    max_recipients: Optional[int] = None
    max_messages: Optional[int] = None
    allowed_types: Optional[List[str]] = None
    features: Optional[List[str]] = None
    country_pricing: Optional[dict] = None
    payment_methods: Optional[List[str]] = None
    billing_cycle: Optional[str] = None

class PlanCreate(BaseModel):
    name: str
    display_name: str
    price: float
    max_recipients: int
    max_messages: int
    allowed_types: List[str]
    features: List[str]
    country_pricing: Optional[dict] = {}
    payment_methods: Optional[List[str]] = ["credit_card"]
    billing_cycle: Optional[str] = "yearly"

class CampaignCreate(BaseModel):
    code: str
    discount_percentage: int
    is_active: bool = True

class CampaignUpdate(BaseModel):
    discount_percentage: Optional[int] = None
    is_active: Optional[bool] = None

class PaymentConfigUpdate(BaseModel):
    fields: dict
    is_active: bool = True

class PushTokenRegister(BaseModel):
    push_token: str

class ValidatePromoRequest(BaseModel):
    code: str

# New Pydantic Models for Points & Referrals
class PackageCreate(BaseModel):
    name: str
    display_name: str
    points_cost: int
    description: str
    benefit_type: str
    benefit_value: int

class PackageUpdate(BaseModel):
    display_name: Optional[str] = None
    points_cost: Optional[int] = None
    description: Optional[str] = None
    benefit_value: Optional[int] = None

class SubmitReferralRequest(BaseModel):
    referral_code: str

class ProfileRequestCreate(BaseModel):
    field: Literal["email", "phone"]
    new_value: str
    reason: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class TicketCreate(BaseModel):
    name: str
    phone: str
    subject: str
    description: str
    base64_image: Optional[str] = None

class TicketReply(BaseModel):
    content: str

class TicketStatusUpdate(BaseModel):
    status: Literal["open", "closed"]


# Helpers for Referrals and Code generation
def generate_referral_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def process_referral(new_user_id: str, referral_code_str: str):
    referrer = await db.users.find_one({"referral_code": referral_code_str})
    if not referrer:
        return False
    
    if referrer["user_id"] == new_user_id:
        return False
        
    new_user = await db.users.find_one({"user_id": new_user_id})
    if not new_user or new_user.get("referred_by"):
        return False
    
    referrer_referrals = referrer.get("referrals", [])
    num_referrals = len(referrer_referrals)
    
    points_to_award = 15
    if num_referrals == 4: # This is the 5th referral
        points_to_award = 100
    
    referral_entry = {
        "user_id": new_user_id,
        "full_name": new_user.get("full_name", ""),
        "points_awarded": points_to_award,
        "created_at": datetime.utcnow()
    }
    
    await db.users.update_one(
        {"user_id": referrer["user_id"]},
        {
            "$push": {"referrals": referral_entry},
            "$inc": {"symi_points": points_to_award}
        }
    )
    
    await db.users.update_one(
        {"user_id": new_user_id},
        {
            "$set": {
                "referred_by": referrer["user_id"],
                "referral_eligible": False
            }
        }
    )
    return True

# Health Check
@api_router.get("/health")
async def health_check():
    """Health check endpoint to verify server is running and MongoDB is accessible."""
    try:
        await db.command("ping")
        return {"status": "healthy", "database": "connected", "version": "1.2.0"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

# Auth Routes
@api_router.post("/auth/register", response_model=TokenResponse)
@api_router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    try:
        # Check if user exists
        existing_email = await db.users.find_one({"email": user_data.email})
        if existing_email:
            error_logger.warning(f"[REGISTRATION FAILURE 400] Email already registered: {user_data.email}")
            raise HTTPException(status_code=400, detail="Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var. Lütfen farklı bir e-posta adresi girin.")
        
        existing_phone = await db.users.find_one({"phone": user_data.phone})
        if existing_phone:
            error_logger.warning(f"[REGISTRATION FAILURE 400] Phone already registered: {user_data.phone}")
            raise HTTPException(status_code=400, detail="Bu telefon numarası ile kayıtlı bir kullanıcı zaten var. Lütfen farklı bir telefon numarası girin.")
        
        # Generate unique referral code
        while True:
            ref_code = generate_referral_code()
            dup = await db.users.find_one({"referral_code": ref_code})
            if not dup:
                break

        # Create user
        hashed_password = get_password_hash(user_data.password)
        user_dict = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": user_data.email,
            "password_hash": hashed_password,
            "full_name": user_data.full_name,
            "phone": user_data.phone,
            "role": "user",
            "auth_provider": "email",
            "subscription_tier": "free",
            "subscription_status": "active",
            "subscription_expiry": None,
            "last_checkin": datetime.utcnow(),
            "consecutive_missed_days": 0,
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "symi_points": 0,
            "referral_code": ref_code,
            "referrals": [],
            "referred_by": None,
            "referral_eligible": False,
            "extra_recipients": 0,
            "last_password_change": datetime.utcnow()
        }
        
        result = await db.users.insert_one(user_dict)
        user_dict["_id"] = str(result.inserted_id)
        
        # Process referral if provided
        if user_data.referral_code:
            await process_referral(user_dict["user_id"], user_data.referral_code)
            # Fetch updated user object
            updated_user = await db.users.find_one({"user_id": user_dict["user_id"]})
            if updated_user:
                user_dict = updated_user
                user_dict["_id"] = str(user_dict["_id"])

        # Create token
        access_token = create_access_token(data={"sub": user_data.email})
        
        # Remove password hash from response
        if "password_hash" in user_dict:
            del user_dict["password_hash"]
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_dict
        }
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        error_logger.error(f"[REGISTRATION EXCEPTION 500] Email: {user_data.email} | Error: {str(e)}\n{tb}")
        raise HTTPException(status_code=500, detail=f"Kayıt işlemi sırasında bir hata oluştu: {str(e)}")

@api_router.post("/auth/google/session")
async def google_session(request: Request):
    """Accept session_id from mobile client, verify with Emergent, and create/upsert user."""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    # Verify with Emergent auth service
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            resp = await http_client.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": session_id}
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=401, detail=f"Invalid session: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Auth verification failed: {str(e)}")
    
    email = data.get("email")
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data.get("session_token")
    
    if not email or not session_token:
        raise HTTPException(status_code=500, detail="Invalid response from auth service")
    
    # Upsert user by email
    existing_user = await db.users.find_one({"email": email})
    
    if existing_user:
        user_id = existing_user.get("user_id")
        # Ensure user_id exists for older accounts
        if not user_id:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.update_one(
                {"email": email},
                {"$set": {"user_id": user_id, "picture": picture, "updated_at": datetime.utcnow()}}
            )
        else:
            await db.users.update_one(
                {"email": email},
                {"$set": {"picture": picture, "updated_at": datetime.utcnow()}}
            )
        user = await db.users.find_one({"email": email})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        # Generate unique referral code
        while True:
            ref_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            dup = await db.users.find_one({"referral_code": ref_code})
            if not dup:
                break
        user_dict = {
            "user_id": user_id,
            "email": email,
            "full_name": name,
            "picture": picture,
            "phone": "",
            "role": "user",
            "auth_provider": "google",
            "subscription_tier": "free",
            "subscription_status": "active",
            "subscription_expiry": None,
            "last_checkin": datetime.utcnow(),
            "consecutive_missed_days": 0,
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "symi_points": 0,
            "referral_code": ref_code,
            "referrals": [],
            "referred_by": None,
            "referral_eligible": True,
            "extra_recipients": 0,
            "last_password_change": datetime.utcnow()
        }
        await db.users.insert_one(user_dict)
        user = user_dict
    
    # Store session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {
            "$set": {
                "session_token": session_token,
                "user_id": user_id,
                "expires_at": expires_at,
                "created_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # Prepare response - exclude sensitive fields
    user_response = {k: v for k, v in user.items() if k not in ["_id", "password_hash"]}
    if isinstance(user_response.get("created_at"), datetime):
        user_response["created_at"] = user_response["created_at"].isoformat()
    if isinstance(user_response.get("last_checkin"), datetime):
        user_response["last_checkin"] = user_response["last_checkin"].isoformat()
    if isinstance(user_response.get("updated_at"), datetime):
        user_response["updated_at"] = user_response["updated_at"].isoformat()
    
    # Check for approved requests
    approved_reqs = await db.profile_requests.find({
        "user_id": user_response["user_id"],
        "status": "approved"
    }).to_list(100)
    user_response["approved_requests"] = [
        {"request_id": r["request_id"], "field": r["field"], "new_value": r["new_value"]}
        for r in approved_reqs
    ]

    return {
        "session_token": session_token,
        "user": user_response,
        "is_new_user": not existing_user
    }

class GoogleRegisterRequest(BaseModel):
    session_id: str
    phone: str
    password: str
    referral_code: Optional[str] = None

@api_router.post("/auth/google/register", response_model=TokenResponse)
async def google_register(data: GoogleRegisterRequest):
    """Register a new user using Google session + phone + password."""
    # Verify session with Emergent auth service
    async with httpx.AsyncClient(timeout=10.0) as http_client:
        try:
            resp = await http_client.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": data.session_id}
            )
            resp.raise_for_status()
            google_data = resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=401, detail=f"Invalid session: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Auth verification failed: {str(e)}")
    
    email = google_data.get("email")
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")
    
    if not email:
        raise HTTPException(status_code=500, detail="Could not retrieve email from Google")
    
    # Check if user already exists
    existing_email = await db.users.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var.")
    
    existing_phone = await db.users.find_one({"phone": data.phone})
    if existing_phone:
        raise HTTPException(status_code=400, detail="Bu telefon numarası ile kayıtlı bir kullanıcı zaten var.")
    
    # Generate unique referral code
    while True:
        ref_code = generate_referral_code()
        dup = await db.users.find_one({"referral_code": ref_code})
        if not dup:
            break
    
    # Create user with Google info + phone + password
    hashed_password = get_password_hash(data.password)
    user_dict = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "password_hash": hashed_password,
        "full_name": name,
        "phone": data.phone,
        "picture": picture,
        "role": "user",
        "auth_provider": "google",
        "subscription_tier": "free",
        "subscription_status": "active",
        "subscription_expiry": None,
        "last_checkin": datetime.utcnow(),
        "consecutive_missed_days": 0,
        "status": "active",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "symi_points": 0,
        "referral_code": ref_code,
        "referrals": [],
        "referred_by": None,
        "referral_eligible": False,
        "extra_recipients": 0,
        "last_password_change": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    
    # Process referral if provided
    if data.referral_code:
        await process_referral(user_dict["user_id"], data.referral_code)
        updated_user = await db.users.find_one({"user_id": user_dict["user_id"]})
        if updated_user:
            user_dict = updated_user
            user_dict["_id"] = str(user_dict["_id"])
    
    # Create JWT token
    access_token = create_access_token(data={"sub": email})
    
    # Remove sensitive data from response
    if "password_hash" in user_dict:
        del user_dict["password_hash"]
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_dict
    }

@api_router.get("/auth/me")
async def auth_me(current_user: dict = Depends(get_current_user)):
    """Verify current session and return user info."""
    user_response = {k: v for k, v in current_user.items() if k not in ["password_hash"]}
    if "_id" in user_response:
        user_response["_id"] = str(user_response["_id"])
    if isinstance(user_response.get("created_at"), datetime):
        user_response["created_at"] = user_response["created_at"].isoformat()
    if isinstance(user_response.get("last_checkin"), datetime):
        user_response["last_checkin"] = user_response["last_checkin"].isoformat()
    if isinstance(user_response.get("updated_at"), datetime):
        user_response["updated_at"] = user_response["updated_at"].isoformat()
        
    approved_reqs = await db.profile_requests.find({
        "user_id": user_response["user_id"],
        "status": "approved"
    }).to_list(100)
    user_response["approved_requests"] = [
        {"request_id": r["request_id"], "field": r["field"], "new_value": r["new_value"]}
        for r in approved_reqs
    ]
    return user_response

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Delete session token from database."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"success": True, "message": "Logged out successfully"}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not user.get("password_hash") or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Ensure user has user_id (backfill for older accounts)
    if not user.get("user_id"):
        new_user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.update_one({"email": user_data.email}, {"$set": {"user_id": new_user_id}})
        user["user_id"] = new_user_id
    
    # Create token
    access_token = create_access_token(data={"sub": user_data.email})
    
    # Convert ObjectId to string
    user["_id"] = str(user["_id"])
    del user["password_hash"]
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

# User Routes
@api_router.get("/users/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    user_response = {k: v for k, v in current_user.items() if k not in ["password_hash"]}
    if "_id" in user_response:
        user_response["_id"] = str(user_response["_id"])
    if isinstance(user_response.get("created_at"), datetime):
        user_response["created_at"] = user_response["created_at"].isoformat()
    if isinstance(user_response.get("last_checkin"), datetime):
        user_response["last_checkin"] = user_response["last_checkin"].isoformat()
    if isinstance(user_response.get("updated_at"), datetime):
        user_response["updated_at"] = user_response["updated_at"].isoformat()
        
    approved_reqs = await db.profile_requests.find({
        "user_id": user_response["user_id"],
        "status": "approved"
    }).to_list(100)
    user_response["approved_requests"] = [
        {"request_id": r["request_id"], "field": r["field"], "new_value": r["new_value"]}
        for r in approved_reqs
    ]
    return user_response

@api_router.put("/users/me")
@api_router.patch("/users/me")
@app.put("/api/users/me")
@app.patch("/api/users/me")
async def update_user_profile(payload: dict, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if "picture" in payload:
        update_data["picture"] = payload["picture"]
    if "full_name" in payload:
        update_data["full_name"] = payload["full_name"]
    update_data["updated_at"] = datetime.utcnow()

    await db.users.update_one({"_id": current_user["_id"]}, {"$set": update_data})
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    if updated_user:
        updated_user["_id"] = str(updated_user["_id"])
        if "password_hash" in updated_user:
            del updated_user["password_hash"]
        return updated_user
    return current_user

@api_router.post("/users/avatar")
@api_router.post("/users/me/avatar")
@app.post("/api/users/avatar")
@app.post("/users/avatar")
async def upload_avatar(avatar_data: AvatarUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"picture": avatar_data.picture, "updated_at": datetime.utcnow()}}
    )
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    if updated_user:
        updated_user["_id"] = str(updated_user["_id"])
        if "password_hash" in updated_user:
            del updated_user["password_hash"]
        return updated_user
    raise HTTPException(status_code=400, detail="Avatar güncellenemedi")

@api_router.delete("/users/avatar")
@api_router.delete("/users/me/avatar")
@app.delete("/api/users/avatar")
@app.delete("/users/avatar")
async def delete_avatar(current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$unset": {"picture": ""}, "$set": {"updated_at": datetime.utcnow()}}
    )
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    if updated_user:
        updated_user["_id"] = str(updated_user["_id"])
        if "password_hash" in updated_user:
            del updated_user["password_hash"]
        return updated_user
    raise HTTPException(status_code=400, detail="Avatar silinemedi")

@api_router.post("/users/checkin", response_model=CheckInResponse)
async def check_in(current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    
    # Update user's last check-in and award 1 point
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "last_checkin": now,
                "consecutive_missed_days": 0,
                "status": "active",
                "updated_at": now
            },
            "$inc": {
                "symi_points": 1
            }
        }
    )
    
    # Record check-in history
    await db.checkin_history.insert_one({
        "user_id": str(current_user["_id"]),
        "checkin_date": now,
        "status": "checked_in"
    })
    
    # Calculate streak
    history = await db.checkin_history.find(
        {"user_id": str(current_user["_id"]), "status": "checked_in"}
    ).sort("checkin_date", -1).to_list(100)
    
    streak = 1
    if len(history) > 1:
        for i in range(1, len(history)):
            prev_date = history[i]["checkin_date"].date()
            curr_date = history[i-1]["checkin_date"].date()
            diff = (curr_date - prev_date).days
            if diff <= 1:
                streak += 1
            else:
                break
    
    return {
        "success": True,
        "message": "Check-in recorded successfully!",
        "last_checkin": now,
        "streak": streak
    }

@api_router.get("/users/checkin-history")
async def get_checkin_history(current_user: dict = Depends(get_current_user)):
    history = await db.checkin_history.find(
        {"user_id": str(current_user["_id"])}
    ).sort("checkin_date", -1).to_list(30)
    
    for item in history:
        item["_id"] = str(item["_id"])
    
    return history

# Messages Routes
@api_router.post("/messages")
async def create_message(message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    # Check subscription limits
    user_tier = current_user.get("subscription_tier", "free")
    
    # Get current message count
    message_count = await db.messages.count_documents({"user_id": str(current_user["_id"])})
    
    # Define limits based on tier
    tier_limits = {
        "free": {"max_messages": 1, "max_recipients": 1, "allowed_types": ["text"]},
        "basic": {"max_messages": 1, "max_recipients": 1, "allowed_types": ["text"]},
        "silver": {"max_messages": 1, "max_recipients": 1, "allowed_types": ["text", "audio"]},
        "gold": {"max_messages": 1, "max_recipients": 1, "allowed_types": ["text", "audio", "video"]},
        "diamond": {"max_messages": 2, "max_recipients": 2, "allowed_types": ["text", "audio", "video"]},
        "blue_diamond": {"max_messages": 5, "max_recipients": 5, "allowed_types": ["text", "audio", "video"]},
        "platinum": {"max_messages": 25, "max_recipients": 25, "allowed_types": ["text", "audio", "video"]},
        "galaxy": {"max_messages": 999999, "max_recipients": 999999, "allowed_types": ["text", "audio", "video"]}
    }
    
    limits = tier_limits.get(user_tier, tier_limits["free"])
    
    if message_count >= limits["max_messages"]:
        raise HTTPException(status_code=403, detail=f"Message limit reached for {user_tier} plan")
    
    if message_data.message_type not in limits["allowed_types"]:
        raise HTTPException(status_code=403, detail=f"Message type '{message_data.message_type}' not allowed in {user_tier} plan")
    
    # Scheduled date validation
    scheduled_dt = message_data.scheduled_at
    if message_data.delivery_mode == "scheduled_date":
        if not scheduled_dt:
            raise HTTPException(status_code=400, detail="Belirtilen tarihte iletim için bir tarih ve saat seçilmelidir.")
        if scheduled_dt.tzinfo is not None:
            scheduled_dt = scheduled_dt.astimezone(timezone.utc).replace(tzinfo=None)
        if scheduled_dt <= datetime.utcnow():
            raise HTTPException(status_code=400, detail="İletim tarihi gelecekteki bir tarih ve saat olmalıdır.")

    # Create encrypted message
    message_dict = {
      "user_id": str(current_user["_id"]),
      "recipient_id": message_data.recipient_id,
      "message_type": message_data.message_type,
      "delivery_mode": message_data.delivery_mode or "checkin_based",
      "scheduled_at": scheduled_dt if message_data.delivery_mode == "scheduled_date" else None,
      "delivery_channel": message_data.delivery_channel or "both",
      "status": "pending",
      "encrypted_content": message_data.content,  # Should be encrypted client-side
      "encryption_password": get_password_hash(message_data.encryption_password),  # Bcrypt hashed password
      "created_at": datetime.utcnow(),
      "is_delivered": False,
      "delivered_at": None,
      "expires_at": None
    }
    
    result = await db.messages.insert_one(message_dict)
    message_dict["_id"] = str(result.inserted_id)
    if isinstance(message_dict.get("created_at"), datetime):
        message_dict["created_at"] = message_dict["created_at"].isoformat()
    if isinstance(message_dict.get("scheduled_at"), datetime):
        message_dict["scheduled_at"] = message_dict["scheduled_at"].isoformat()
    
    # Award points based on message type
    points_to_award = 10
    if message_data.message_type == "audio":
        points_to_award = 25
    elif message_data.message_type == "video":
        points_to_award = 50
        
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"symi_points": points_to_award}}
    )
    
    # Instant Message & Media Backup
    await backup_message_to_file(message_dict)
    
    return message_dict

@api_router.get("/messages")
async def get_messages(current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({"user_id": str(current_user["_id"])}).to_list(1000)
    
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        if isinstance(msg.get("created_at"), datetime):
            msg["created_at"] = msg["created_at"].isoformat()
        if isinstance(msg.get("scheduled_at"), datetime):
            msg["scheduled_at"] = msg["scheduled_at"].isoformat()
        if isinstance(msg.get("delivered_at"), datetime):
            msg["delivered_at"] = msg["delivered_at"].isoformat()
        if "delivery_mode" not in msg:
            msg["delivery_mode"] = "checkin_based"
        if "status" not in msg:
            msg["status"] = "delivered" if msg.get("is_delivered") else "pending"
            
        # Get recipient info
        if msg.get("recipient_id") and ObjectId.is_valid(msg["recipient_id"]):
            recipient = await db.recipients.find_one({"_id": ObjectId(msg["recipient_id"])})
            if recipient:
                msg["recipient_name"] = recipient.get("name", "Unknown")
            else:
                msg["recipient_name"] = "Bilinmeyen Alıcı"
        else:
            msg["recipient_name"] = "Bilinmeyen Alıcı"
    
    return messages

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.messages.delete_one({
        "_id": ObjectId(message_id),
        "user_id": str(current_user["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"success": True, "message": "Message deleted"}

# Recipients Routes
@api_router.post("/recipients")
async def create_recipient(recipient_data: RecipientCreate, current_user: dict = Depends(get_current_user)):
    # Check subscription limits
    user_tier = current_user.get("subscription_tier", "free")
    recipient_count = await db.recipients.count_documents({"user_id": str(current_user["_id"])})
    
    tier_limits = {
        "free": 1, "basic": 1, "silver": 1, "gold": 1, "diamond": 2,
        "blue_diamond": 5, "platinum": 25, "galaxy": 999999
    }
    
    allowed_limit = tier_limits.get(user_tier, 1) + current_user.get("extra_recipients", 0)
    if recipient_count >= allowed_limit:
        raise HTTPException(status_code=403, detail=f"Alıcı ekleme sınırına ulaştınız.")
    
    recipient_dict = {
        "user_id": str(current_user["_id"]),
        "name": recipient_data.name,
        "phone": recipient_data.phone,
        "email": recipient_data.email,
        "relation": recipient_data.relation,
        "created_at": datetime.utcnow()
    }
    
    result = await db.recipients.insert_one(recipient_dict)
    recipient_dict["_id"] = str(result.inserted_id)
    
    # Award 5 points
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"symi_points": 5}}
    )
    
    return recipient_dict

@api_router.get("/recipients")
async def get_recipients(current_user: dict = Depends(get_current_user)):
    recipients = await db.recipients.find({"user_id": str(current_user["_id"])}).to_list(1000)
    
    for recipient in recipients:
        recipient["_id"] = str(recipient["_id"])
    
    return recipients

@api_router.put("/recipients/{recipient_id}")
async def update_recipient(recipient_id: str, recipient_data: RecipientUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in recipient_data.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.recipients.update_one(
        {"_id": ObjectId(recipient_id), "user_id": str(current_user["_id"])},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    return {"success": True, "message": "Recipient updated"}

@api_router.delete("/recipients/{recipient_id}")
async def delete_recipient(recipient_id: str, current_user: dict = Depends(get_current_user)):
    # Check if there are messages associated with this recipient
    message_count = await db.messages.count_documents({
        "recipient_id": recipient_id,
        "user_id": str(current_user["_id"])
    })
    
    if message_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete recipient with associated messages")
    
    result = await db.recipients.delete_one({
        "_id": ObjectId(recipient_id),
        "user_id": str(current_user["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    return {"success": True, "message": "Recipient deleted"}

# Subscription Routes
# Helper to check permissions
def require_permission(permission_name: str):
    async def dependency(current_user: dict = Depends(get_current_user)):
        if current_user.get("email") in ["akin@symi.com.tr", "aknkrds@hotmail.com"]:
            return current_user
        if current_user.get("role") == "admin":
            return current_user
        
        permissions = current_user.get("permissions", {})
        if not permissions.get(permission_name):
            raise HTTPException(status_code=403, detail=f"Permission '{permission_name}' denied")
        return current_user
    return dependency

@api_router.get("/subscriptions/plans")
async def get_subscription_plans():
    plans = await db.subscription_plans.find({}).to_list(100)
    for plan in plans:
        plan["_id"] = str(plan["_id"])
    return plans

@api_router.post("/subscriptions/subscribe")
async def subscribe_to_plan(subscribe_data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    plan = await db.subscription_plans.find_one({"name": subscribe_data.plan_name})
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan name")
    
    # Expiry calculation based on billing cycle
    expiry = None
    if subscribe_data.plan_name != "free":
        cycle = plan.get("billing_cycle", "yearly")
        if cycle == "monthly":
            expiry = datetime.utcnow() + timedelta(days=30)
        elif cycle == "yearly":
            expiry = datetime.utcnow() + timedelta(days=365)
        elif cycle == "lifetime":
            expiry = None
        else:
            expiry = datetime.utcnow() + timedelta(days=365)
            
    # Check if a campaign code was passed
    discount_applied = 0
    if subscribe_data.campaign_code:
        campaign = await db.campaigns.find_one({
            "code": subscribe_data.campaign_code.strip().upper(),
            "is_active": True
        })
        if campaign:
            discount_applied = campaign.get("discount_percentage", 0)
            
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "subscription_tier": subscribe_data.plan_name,
                "subscription_status": "active",
                "subscription_expiry": expiry,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Successfully subscribed to {subscribe_data.plan_name} plan",
        "plan": subscribe_data.plan_name,
        "expiry": expiry,
        "discount_applied": discount_applied
    }

# Admin Routes
@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(require_permission("can_view_users"))):
    users = await db.users.find({}).to_list(1000)
    for user in users:
        user["_id"] = str(user["_id"])
        if "password_hash" in user:
            del user["password_hash"]
        
        # Calculate days since last check-in
        if user.get("last_checkin"):
            days_since = (datetime.utcnow() - user["last_checkin"]).days
            user["days_since_checkin"] = days_since
        else:
            user["days_since_checkin"] = 999
    
    return users

@api_router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(require_permission("can_view_users"))):
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"status": "active"})
    flagged_users = await db.users.count_documents({"consecutive_missed_days": {"$gte": 7}})
    deceased_users = await db.users.count_documents({"status": "deceased"})
    total_messages = await db.messages.count_documents({})
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "flagged_users": flagged_users,
        "deceased_users": deceased_users,
        "total_messages": total_messages
    }

@api_router.get("/admin/recipients")
async def get_admin_recipients(current_user: dict = Depends(require_permission("can_view_users"))):
    recipients = await db.recipients.find({}).sort("created_at", -1).to_list(1000)
    user_ids = list(set([r["user_id"] for r in recipients if "user_id" in r]))
    
    users_map = {}
    if user_ids:
        valid_oids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
        users_list = await db.users.find({"_id": {"$in": valid_oids}}).to_list(1000)
        for u in users_list:
            users_map[str(u["_id"])] = u
            
    res = []
    for r in recipients:
        r_id = str(r["_id"])
        u_info = users_map.get(r.get("user_id", ""), {})
        created_str = r.get("created_at").isoformat() if isinstance(r.get("created_at"), datetime) else r.get("created_at")
        res.append({
            "_id": r_id,
            "name": r.get("name", "Bilinmeyen"),
            "phone": r.get("phone", ""),
            "email": r.get("email", ""),
            "relation": r.get("relation", ""),
            "created_at": created_str,
            "user_name": u_info.get("full_name", "Bilinmeyen Kullanıcı"),
            "user_email": u_info.get("email", ""),
            "user_id": r.get("user_id", "")
        })
    return res

@api_router.get("/admin/messages")
async def get_admin_messages(current_user: dict = Depends(require_permission("can_view_users"))):
    messages = await db.messages.find({}).sort("created_at", -1).to_list(1000)
    
    user_ids = list(set([m["user_id"] for m in messages if "user_id" in m]))
    recip_ids = list(set([m["recipient_id"] for m in messages if "recipient_id" in m]))
    
    users_map = {}
    if user_ids:
        valid_uoids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
        u_list = await db.users.find({"_id": {"$in": valid_uoids}}).to_list(1000)
        for u in u_list:
            users_map[str(u["_id"])] = u
            
    recip_map = {}
    if recip_ids:
        valid_roids = [ObjectId(rid) for rid in recip_ids if ObjectId.is_valid(rid)]
        r_list = await db.recipients.find({"_id": {"$in": valid_roids}}).to_list(1000)
        for r in r_list:
            recip_map[str(r["_id"])] = r
            
    res = []
    for m in messages:
        u_info = users_map.get(m.get("user_id", ""), {})
        r_info = recip_map.get(m.get("recipient_id", ""), {})
        created_str = m.get("created_at").isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at")
        sched_str = m.get("scheduled_at").isoformat() if isinstance(m.get("scheduled_at"), datetime) else m.get("scheduled_at")
        res.append({
            "_id": str(m["_id"]),
            "message_type": m.get("message_type", "text"),
            "delivery_mode": m.get("delivery_mode", "checkin_based"),
            "scheduled_at": sched_str,
            "delivery_channel": m.get("delivery_channel", "both"),
            "status": m.get("status", "pending"),
            "is_delivered": m.get("is_delivered", False),
            "created_at": created_str,
            "user_name": u_info.get("full_name", "Bilinmeyen Kullanıcı"),
            "user_email": u_info.get("email", ""),
            "recipient_name": r_info.get("name", m.get("recipient_name", "Bilinmeyen Alıcı")),
            "recipient_phone": r_info.get("phone", ""),
            "recipient_email": r_info.get("email", "")
        })
    return res

@api_router.put("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, status: str, current_user: dict = Depends(require_permission("can_edit_user_status"))):
    valid_statuses = ["active", "flagged", "deceased", "inactive"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.get("email") in ["akin@symi.com.tr", "aknkrds@hotmail.com"] and status == "inactive":
        raise HTTPException(status_code=400, detail="Cannot deactivate super admin account")
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": f"User status updated to {status}"}

# Staff Management APIs
@api_router.get("/admin/staff")
async def get_staff_list(current_user: dict = Depends(require_permission("can_manage_staff"))):
    staff = await db.users.find({
        "$or": [
            {"role": {"$in": ["admin", "moderator", "manager"]}},
            {"permissions": {"$exists": True, "$ne": None}}
        ]
    }).to_list(100)
    
    for s in staff:
        s["_id"] = str(s["_id"])
        if "password_hash" in s:
            del s["password_hash"]
    return staff

@api_router.post("/admin/staff")
async def create_staff_user(staff_data: StaffCreate, current_user: dict = Depends(require_permission("can_manage_staff"))):
    existing = await db.users.find_one({"email": staff_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    pwd_hash = pwd_context.hash(staff_data.password)
    user_dict = {
        "user_id": f"staff_{uuid.uuid4().hex[:12]}",
        "email": staff_data.email,
        "password_hash": pwd_hash,
        "full_name": staff_data.full_name,
        "phone": staff_data.phone,
        "role": staff_data.role,
        "subscription_tier": "free",
        "subscription_status": "inactive",
        "subscription_expiry": None,
        "last_checkin": datetime.utcnow(),
        "consecutive_missed_days": 0,
        "status": "active",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "permissions": staff_data.permissions
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    if "password_hash" in user_dict:
        del user_dict["password_hash"]
    return user_dict

@api_router.put("/admin/staff/{user_id}")
async def update_staff_user(user_id: str, staff_data: StaffUpdate, current_user: dict = Depends(require_permission("can_manage_staff"))):
    update_data = {}
    if staff_data.full_name is not None:
        update_data["full_name"] = staff_data.full_name
    if staff_data.role is not None:
        update_data["role"] = staff_data.role
    if staff_data.permissions is not None:
        update_data["permissions"] = staff_data.permissions
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff user not found")
        
    return {"success": True, "message": "Staff user updated successfully"}

@api_router.put("/admin/staff/{user_id}/password")
async def reset_staff_password(user_id: str, pwd_data: StaffPasswordReset, current_user: dict = Depends(require_permission("can_manage_staff"))):
    new_hash = pwd_context.hash(pwd_data.password)
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff user not found")
    return {"success": True, "message": "Staff password updated successfully"}

@api_router.delete("/admin/staff/{user_id}")
async def delete_staff_user(user_id: str, current_user: dict = Depends(require_permission("can_manage_staff"))):
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    staff_to_delete = await db.users.find_one({"_id": ObjectId(user_id)})
    if not staff_to_delete:
        raise HTTPException(status_code=404, detail="Staff user not found")
        
    if staff_to_delete.get("email") in ["akin@symi.com.tr", "aknkrds@hotmail.com"]:
        raise HTTPException(status_code=400, detail="Cannot delete super admin account")
        
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"success": True, "message": "Staff user deleted successfully"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_permission("can_manage_staff"))):
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    user_to_delete = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_to_delete.get("email") in ["akin@symi.com.tr", "aknkrds@hotmail.com"]:
        raise HTTPException(status_code=400, detail="Cannot delete super admin account")
        
    await db.users.delete_one({"_id": ObjectId(user_id)})
    await db.recipients.delete_many({"user_id": user_id})
    await db.messages.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"success": True, "message": "User deleted successfully"}

# User status & plan management by admin
class UserUpgradePayload(BaseModel):
    subscription_tier: str
    duration: str  # "1_month", "1_year", "lifetime"
    extra_recipients: int

@api_router.post("/admin/users/{user_id}/upgrade")
async def upgrade_user_plan(
    user_id: str,
    payload: UserUpgradePayload,
    current_user: dict = Depends(require_permission("can_manage_plans"))
):
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    expiry = None
    if payload.duration == "1_month":
        expiry = datetime.utcnow() + timedelta(days=30)
    elif payload.duration == "1_year":
        expiry = datetime.utcnow() + timedelta(days=365)
    elif payload.duration == "lifetime":
        expiry = None
        
    subscription_status = "active" if payload.subscription_tier != "free" else "inactive"
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "subscription_tier": payload.subscription_tier,
            "subscription_expiry": expiry,
            "subscription_status": subscription_status,
            "extra_recipients": payload.extra_recipients,
            "updated_at": datetime.utcnow()
        }}
    )
    return {"success": True, "message": "User plan and recipients updated successfully"}

# Subscription Plan Management APIs
@api_router.get("/admin/plans")
async def get_admin_plans(current_user: dict = Depends(require_permission("can_manage_plans"))):
    plans = await db.subscription_plans.find({}).to_list(100)
    for p in plans:
        p["_id"] = str(p["_id"])
    return plans

@api_router.post("/admin/plans")
async def create_subscription_plan(plan_data: PlanCreate, current_user: dict = Depends(require_permission("can_manage_plans"))):
    existing = await db.subscription_plans.find_one({"name": plan_data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Plan name already exists")
        
    plan_dict = plan_data.dict()
    result = await db.subscription_plans.insert_one(plan_dict)
    plan_dict["_id"] = str(result.inserted_id)
    return plan_dict

@api_router.put("/admin/plans/{plan_id}")
async def update_subscription_plan(plan_id: str, plan_data: PlanUpdate, current_user: dict = Depends(require_permission("can_manage_plans"))):
    update_data = {}
    if plan_data.display_name is not None:
        update_data["display_name"] = plan_data.display_name
    if plan_data.price is not None:
        update_data["price"] = plan_data.price
    if plan_data.max_recipients is not None:
        update_data["max_recipients"] = plan_data.max_recipients
    if plan_data.max_messages is not None:
        update_data["max_messages"] = plan_data.max_messages
    if plan_data.allowed_types is not None:
        update_data["allowed_types"] = plan_data.allowed_types
    if plan_data.features is not None:
        update_data["features"] = plan_data.features
    if plan_data.country_pricing is not None:
        update_data["country_pricing"] = plan_data.country_pricing
    if plan_data.payment_methods is not None:
        update_data["payment_methods"] = plan_data.payment_methods
    if plan_data.billing_cycle is not None:
        update_data["billing_cycle"] = plan_data.billing_cycle
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    result = await db.subscription_plans.update_one(
        {"_id": ObjectId(plan_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    return {"success": True, "message": "Plan updated successfully"}

@api_router.delete("/admin/plans/{plan_id}")
async def delete_subscription_plan(plan_id: str, current_user: dict = Depends(require_permission("can_manage_plans"))):
    plan = await db.subscription_plans.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    if plan.get("name") == "free":
        raise HTTPException(status_code=400, detail="Cannot delete the free plan")
        
    await db.subscription_plans.delete_one({"_id": ObjectId(plan_id)})
    return {"success": True, "message": "Plan deleted successfully"}

# Promo Code Validation
@api_router.post("/subscriptions/validate-code")
async def validate_promo_code(data: ValidatePromoRequest):
    code = data.code.strip().upper()
    campaign = await db.campaigns.find_one({"code": code, "is_active": True})
    if not campaign:
        raise HTTPException(status_code=400, detail="Invalid or inactive campaign code")
    return {"code": code, "discount_percentage": campaign["discount_percentage"]}

# Campaign CRUD
@api_router.get("/admin/campaigns")
async def get_all_campaigns(current_user: dict = Depends(require_permission("can_manage_plans"))):
    campaigns = await db.campaigns.find({}).to_list(100)
    for c in campaigns:
        c["_id"] = str(c["_id"])
        if "created_at" in c and isinstance(c["created_at"], datetime):
            c["created_at"] = c["created_at"].isoformat()
    return campaigns

@api_router.post("/admin/campaigns")
async def create_campaign(campaign_data: CampaignCreate, current_user: dict = Depends(require_permission("can_manage_plans"))):
    code = campaign_data.code.strip().upper()
    existing = await db.campaigns.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Campaign code already exists")
        
    doc = {
        "code": code,
        "discount_percentage": campaign_data.discount_percentage,
        "is_active": campaign_data.is_active,
        "created_at": datetime.utcnow()
    }
    result = await db.campaigns.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["created_at"] = doc["created_at"].isoformat()
    return doc

@api_router.put("/admin/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, campaign_data: CampaignUpdate, current_user: dict = Depends(require_permission("can_manage_plans"))):
    update_data = {}
    if campaign_data.discount_percentage is not None:
        update_data["discount_percentage"] = campaign_data.discount_percentage
    if campaign_data.is_active is not None:
        update_data["is_active"] = campaign_data.is_active
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    result = await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"success": True, "message": "Campaign updated successfully"}

@api_router.delete("/admin/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: dict = Depends(require_permission("can_manage_plans"))):
    result = await db.campaigns.delete_one({"_id": ObjectId(campaign_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"success": True, "message": "Campaign deleted successfully"}

# Payment Config Settings
@api_router.get("/admin/config/{config_id}")
async def get_system_config(config_id: str, current_user: dict = Depends(require_permission("can_manage_plans"))):
    config = await db.system_config.find_one({"_id": config_id})
    if not config:
        if config_id == "google_pay":
            return {"_id": "google_pay", "fields": {"api_key": "", "merchant_id": "", "package_name": ""}, "is_active": False}
        elif config_id == "paytr":
            return {"_id": "paytr", "fields": {"merchant_id": "", "merchant_key": "", "merchant_salt": ""}, "is_active": False}
        return {"_id": config_id, "fields": {}, "is_active": False}
    return config

@api_router.put("/admin/config/{config_id}")
async def update_system_config(config_id: str, config_data: PaymentConfigUpdate, current_user: dict = Depends(require_permission("can_manage_plans"))):
    await db.system_config.update_one(
        {"_id": config_id},
        {"$set": {
            "fields": config_data.fields,
            "is_active": config_data.is_active,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    return {"success": True, "message": f"Configuration {config_id} updated successfully"}

# Push Token Registration
@api_router.post("/users/push-token")
async def register_push_token(token_data: PushTokenRegister, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"expo_push_token": token_data.push_token, "updated_at": datetime.utcnow()}}
    )
    return {"success": True, "message": "Push token registered successfully"}

# --- Points & Shop Endpoints ---
@api_router.get("/packages")
async def get_packages():
    pkgs = await db.point_packages.find({}).to_list(100)
    for pkg in pkgs:
        pkg["_id"] = str(pkg["_id"])
    return pkgs

class PurchasePackageRequest(BaseModel):
    package_id: str

@api_router.post("/packages/purchase")
async def purchase_package(req: PurchasePackageRequest, current_user: dict = Depends(get_current_user)):
    pkg = await db.point_packages.find_one({"package_id": req.package_id})
    if not pkg:
        raise HTTPException(status_code=404, detail="Paket bulunamadı")
    
    user_points = current_user.get("symi_points", 0)
    if user_points < pkg["points_cost"]:
        raise HTTPException(status_code=400, detail="Yetersiz SYMI puanı")
    
    # Deduct points and apply benefit
    benefit = pkg.get("benefit", {})
    benefit_type = benefit.get("type")
    benefit_val = benefit.get("value", 0)
    
    update_dict = {
        "$inc": {"symi_points": -pkg["points_cost"]}
    }
    if benefit_type == "extra_recipients":
        update_dict["$inc"]["extra_recipients"] = benefit_val
        
    await db.users.update_one({"_id": current_user["_id"]}, update_dict)
    return {"success": True, "message": f"{pkg['display_name']} başarıyla satın alındı!"}

# --- Admin Package Management ---
@api_router.post("/admin/packages")
async def admin_create_package(pkg_data: PackageCreate, current_user: dict = Depends(require_permission("can_manage_plans"))):
    package_id = f"pkg_{uuid.uuid4().hex[:8]}"
    pkg_dict = {
        "package_id": package_id,
        "name": pkg_data.name,
        "display_name": pkg_data.display_name,
        "points_cost": pkg_data.points_cost,
        "description": pkg_data.description,
        "benefit": {"type": pkg_data.benefit_type, "value": pkg_data.benefit_value}
    }
    await db.point_packages.insert_one(pkg_dict)
    pkg_dict["_id"] = str(pkg_dict["_id"])
    return pkg_dict

@api_router.put("/admin/packages/{pkg_id}")
async def admin_update_package(pkg_id: str, pkg_data: PackageUpdate, current_user: dict = Depends(require_permission("can_manage_plans"))):
    pkg = await db.point_packages.find_one({"package_id": pkg_id})
    if not pkg:
        raise HTTPException(status_code=404, detail="Paket bulunamadı")
    
    upd = {}
    if pkg_data.display_name is not None:
        upd["display_name"] = pkg_data.display_name
    if pkg_data.points_cost is not None:
        upd["points_cost"] = pkg_data.points_cost
    if pkg_data.description is not None:
        upd["description"] = pkg_data.description
    if pkg_data.benefit_value is not None:
        upd["benefit.value"] = pkg_data.benefit_value
        
    if upd:
        await db.point_packages.update_one({"package_id": pkg_id}, {"$set": upd})
        
    return {"success": True, "message": "Paket güncellendi"}

@api_router.delete("/admin/packages/{pkg_id}")
async def admin_delete_package(pkg_id: str, current_user: dict = Depends(require_permission("can_manage_plans"))):
    res = await db.point_packages.delete_one({"package_id": pkg_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paket bulunamadı")
    return {"success": True, "message": "Paket silindi"}

# --- Referral Submissions ---
@api_router.post("/users/submit-referral")
async def submit_referral(data: SubmitReferralRequest, current_user: dict = Depends(get_current_user)):
    success = await process_referral(current_user["user_id"], data.referral_code)
    if not success:
        raise HTTPException(status_code=400, detail="Geçersiz referans kodu veya bu hesap zaten bir referans kodu kullandı.")
    return {"success": True, "message": "Referans kodu başarıyla uygulandı!"}

@api_router.post("/users/skip-referral")
async def skip_referral(current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"referral_eligible": False, "updated_at": datetime.utcnow()}}
    )
    return {"success": True}

# --- Profile Update Request Endpoints ---
@api_router.post("/users/profile-request")
async def create_profile_request(req_data: ProfileRequestCreate, current_user: dict = Depends(get_current_user)):
    field = req_data.field
    new_val = req_data.new_value.strip()
    
    dup = await db.users.find_one({field: new_val})
    if dup and dup["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=400, detail=f"Bu {field == 'email' and 'e-posta' or 'telefon numarası'} zaten başka bir kullanıcı tarafından kullanılıyor.")
    
    pending = await db.profile_requests.find_one({
        "user_id": current_user["user_id"],
        "field": field,
        "status": "pending"
    })
    if pending:
        raise HTTPException(status_code=400, detail="Zaten bekleyen bir onay isteğiniz bulunuyor.")

    req_id = f"req_{uuid.uuid4().hex[:12]}"
    req_dict = {
        "request_id": req_id,
        "user_id": current_user["user_id"],
        "full_name": current_user["full_name"],
        "user_email": current_user["email"],
        "field": field,
        "old_value": current_user.get(field, ""),
        "new_value": new_val,
        "reason": req_data.reason,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    await db.profile_requests.insert_one(req_dict)
    return {"success": True, "message": "Profil değişiklik talebiniz yöneticiye iletildi."}

@api_router.get("/users/profile-requests")
async def get_user_profile_requests(current_user: dict = Depends(get_current_user)):
    requests = await db.profile_requests.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(100)
    for r in requests:
        r["_id"] = str(r["_id"])
        r["created_at"] = r["created_at"].isoformat()
    return requests

class ConsumeRequestPayload(BaseModel):
    request_id: str

@api_router.post("/users/consume-profile-request")
async def consume_profile_request(payload: ConsumeRequestPayload, current_user: dict = Depends(get_current_user)):
    req = await db.profile_requests.find_one({
        "request_id": payload.request_id,
        "user_id": current_user["user_id"],
        "status": "approved"
    })
    if not req:
        raise HTTPException(status_code=404, detail="Onaylanmış talep bulunamadı.")
        
    field = req["field"]
    new_val = req["new_value"]
    
    dup = await db.users.find_one({field: new_val})
    if dup and dup["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=400, detail=f"Bu {field == 'email' and 'e-posta' or 'telefon numarası'} zaten başka bir kullanıcı tarafından kullanılıyor.")
        
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {field: new_val, "updated_at": datetime.utcnow()}}
    )
    await db.profile_requests.update_one(
        {"request_id": payload.request_id},
        {"$set": {"status": "completed"}}
    )
    
    return {"success": True, "message": "Profiliniz başarıyla güncellendi."}

@api_router.post("/users/change-password")
async def change_password(data: PasswordChangeRequest, current_user: dict = Depends(get_current_user)):
    password_hash = current_user.get("password_hash")
    if not password_hash or not verify_password(data.current_password, password_hash):
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı")
        
    last_change = current_user.get("last_password_change")
    if last_change:
        if isinstance(last_change, str):
            last_change = datetime.fromisoformat(last_change)
        time_diff = datetime.utcnow() - last_change
        if time_diff < timedelta(days=30):
            days_left = 30 - time_diff.days
            raise HTTPException(status_code=400, detail=f"Şifrenizi ayda sadece 1 defa değiştirebilirsiniz. {days_left} gün sonra tekrar deneyebilirsiniz.")
            
    hashed_pwd = get_password_hash(data.new_password)
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "password_hash": hashed_pwd,
            "last_password_change": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    return {"success": True, "message": "Şifreniz başarıyla güncellendi."}

# --- Admin Profile Requests Review ---
@api_router.get("/admin/profile-requests")
async def get_all_profile_requests(current_user: dict = Depends(require_permission("can_view_users"))):
    requests = await db.profile_requests.find({}).sort("created_at", -1).to_list(1000)
    for r in requests:
        r["_id"] = str(r["_id"])
        r["created_at"] = r["created_at"].isoformat()
    return requests

@api_router.post("/admin/profile-requests/{request_id}/approve")
async def approve_profile_request(request_id: str, current_user: dict = Depends(require_permission("can_edit_user_status"))):
    res = await db.profile_requests.update_one(
        {"request_id": request_id, "status": "pending"},
        {"$set": {"status": "approved"}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bekleyen talep bulunamadı.")
    return {"success": True, "message": "Değişiklik talebi onaylandı."}

@api_router.post("/admin/profile-requests/{request_id}/reject")
async def reject_profile_request(request_id: str, current_user: dict = Depends(require_permission("can_edit_user_status"))):
    res = await db.profile_requests.update_one(
        {"request_id": request_id, "status": "pending"},
        {"$set": {"status": "rejected"}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bekleyen talep bulunamadı.")
    return {"success": True, "message": "Değişiklik talebi reddedildi."}

# Ping User push notification
@api_router.post("/admin/users/{user_id}/ping")
async def ping_user(user_id: str, current_user: dict = Depends(require_permission("can_edit_user_status"))):
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    push_token = target_user.get("expo_push_token")
    if not push_token:
        return {
            "success": True, 
            "message": "Ping registered (user has no push token registered yet, simulated notification)", 
            "simulated": True
        }
        
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            res = await client.post(
                "https://exp.host/--/api/v2/push/send",
                headers={"Content-Type": "application/json"},
                json=[{
                    "to": push_token,
                    "sound": "default",
                    "title": "İyi misin?",
                    "body": "Lütfen iyi olduğunuzu onaylamak için 'İyiyim!' butonuna dokunun.",
                    "data": {"type": "checkin_reminder"}
                }]
            )
            res_data = res.json()
            logger.info(f"Expo push notification response: {res_data}")
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return {"success": True, "message": f"Ping requested but push gateway failed: {e}", "gateway_error": True}
        
    return {"success": True, "message": "Ping notification sent successfully!"}

# Helper to save base64 image
def save_base64_image(base64_str: str) -> str:
    import base64
    import time
    
    # Remove header if present
    if "," in base64_str:
        header, base64_str = base64_str.split(",", 1)
    else:
        header = "image/jpeg"
        
    ext = "jpg"
    if "png" in header:
        ext = "png"
    elif "gif" in header:
        ext = "gif"
    elif "webp" in header:
        ext = "webp"
        
    image_data = base64.b64decode(base64_str)
    filename = f"ticket_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
    
    upload_dir = ROOT_DIR / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / filename
    with open(file_path, "wb") as f:
        f.write(image_data)
        
    try:
        backup_file_path = BACKUP_UPLOADS_DIR / f"backup_{filename}"
        with open(backup_file_path, "wb") as bf:
            bf.write(image_data)
    except Exception as err:
        logging.getLogger(__name__).error(f"Failed to save backup image: {err}")

    return f"/uploads/{filename}"

# Support Tickets API
@api_router.post("/support/tickets")
async def create_support_ticket(ticket_data: TicketCreate, current_user: dict = Depends(get_current_user)):
    # Generate unique ticket_id
    ticket_id = ""
    for _ in range(10): # try 10 times to avoid collisions
        num = "".join(random.choices(string.digits, k=6))
        potential_id = f"TKT-{num}"
        existing = await db.support_tickets.find_one({"ticket_id": potential_id})
        if not existing:
            ticket_id = potential_id
            break
    if not ticket_id:
        raise HTTPException(status_code=500, detail="Failed to generate a unique ticket ID")

    image_url = None
    if ticket_data.base64_image:
        try:
            image_url = save_base64_image(ticket_data.base64_image)
        except Exception as e:
            logger.error(f"Failed to save ticket image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image data")

    ticket_doc = {
        "ticket_id": ticket_id,
        "user_id": str(current_user["_id"]),
        "name": ticket_data.name,
        "phone": ticket_data.phone,
        "subject": ticket_data.subject,
        "description": ticket_data.description,
        "image_url": image_url,
        "status": "open",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "messages": []
    }

    await db.support_tickets.insert_one(ticket_doc)
    return {"success": True, "ticket_id": ticket_id}

@api_router.get("/support/tickets")
async def get_user_support_tickets(current_user: dict = Depends(get_current_user)):
    tickets = await db.support_tickets.find({"user_id": str(current_user["_id"])}).sort("updated_at", -1).to_list(100)
    for t in tickets:
        t["_id"] = str(t["_id"])
        t["created_at"] = t["created_at"].isoformat() if isinstance(t["created_at"], datetime) else t["created_at"]
        t["updated_at"] = t["updated_at"].isoformat() if isinstance(t["updated_at"], datetime) else t["updated_at"]
        for m in t.get("messages", []):
            m["created_at"] = m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else m["created_at"]
    return tickets

@api_router.get("/support/tickets/{ticket_id}")
async def get_support_ticket_detail(ticket_id: str, current_user: dict = Depends(get_current_user)):
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id, "user_id": str(current_user["_id"])})
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    
    ticket["_id"] = str(ticket["_id"])
    ticket["created_at"] = ticket["created_at"].isoformat() if isinstance(ticket["created_at"], datetime) else ticket["created_at"]
    ticket["updated_at"] = ticket["updated_at"].isoformat() if isinstance(ticket["updated_at"], datetime) else ticket["updated_at"]
    for m in ticket.get("messages", []):
        m["created_at"] = m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else m["created_at"]
    return ticket

@api_router.post("/support/tickets/{ticket_id}/message")
async def reply_to_support_ticket(ticket_id: str, reply_data: TicketReply, current_user: dict = Depends(get_current_user)):
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id, "user_id": str(current_user["_id"])})
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
        
    new_message = {
        "message_id": str(uuid.uuid4()),
        "sender": "user",
        "sender_name": current_user.get("full_name", "User"),
        "content": reply_data.content,
        "created_at": datetime.utcnow()
    }
    
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$push": {"messages": new_message},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    return {"success": True}

# Admin Support Tickets API
@api_router.get("/admin/support/tickets")
async def admin_get_all_support_tickets(current_user: dict = Depends(require_permission("can_manage_support"))):
    tickets = await db.support_tickets.find({}).sort("updated_at", -1).to_list(1000)
    for t in tickets:
        t["_id"] = str(t["_id"])
        t["created_at"] = t["created_at"].isoformat() if isinstance(t["created_at"], datetime) else t["created_at"]
        t["updated_at"] = t["updated_at"].isoformat() if isinstance(t["updated_at"], datetime) else t["updated_at"]
        for m in t.get("messages", []):
            m["created_at"] = m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else m["created_at"]
    return tickets

@api_router.get("/admin/support/tickets/{ticket_id}")
async def admin_get_support_ticket_detail(ticket_id: str, current_user: dict = Depends(require_permission("can_manage_support"))):
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
        
    ticket["_id"] = str(ticket["_id"])
    ticket["created_at"] = ticket["created_at"].isoformat() if isinstance(ticket["created_at"], datetime) else ticket["created_at"]
    ticket["updated_at"] = ticket["updated_at"].isoformat() if isinstance(ticket["updated_at"], datetime) else ticket["updated_at"]
    for m in ticket.get("messages", []):
        m["created_at"] = m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else m["created_at"]
    return ticket

@api_router.post("/admin/support/tickets/{ticket_id}/message")
async def admin_reply_to_support_ticket(ticket_id: str, reply_data: TicketReply, current_user: dict = Depends(require_permission("can_manage_support"))):
    ticket = await db.support_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
        
    new_message = {
        "message_id": str(uuid.uuid4()),
        "sender": "admin",
        "sender_name": current_user.get("full_name", "Yönetici"),
        "content": reply_data.content,
        "created_at": datetime.utcnow()
    }
    
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {
            "$push": {"messages": new_message},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    return {"success": True}

@api_router.put("/admin/support/tickets/{ticket_id}/status")
async def admin_update_support_ticket_status(ticket_id: str, status_data: TicketStatusUpdate, current_user: dict = Depends(require_permission("can_manage_support"))):
    result = await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"status": status_data.status, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return {"success": True}

from fastapi.responses import HTMLResponse

@app.get("/admin", response_class=HTMLResponse)
async def get_admin_dashboard():
    dashboard_path = ROOT_DIR / "admin_dashboard.html"
    if not dashboard_path.exists():
        raise HTTPException(status_code=404, detail="Dashboard file not found")
    with open(dashboard_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

# RevenueCat Webhook Endpoint
@api_router.post("/revenuecat/webhook")
async def revenuecat_webhook(request: Request, authorization: Optional[str] = Header(None)):
    webhook_secret = os.getenv("REVENUECAT_WEBHOOK_SECRET")
    if webhook_secret and authorization != f"Bearer {webhook_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized webhook secret")
        
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    logging.info(f"RevenueCat Webhook received: {payload}")
    
    event = payload.get("event")
    if not event:
        raise HTTPException(status_code=400, detail="Invalid payload: missing event details")
        
    event_type = event.get("type")
    app_user_id = event.get("app_user_id")
    
    if not app_user_id:
        return {"status": "ignored", "detail": "No app_user_id in event"}
        
    # Find user in MongoDB
    user = await db.users.find_one({"user_id": app_user_id})
    if not user:
        logging.warning(f"RevenueCat webhook: user_id '{app_user_id}' not found in database")
        return {"status": "ignored", "detail": f"User {app_user_id} not found in DB"}
        
    if event_type in ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"]:
        entitlement_ids = event.get("entitlement_ids", [])
        subscription_tier = "premium" if entitlement_ids else "free"
        
        expiration_ms = event.get("expiration_at_ms")
        expiry_date = None
        if expiration_ms:
            expiry_date = datetime.fromtimestamp(expiration_ms / 1000.0, tz=timezone.utc).replace(tzinfo=None)
            
        await db.users.update_one(
            {"user_id": app_user_id},
            {"$set": {
                "subscription_tier": subscription_tier,
                "subscription_status": "active",
                "subscription_expiry": expiry_date,
                "updated_at": datetime.utcnow()
            }}
        )
        logging.info(f"User {app_user_id} upgraded/renewed to {subscription_tier} via RevenueCat")
        
    elif event_type in ["CANCELLATION", "EXPIRATION"]:
        await db.users.update_one(
            {"user_id": app_user_id},
            {"$set": {
                "subscription_tier": "free",
                "subscription_status": "inactive",
                "subscription_expiry": None,
                "updated_at": datetime.utcnow()
            }}
        )
        logging.info(f"User {app_user_id} subscription expired or cancelled")
        
    return {"status": "success", "detail": "Webhook event processed"}

# Include router
app.include_router(api_router)

# Mount uploads static folder
from fastapi.staticfiles import StaticFiles
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_indexes():
    """Create MongoDB indexes on startup."""
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True, sparse=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.campaigns.create_index("code", unique=True)
        logger.info("MongoDB indexes created successfully")
        
        # 1. Seed or update superadmin users
        for superadmin_email in ["akin@symi.com.tr", "aknkrds@hotmail.com"]:
            admin_user = await db.users.find_one({"email": superadmin_email})
            if not admin_user:
                await db.users.insert_one({
                    "email": superadmin_email,
                    "password_hash": pwd_context.hash("DorukNaz2010"),
                    "full_name": "Akin Admin" if superadmin_email == "akin@symi.com.tr" else "Akin Hotmail Admin",
                    "phone": "+905555555555",
                    "role": "admin",
                    "subscription_tier": "galaxy",
                    "subscription_status": "active",
                    "subscription_expiry": None,
                    "last_checkin": datetime.utcnow(),
                    "consecutive_missed_days": 0,
                    "status": "active",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "permissions": {
                        "can_manage_staff": True,
                        "can_view_users": True,
                        "can_edit_user_status": True,
                        "can_manage_plans": True
                    }
                })
                logger.info(f"Super admin {superadmin_email} seeded successfully")
            else:
                await db.users.update_one(
                    {"email": superadmin_email},
                    {"$set": {
                        "role": "admin",
                        "password_hash": pwd_context.hash("DorukNaz2010"),
                        "permissions": {
                            "can_manage_staff": True,
                            "can_view_users": True,
                            "can_edit_user_status": True,
                            "can_manage_plans": True
                        }
                    }}
                )
                logger.info(f"Super admin {superadmin_email} updated successfully")
            
        # 2. Delete old admin if exists
        await db.users.delete_one({"email": "admin@finalmessage.com"})
        
        # 3. Seed default plans or update existing to lifetime and country pricing
        default_plans = [
            {
                "name": "free",
                "display_name": "Free",
                "price": 0,
                "currency": "USD",
                "max_recipients": 1,
                "max_messages": 1,
                "allowed_types": ["text"],
                "features": ["1 recipient", "1 text message", "With ads"],
                "country_pricing": {"TR": {"price": 0, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["free"],
                "billing_cycle": "lifetime"
            },
            {
                "name": "basic",
                "display_name": "Basic",
                "price": 9.99,
                "currency": "USD",
                "max_recipients": 1,
                "max_messages": 1,
                "allowed_types": ["text"],
                "features": ["1 recipient", "1 text message", "With ads"],
                "country_pricing": {"TR": {"price": 299.99, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["credit_card", "stripe"],
                "billing_cycle": "lifetime"
            },
            {
                "name": "silver",
                "display_name": "Silver",
                "price": 19.99,
                "currency": "USD",
                "max_recipients": 1,
                "max_messages": 1,
                "allowed_types": ["text", "audio"],
                "features": ["1 recipient", "1 text or audio message", "No ads"],
                "country_pricing": {"TR": {"price": 599.99, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["credit_card", "stripe"],
                "billing_cycle": "lifetime"
            },
            {
                "name": "gold",
                "display_name": "Gold",
                "price": 29.99,
                "currency": "USD",
                "max_recipients": 1,
                "max_messages": 1,
                "allowed_types": ["text", "audio", "video"],
                "features": ["1 recipient", "1 message (text/audio/video)", "No ads", "Extra recipient available"],
                "country_pricing": {"TR": {"price": 899.99, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["credit_card", "stripe"],
                "billing_cycle": "lifetime"
            },
            {
                "name": "diamond",
                "display_name": "Diamond",
                "price": 49.99,
                "currency": "USD",
                "max_recipients": 2,
                "max_messages": 2,
                "allowed_types": ["text", "audio", "video"],
                "features": ["2 recipients", "2 messages (text/audio/video)", "No ads", "Extra recipients available"],
                "country_pricing": {"TR": {"price": 1499.99, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["credit_card", "stripe"],
                "billing_cycle": "lifetime"
            },
            {
                "name": "blue_diamond",
                "display_name": "Blue Diamond",
                "price": 99.99,
                "currency": "USD",
                "max_recipients": 5,
                "max_messages": 5,
                "allowed_types": ["text", "audio", "video"],
                "features": ["5 recipients", "5 messages (text/audio/video)", "No ads", "Extra recipients available"],
                "country_pricing": {"TR": {"price": 2999.99, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["credit_card", "stripe"],
                "billing_cycle": "lifetime"
            },
            {
                "name": "platinum",
                "display_name": "Platinum",
                "price": 199.99,
                "currency": "USD",
                "max_recipients": 25,
                "max_messages": 25,
                "allowed_types": ["text", "audio", "video"],
                "features": ["25 recipients", "25 messages (any type)", "Multiple messages per recipient", "50% off extra recipients", "No ads"],
                "country_pricing": {"TR": {"price": 5999.99, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["credit_card", "stripe"],
                "billing_cycle": "lifetime"
            },
            {
                "name": "galaxy",
                "display_name": "Galaxy",
                "price": 499.99,
                "currency": "USD",
                "max_recipients": 999999,
                "max_messages": 999999,
                "allowed_types": ["text", "audio", "video"],
                "features": ["Unlimited recipients", "Unlimited messages", "All message types", "No ads", "Priority support"],
                "country_pricing": {"TR": {"price": 14999.99, "currency": "TRY", "symbol": "₺"}},
                "payment_methods": ["credit_card", "stripe"],
                "billing_cycle": "lifetime"
            }
        ]
        
        plans_count = await db.subscription_plans.count_documents({})
        if plans_count == 0:
            await db.subscription_plans.insert_many(default_plans)
            logger.info("Subscription plans seeded successfully with lifetime billing cycle")
        else:
            # Force update all existing plans to lifetime and set country pricing
            for plan_def in default_plans:
                await db.subscription_plans.update_one(
                    {"name": plan_def["name"]},
                    {"$set": {
                        "billing_cycle": "lifetime",
                        "country_pricing": plan_def["country_pricing"],
                        "currency": "USD"
                    }}
                )
            logger.info("Subscription plans updated to lifetime and country pricing set")
            
        # 4. Seed default point packages if empty
        pkg_count = await db.point_packages.count_documents({})
        if pkg_count == 0:
            default_packages = [
                {
                    "package_id": "pkg_recipient_1",
                    "name": "recipient_1",
                    "display_name": "Ek Alıcı Hakkı (+1)",
                    "points_cost": 400,
                    "description": "Listenize eklemek için 1 kişilik ekstra alıcı hakkı kazanır.",
                    "benefit": {"type": "extra_recipients", "value": 1}
                }
            ]
            await db.point_packages.insert_many(default_packages)
            logger.info("Default point packages seeded successfully")

        # 5. Populate missing fields for older users
        async for user in db.users.find({"referral_code": {"$exists": False}}):
            while True:
                ref_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
                dup = await db.users.find_one({"referral_code": ref_code})
                if not dup:
                    break
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "referral_code": ref_code,
                    "symi_points": user.get("symi_points", 0),
                    "referrals": user.get("referrals", []),
                    "extra_recipients": user.get("extra_recipients", 0),
                    "referral_eligible": False,
                    "last_password_change": datetime.utcnow()
                }}
            )
            logger.info(f"Backfilled user {user.get('email')} with referral code: {ref_code}")
    except Exception as e:
        logger.warning(f"Startup task failed or index creation warning: {e}")

async def process_scheduled_messages_loop():
    """Background worker checking for scheduled date messages due for delivery."""
    while True:
        try:
            now = datetime.utcnow()
            pending_msgs = await db.messages.find({
                "delivery_mode": "scheduled_date",
                "is_delivered": False,
                "scheduled_at": {"$lte": now}
            }).to_list(100)
            
            for msg in pending_msgs:
                msg_id = str(msg["_id"])
                recipient_id = msg.get("recipient_id")
                
                recipient = None
                if recipient_id and ObjectId.is_valid(recipient_id):
                    recipient = await db.recipients.find_one({"_id": ObjectId(recipient_id)})
                    
                recip_name = recipient.get("name", "Unknown") if recipient else "Unknown"
                recip_email = recipient.get("email", "") if recipient else ""
                recip_phone = recipient.get("phone", "") if recipient else ""
                channel = msg.get("delivery_channel", "both")
                
                await db.messages.update_one(
                    {"_id": msg["_id"]},
                    {
                        "$set": {
                            "is_delivered": True,
                            "delivered_at": now,
                            "status": "delivered",
                            "updated_at": now
                        }
                    }
                )
                access_logger.info(
                    f"[SCHEDULED DELIVERY SUCCESS] MsgID: {msg_id} | Recipient: {recip_name} ({recip_email}/{recip_phone}) | Channel: {channel}"
                )
        except Exception as e:
            tb = traceback.format_exc()
            error_logger.error(f"[SCHEDULED WORKER EXCEPTION] {str(e)}\n{tb}")
        
        await asyncio.sleep(60)

# ---------------------------------------------------------
# BACKUP ADMIN ENDPOINTS & PERIODIC WORKER
# ---------------------------------------------------------
@api_router.get("/admin/backups")
async def get_backup_status(current_user: dict = Depends(get_current_user)):
    """Admin endpoint to retrieve summary of backups, total files, and DB snapshots."""
    if not current_user.get("role") == "admin" and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
        
    db_snapshots = await db.system_backups.find({}).sort("timestamp", -1).to_list(100)
    for s in db_snapshots:
        s["_id"] = str(s["_id"])
        
    msg_backups_count = len(list(BACKUP_MESSAGES_DIR.glob("*.json")))
    upload_backups_count = len(list(BACKUP_UPLOADS_DIR.glob("*")))
    
    total_size = 0
    for p in BACKUP_DIR.rglob("*"):
        if p.is_file():
            total_size += p.stat().st_size
            
    return {
        "status": "healthy",
        "backup_directory": str(BACKUP_DIR),
        "total_messages_backed_up": msg_backups_count,
        "total_media_files_backed_up": upload_backups_count,
        "total_backup_size_bytes": total_size,
        "total_backup_size_mb": round(total_size / (1024 * 1024), 2),
        "db_snapshots": db_snapshots
    }

@api_router.post("/admin/backups/trigger")
async def trigger_manual_backup(current_user: dict = Depends(get_current_user)):
    """Admin endpoint to trigger a full database snapshot and file backup."""
    if not current_user.get("role") == "admin" and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
        
    res = await perform_full_database_backup()
    return {
        "success": True,
        "message": "Full database and media snapshot created successfully",
        "backup_data": res
    }

@api_router.get("/admin/backups/download/{snapshot_id}")
async def download_backup(snapshot_id: str, token: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Admin endpoint to download a zip snapshot backup file."""
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.replace("Bearer ", "").strip()
    elif token:
        auth_token = token
        
    if not auth_token:
        raise HTTPException(status_code=401, detail="Missing authentication token")
        
    user = None
    session = await db.user_sessions.find_one({"session_token": auth_token})
    if session:
        user = await db.users.find_one({"user_id": session["user_id"]})
    if not user:
        try:
            payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                user = await db.users.find_one({"email": email})
        except Exception:
            pass

    if not user or (user.get("role") != "admin" and not user.get("is_admin")):
        raise HTTPException(status_code=403, detail="Admin privileges required")
        
    zip_path = BACKUP_DATABASE_DIR / f"{snapshot_id}.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Backup zip file not found")
        
    return FileResponse(
        path=str(zip_path),
        filename=f"{snapshot_id}.zip",
        media_type="application/zip"
    )

async def periodic_backup_loop():
    """Runs an automatic database snapshot backup every 24 hours."""
    while True:
        try:
            await asyncio.sleep(86400)
            logging.getLogger(__name__).info("[PERIODIC BACKUP WORKER] Running 24h scheduled database snapshot...")
            await perform_full_database_backup()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logging.getLogger(__name__).error(f"[PERIODIC BACKUP EXCEPTION] {e}")

@app.on_event("startup")
async def start_backup_system_worker():
    try:
        await perform_full_database_backup()
    except Exception as e:
        logging.getLogger(__name__).error(f"Initial startup backup failed: {e}")
    asyncio.create_task(periodic_backup_loop())

# Launch scheduled messages worker on startup
@app.on_event("startup")
async def start_scheduled_messages_worker():
    asyncio.create_task(process_scheduled_messages_loop())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
