"""Seed user de prueba cliente_subsidio (idempotente)."""
import asyncio
import os
import uuid
from datetime import datetime, timezone

import bcrypt
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    email = "cliente.subsidio@test.com"
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"User {email} already exists: id={existing['id']}")
        return

    empresa = "TRANSPORTES TEST SUBSIDIO SAC"
    ruc = "20999888777"

    calc_id = str(uuid.uuid4())
    await db.calculations.insert_one({
        "id": calc_id, "califica": True,
        "categorias": [
            {"code": "N2", "cantidad": 2, "galones_mensuales": 400},
            {"code": "N3", "cantidad": 1, "galones_mensuales": 600},
        ],
        "total_galones_mensuales": 1400, "subsidio_estimado": 3200,
        "detalle": {}, "canal_origen": "calculadora",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.empresas_config.insert_one({
        "id": str(uuid.uuid4()), "empresa": empresa, "ruc": ruc,
        "plan": "subsidio", "linea_credito": 0, "unidades_contratadas": 3,
        "dias_credito": 0, "canal_origen": "calculadora_du004",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id, "email": email, "name": "Cliente Subsidio Test",
        "password_hash": bcrypt.hashpw(b"subsidio123", bcrypt.gensalt()).decode(),
        "role": "cliente_subsidio", "empresa": empresa, "ruc": ruc,
        "contacto": "Cliente Subsidio Test", "telefono": "999888777",
        "calc_id": calc_id, "documentos_completos": False,
        "expediente_status": "uploading",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    for placa, cat in [("ABC-123", "N2"), ("DEF-456", "N2"), ("GHI-789", "N3")]:
        await db.subsidio_vehicles.insert_one({
            "id": str(uuid.uuid4()), "user_id": user_id, "empresa": empresa,
            "placa": placa, "categoria": cat,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    print(f"Seeded {email} / subsidio123 (id={user_id})")


if __name__ == "__main__":
    asyncio.run(main())
