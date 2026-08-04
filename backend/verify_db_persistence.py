import asyncio
import motor.motor_asyncio

async def check():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["red_enered"]
    count = await db.precios_facilito.count_documents({})
    dptos = await db.precios_facilito.distinct("departamento")
    combustibles = await db.precios_facilito.distinct("combustible")
    
    print("=" * 50)
    print(f"📊 VERIFICACIÓN DE PERSISTENCIA EN MONGODB:")
    print(f"   - Total estaciones guardadas: {count}")
    print(f"   - Departamentos registrados ({len(dptos)}): {', '.join(dptos[:10])}...")
    print(f"   - Combustibles registrados: {combustibles}")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(check())
