"""
Migration Script: Reset Non-Admin Users to Free Plan
==================================================
Resets all non-admin users' subscription tier to 'free' while preserving:
- Admin users (is_admin: True, role: admin/superadmin/staff, is_staff: True)
- User: aknkrds@hotmail.com
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(backend_dir / '.env')


async def reset_users_to_free(auto_confirm: bool = True):
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')

    print(f"=" * 60)
    print(f"Vela — Kullanıcı Abonelik Sıfırlama Script'i")
    print(f"=" * 60)
    print(f"MongoDB URL: {mongo_url}")
    print(f"Database: {db_name}")
    print()

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    try:
        # Exclusion criteria: Admins & aknkrds@hotmail.com
        exclusion_filter = {
            "$or": [
                {"is_admin": True},
                {"is_staff": True},
                {"role": {"$in": ["admin", "superadmin", "staff"]}},
                {"email": {"$regex": "^aknkrds@hotmail\\.com$", "$options": "i"}}
            ]
        }

        # Target criteria: Not matching exclusion filter
        target_filter = {
            "$nor": [
                {"is_admin": True},
                {"is_staff": True},
                {"role": {"$in": ["admin", "superadmin", "staff"]}},
                {"email": {"$regex": "^aknkrds@hotmail\\.com$", "$options": "i"}}
            ]
        }

        total_users = await db.users.count_documents({})
        excluded_users = await db.users.count_documents(exclusion_filter)
        target_users = await db.users.count_documents(target_filter)

        print(f"Toplam kullanıcı sayısı: {total_users}")
        print(f"Hariç tutulan kullanıcılar (Admin & aknkrds@hotmail.com): {excluded_users}")
        print(f"Free yapılacak kullanıcı sayısı: {target_users}")
        print()

        # List excluded users for verification
        excluded_list = await db.users.find(exclusion_filter, {"email": 1, "subscription_tier": 1, "is_admin": 1, "role": 1}).to_list(100)
        print("🛡️ Dokunulmayan İstisna Kullanıcılar:")
        for u in excluded_list:
            print(f"  - Email: {u.get('email')}, Tier: {u.get('subscription_tier')}, Admin: {u.get('is_admin')}, Role: {u.get('role')}")
        print()

        if target_users == 0:
            print("✅ Güncellenecek standart kullanıcı bulunamadı.")
            return

        if not auto_confirm:
            confirm = input(f"⚠️  {target_users} kullanıcının aboneliği 'free' yapılacaktır. Devam? (evet/hayır): ").strip().lower()
            if confirm not in ('evet', 'e', 'yes', 'y'):
                print("❌ İşlem iptal edildi.")
                return

        result = await db.users.update_many(
            target_filter,
            {
                "$set": {
                    "subscription_tier": "free",
                    "subscription_status": "active",
                    "subscription_expiry": None,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        print(f"✅ Güncelleme tamamlandı!")
        print(f"   Eşleşen kullanıcı: {result.matched_count}")
        print(f"   Güncellenen kullanıcı: {result.modified_count}")
        print()

    finally:
        client.close()
        print("Veritabanı bağlantısı kapatıldı.")


if __name__ == "__main__":
    auto = "--yes" in sys.argv or "-y" in sys.argv or True
    asyncio.run(reset_users_to_free(auto_confirm=auto))
