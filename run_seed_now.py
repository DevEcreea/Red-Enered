import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv("backend/.env")

from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "enered_prod")

print(f"Connecting to MongoDB: {db_name}...")
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from seed_facilito_precios import seed

async def main():
    res = await seed(db)
    print(f"DONE: Seeded {res} stations into {db_name}")

if __name__ == "__main__":
    asyncio.run(main())
