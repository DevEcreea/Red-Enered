import asyncio
import motor.motor_asyncio

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["red_enered"]
    count = await db.precios_facilito.count_documents({})
    dptos = await db.precios_facilito.distinct("departamento")
    combustibles = await db.precios_facilito.distinct("combustible")
    
    print(f"Total estaciones en MongoDB: {count}")
    print(f"Departamentos ({len(dptos)}): {dptos}")
    print(f"Combustibles: {combustibles}")

if __name__ == "__main__":
    asyncio.run(main())
