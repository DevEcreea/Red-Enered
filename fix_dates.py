import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient

async def check_sync():
    from dotenv import load_dotenv
    load_dotenv("backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    
    doc = await db.sheets_sync_log.find_one({}, {"_id": 0}, sort=[("finished_at", -1)])
    with open("sync_log.txt", "w") as f:
        f.write(json.dumps(doc, indent=2))

if __name__ == "__main__":
    asyncio.run(check_sync())
