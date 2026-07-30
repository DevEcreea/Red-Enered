import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import google_sheets_sync

async def main():
    try:
        db = AsyncIOMotorClient("mongodb+srv://dlopez:J2D27jX6EwR22Ems@clusterenered.1u4om.mongodb.net/?retryWrites=true&w=majority&appName=ClusterEnered").get_database('enered_prod')
        
        # Test 1: Check if prices exist
        count = await db.precios.count_documents({})
        print(f"Prices in DB: {count}")
        
        # Sync consumos (Hoja 1)
        res_consumos = await google_sheets_sync.sync_to_mongo(db, mode="replace")
        print(f"Consumos Sync: {res_consumos}")

        # Sync precios (PRECIOS)
        res_precios = await google_sheets_sync.sync_precios_to_mongo(db)
        print(f"Precios Sync: {res_precios}")
        
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())
