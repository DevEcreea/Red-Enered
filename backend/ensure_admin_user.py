"""
Ensure default admin and demo users exist in MongoDB db.users.
"""
import asyncio
import os
import uuid
import bcrypt
import motor.motor_asyncio

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGO_DB_NAME", "red_enered")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

USERS_DEFAULTS = [
    {
        "id": "usr_admin_default",
        "email": "admin@enered.com",
        "nombre": "Administrador ENERED",
        "role": "admin_enered",
        "empresa": "ENERED S.A.C.",
        "password_hash": hash_password("admin123"),
        "servicios": {"plataforma": True, "combustible": True, "gps": True, "subsidio": True}
    },
    {
        "id": "usr_admin_default_2",
        "email": "admin@enered.pe",
        "nombre": "Administrador ENERED",
        "role": "admin_enered",
        "empresa": "ENERED S.A.C.",
        "password_hash": hash_password("admin123"),
        "servicios": {"plataforma": True, "combustible": True, "gps": True, "subsidio": True}
    }
]

async def run():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    for u in USERS_DEFAULTS:
        await db.users.update_one(
            {"email": u["email"]},
            {"$set": u},
            upsert=True
        )
    print("✅ Verified admin users in MongoDB!")

if __name__ == "__main__":
    asyncio.run(run())
