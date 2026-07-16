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
    
    # Get all companies with saldo_a_favor > 0
    async for config in db.empresas_config.find({"saldo_a_favor": {"$gt": 0}}):
        empresa = config["empresa"]
        saldo = config["saldo_a_favor"]
        
        # Get pending invoices
        cursor = db.invoices.find({
            "empresa": empresa,
            "estado": {"$in": ["PENDIENTE", "pendiente", "vencida", "VENCIDA", "por_vencer"]}
        }).sort("fecha_emision", 1)
        
        invoices = await cursor.to_list(1000)
        
        for fac in invoices:
            if saldo <= 0:
                break
                
            deuda = float(fac.get("saldo", fac.get("monto_total", 0)))
            if deuda <= 0:
                continue
                
            if saldo >= deuda:
                await db.invoices.update_one(
                    {"id": fac["id"]},
                    {"$set": {"estado": "pagada", "saldo": 0.0}}
                )
                saldo -= deuda
            else:
                await db.invoices.update_one(
                    {"id": fac["id"]},
                    {"$set": {"saldo": round(deuda - saldo, 2)}}
                )
                saldo = 0.0
                
        # Update remaining saldo
        await db.empresas_config.update_one(
            {"id": config["id"]},
            {"$set": {"saldo_a_favor": round(saldo, 2)}}
        )
        print(f"Empresa {empresa} fixed. Remaining saldo: {saldo}")

if __name__ == "__main__":
    asyncio.run(fix())
