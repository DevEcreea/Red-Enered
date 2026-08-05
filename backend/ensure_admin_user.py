from dotenv import load_dotenv
from pathlib import Path
import asyncio
import os
import uuid
import bcrypt
import motor.motor_asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URI = os.environ.get("MONGO_URL") or os.environ.get("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME") or os.environ.get("MONGO_DB_NAME", "enered_prod")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

USERS_DEFAULTS = [
    {
        "id": "usr_admin_default",
        "email": "admin@enered.com",
        "name": "Administrador ENERED",
        "nombre": "Administrador ENERED",
        "role": "admin_enered",
        "empresa": "ENERED S.A.C.",
        "password_hash": hash_password("admin123"),
        "servicios": {"plataforma": True, "combustible": True, "gps": True, "subsidio": True}
    },
    {
        "id": "usr_admin_default_2",
        "email": "admin@enered.pe",
        "name": "Administrador ENERED",
        "nombre": "Administrador ENERED",
        "role": "admin_enered",
        "empresa": "ENERED S.A.C.",
        "password_hash": hash_password("admin123"),
        "servicios": {"plataforma": True, "combustible": True, "gps": True, "subsidio": True}
    },
    {
        "id": "usr_admin_soporte",
        "email": "soporte@ecreea.com",
        "name": "Soporte ECREEA",
        "nombre": "Soporte ECREEA",
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
    print(f"✅ Verified admin users in MongoDB ({DB_NAME})!")

if __name__ == "__main__":
    asyncio.run(run())
