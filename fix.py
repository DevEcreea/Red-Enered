import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

async def fix():
    from dotenv import load_dotenv
    load_dotenv("backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    
    empresa = "DISTRIBUIDORA ESTARKOS S.A.C."
    
    # 1. Delete the abonos
    res = await db.abonos.delete_many({"empresa": empresa, "nro_operacion": "23124121"})
    print(f"Deleted {res.deleted_count} test abonos.")
    
    # 2. Revert the saldo_a_favor in empresas_config
    # We subtract 10000.00 from their saldo_a_favor
    config = await db.empresas_config.find_one({"empresa": empresa})
    if config:
        new_saldo = max(0.0, float(config.get("saldo_a_favor", 0)) - 10000.0)
        await db.empresas_config.update_one(
            {"empresa": empresa},
            {"$set": {"saldo_a_favor": new_saldo}}
        )
        print(f"Updated saldo_a_favor for {empresa} to {new_saldo}")

if __name__ == "__main__":
    asyncio.run(fix())
