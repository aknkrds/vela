import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check if admin already exists
    existing_admin = await db.users.find_one({"email": "akin@symi.com.tr"})
    
    if existing_admin:
        print("Admin user already exists!")
        return
    
    # Create admin user
    admin_dict = {
        "email": "akin@symi.com.tr",
        "password_hash": pwd_context.hash("DorukNaz2010"),
        "full_name": "Akin Admin",
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
    }
    
    await db.users.insert_one(admin_dict)
    print("Admin user created successfully!")
    print("Email: akin@symi.com.tr")
    print("Password: DorukNaz2010")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
