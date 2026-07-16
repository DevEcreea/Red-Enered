import asyncio
import os
import json
import re
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient

async def do_sync():
    from dotenv import load_dotenv
    load_dotenv("backend/.env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
    from google_sheets_sync import sync_to_mongo
    
    try:
        res = await sync_to_mongo(db, mode="replace")
        with open("sync_res.txt", "w") as f:
            f.write(json.dumps(res, indent=2))
    except Exception as e:
        with open("sync_err.txt", "w") as f:
            f.write(str(e))

if __name__ == "__main__":
    asyncio.run(do_sync())
