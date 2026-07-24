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
        
        # Test 2: Run sync
        res = await google_sheets_sync.sync_precios_to_mongo(db)
        print(f"Sync result: {res}")
        
        # Test 3: Check again
        count2 = await db.precios.count_documents({})
        print(f"Prices in DB after sync: {count2}")
        
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())
