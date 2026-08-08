import asyncio
import motor.motor_asyncio

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["red_enered"]
    res = await db.precios_facilito.update_many({"provincia": "PACASMALLO"}, {"$set": {"provincia": "PACASMAYO"}})
    print(f"✅ Se corrigió 'PACASMALLO' -> 'PACASMAYO' en {res.modified_count} registros de MongoDB.")

if __name__ == "__main__":
    asyncio.run(main())
