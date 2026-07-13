import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def main():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    users = await db.users.find({}, {"_id": 0, "email": 1, "role": 1, "empresa": 1}).to_list(100)
    print("Users in DB:")
    for u in users:
        print(f"Email: {u.get('email')}, Role: {u.get('role')}, Empresa: {u.get('empresa')}")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
