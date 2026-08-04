import asyncio
import motor.motor_asyncio

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["red_enered"]
    
    docs = await db.precios_facilito.find({"establecimiento": {"$regex": "COESTI", "$options": "i"}}).to_list(100)
    print("=" * 60)
    print(f"Total estaciones COESTI encontradas en db.precios_facilito: {len(docs)}")
    for d in docs:
        print(f" - [{d.get('departamento')}/{d.get('provincia')}] {d.get('establecimiento')} | Combustible: '{d.get('combustible')}' | Precio: S/ {d.get('precio_venta')}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
