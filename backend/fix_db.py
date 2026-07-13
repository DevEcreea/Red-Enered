import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    print("Connecting to DB...")
    db = AsyncIOMotorClient("mongodb+srv://admin_enered:i8B5GF%dacT48Ny@cluster0.vnv66hk.mongodb.net/?appName=Cluster0").test
    print("Connected. Updating consumptions without string id...")
    cursor = db.consumptions.find({"id": {"$exists": False}})
    count = 0
    async for doc in cursor:
        await db.consumptions.update_one({"_id": doc["_id"]}, {"$set": {"id": str(doc["_id"])}})
        count += 1
    print(f"Updated {count} documents.")

if __name__ == "__main__":
    asyncio.run(main())
