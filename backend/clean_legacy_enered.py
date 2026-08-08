import asyncio
import motor.motor_asyncio

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["red_enered"]
    res = await db.estaciones_enered.update_many(
        {"combustible": {"$exists": False}},
        {"$set": {"combustible": "Diesel B5 UV"}}
    )
    print(f"✅ Se actualizaron {res.modified_count} estaciones ENERED antiguas al combustible 'Diesel B5 UV'.")

if __name__ == "__main__":
    asyncio.run(main())
