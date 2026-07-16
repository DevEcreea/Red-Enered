import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def check_missing_dates():
    from dotenv import load_dotenv
    load_dotenv("backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    
    # Find all consumptions where FECHA is missing or empty
    cursor = db.consumptions.find({
        "$or": [
            {"FECHA": {"$exists": False}},
            {"FECHA": ""},
            {"FECHA": None}
        ]
    })
    
    rows = await cursor.to_list(100)
    with open("missing_dates_log.txt", "w", encoding="utf-8") as f:
        f.write(f"Found {len(rows)} rows with missing FECHA\n")
        for r in rows:
            f.write(str({k: v for k, v in r.items() if k != "_id"}) + "\n")

if __name__ == "__main__":
    asyncio.run(check_missing_dates())
