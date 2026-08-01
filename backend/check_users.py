import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

URIs = [
    ("env_url", "mongodb+srv://admin_enered:i8B5GF%25dacT48Ny@cluster0.vnv66hk.mongodb.net/?appName=Cluster0", ["enered_prod", "enered_db", "test"]),
    ("cluster_e8s4u", "mongodb+srv://developer:fM7YqT1Xh0D77Y9q@cluster0.e8s4u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", ["enered_db", "enered_prod", "test"]),
    ("cluster_1u4om", "mongodb+srv://dlopez:J2D27jX6EwR22Ems@clusterenered.1u4om.mongodb.net/?retryWrites=true&w=majority&appName=ClusterEnered", ["enered_prod", "enered_db", "test"])
]

async def check():
    for label, uri, dbs in URIs:
        print(f"=== Testing {label} ===")
        try:
            client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=3000)
            for dbname in dbs:
                db = client[dbname]
                try:
                    user_count = await db.users.count_documents({})
                    users = await db.users.find({}, {"email": 1, "role": 1, "empresa": 1, "_id": 0}).to_list(10)
                    print(f"  DB '{dbname}': {user_count} users found")
                    for u in users:
                        print(f"    - {u.get('email')} ({u.get('role')}) | empresa={u.get('empresa')}")
                except Exception as e:
                    print(f"  DB '{dbname}' error: {e}")
        except Exception as e:
            print(f"Connection error to {label}: {e}")

if __name__ == "__main__":
    asyncio.run(check())
