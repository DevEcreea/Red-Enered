import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient

async def check_db():
    from dotenv import load_dotenv
    load_dotenv("backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    
    # 2026/06/12,23:17:50,Lima,E/S GAMBETA,F9Z918,Diesel B5-S50,Galon,19
    r = await db.consumptions.find_one({
        "PLACA": "F9Z918", 
        "HORA": {"$regex": "^23:17"}
    })
    
    # 2026/06/25,18:25:06,Lima,E/S GAMBETA,F9Y836,Diesel B5-S50,Galon,50
    r2 = await db.consumptions.find_one({
        "PLACA": "F9Y836",
        "HORA": {"$regex": "^18:25"}
    })
    
    with open("db_check.txt", "w") as f:
        f.write("Record 1 (23:17): " + str(r.get("FECHA") if r else "Not found") + "\n")
        f.write("Record 2 (18:25): " + str(r2.get("FECHA") if r2 else "Not found") + "\n")

if __name__ == "__main__":
    asyncio.run(check_db())
